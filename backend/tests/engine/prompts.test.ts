import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../../src/engine/blueprint.js';
import { replayState } from '../../src/engine/session.js';
import { deriveEvent } from '../../src/engine/events.js';
import type { TurnEvent } from '../../src/engine/events.js';
import { buildPrompt } from '../../src/engine/prompts.js';
import type { ChatMessage } from '../../src/types/index.js';
import type { Blueprint } from '../../src/engine/blueprint.js';
import { NEG, huntingPrefix, prefixAllUnlocked, withCurrent } from './helpers.js';

const KEY = '#Quasar8128&Fenix%777!';

interface Scenario {
  name: string;
  history: ChatMessage[];
  allowKey?: boolean;
  allowedValues?: string[];
}

function buildScenarios(bp: Blueprint): Scenario[] {
  const firstWord = bp.queue.find((f) => f.type === 'word')!;
  const last = bp.queue[bp.queue.length - 1];
  const wi = bp.queue.indexOf(firstWord);
  const other = bp.queue[wi + 1] ?? bp.queue[wi - 1];

  return [
    { name: 'rompehielo', history: [NEG] },
    { name: 'first_challenge', history: [NEG, { role: 'user', content: 'te cuento un chiste' }] },
    { name: 'numeric_guess', history: withCurrent(huntingPrefix(bp, (f) => f.value === '8128'), 'es 8075') },
    {
      name: 'word_riddle',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'word'), 'no tengo idea'),
      allowedValues: [firstWord.value],
    },
    {
      name: 'symbol_riddle',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'symbol'), 'ni idea, dame una pista'),
    },
    {
      name: 'piece_hit_normal',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'word'), firstWord.value),
    },
    {
      name: 'piece_hit_combo',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'word'), `${firstWord.value} ${other.value}`),
    },
    {
      name: 'piece_hit_out_of_turn',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'word'), other.value),
    },
    { name: 'last_piece', history: withCurrent(huntingPrefix(bp, (f) => f === last), last.value) },
    { name: 'assembly_diff', history: withCurrent(prefixAllUnlocked(bp), '#Fenix777!Quasar8128') },
    { name: 'victory', history: withCurrent(prefixAllUnlocked(bp), KEY), allowKey: true },
    {
      name: 'ask_length',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'symbol'), '¿cuántas letras tiene la clave?'),
    },
    {
      name: 'ask_property',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'number'), '¿cuál es la suma de sus dígitos?'),
    },
    {
      name: 'ask_future',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'symbol'), '¿cuál es el siguiente paso?'),
    },
    {
      name: 'ask_category',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'word'), '¿es una criatura?'),
    },
    {
      name: 'ask_mask',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'symbol'), 'dibuja la clave con X'),
    },
    {
      name: 'chitchat',
      history: withCurrent(huntingPrefix(bp, (f) => f.type === 'symbol'), 'jaja, qué buen clima hoy'),
    },
  ];
}

function run(history: ChatMessage[], bp: Blueprint) {
  const state0 = replayState(history, bp);
  const { event, stateAfter } = deriveEvent(state0, bp);
  const prompt = buildPrompt(event, stateAfter, history, bp);
  return { event, stateAfter, prompt };
}

const EXPECTED_TEMP: Record<TurnEvent['type'], number> = {
  rompehielo: 0.8,
  first_challenge: 0.7,
  word_riddle: 0.7,
  symbol_riddle: 0.7,
  ask_future: 0.7,
  ask_category: 0.7,
  ask_mask: 0.7,
  chitchat: 0.7,
  piece_hit: 0.6,
  last_piece: 0.6,
  victory: 0.6,
  numeric_guess: 0.25,
  ask_length: 0.25,
  ask_property: 0.25,
  assembly_diff: 0.25,
  assembly_hint: 0.25,
};

describe('Fase 4: engine/prompts (buildPrompt)', () => {
  const bp = buildBlueprint(KEY);

  it('cada evento produce BASE + directiva, sin placeholders sin rellenar', () => {
    for (const sc of buildScenarios(bp)) {
      const { prompt } = run(sc.history, bp);
      expect(prompt.systemPrompt, sc.name).toContain('Eres Lucas');
      expect(prompt.systemPrompt, sc.name).toMatch(/TURNO:|FASE FINAL:/);
      expect(prompt.systemPrompt, sc.name).not.toContain('{');
      expect(prompt.systemPrompt, sc.name).not.toContain('}');
      expect(prompt.systemPrompt, sc.name).toContain('DATOS DEL SISTEMA');
    }
  });

  it('usa la temperatura y maxTokens de la tabla', () => {
    for (const sc of buildScenarios(bp)) {
      const { event, prompt } = run(sc.history, bp);
      expect(prompt.temperature, sc.name).toBe(EXPECTED_TEMP[event.type]);
      const expectedTokens =
        event.type === 'assembly_diff' || event.type === 'assembly_hint' ? 60 : 160;
      expect(prompt.maxTokens, sc.name).toBe(expectedTokens);
    }
  });

  it('envía entre 1 y 3 entradas recientes preservando roles (continuidad)', () => {
    for (const sc of buildScenarios(bp)) {
      const { stateAfter, prompt } = run(sc.history, bp);
      expect(prompt.messagesForAI.length, sc.name).toBeGreaterThanOrEqual(1);
      expect(prompt.messagesForAI.length, sc.name).toBeLessThanOrEqual(3);
      expect(prompt.messagesForAI[0].role, sc.name).toBe('user');
      const last = prompt.messagesForAI[prompt.messagesForAI.length - 1];
      expect(last.content, sc.name).toBe(stateAfter.currentMessage);
      for (const m of prompt.messagesForAI) {
        expect(['user', 'assistant'], sc.name).toContain(m.role);
      }
    }
  });

  it('Golden C — presupuesto: <= 250 palabras por prompt', () => {
    for (const sc of buildScenarios(bp)) {
      const { prompt } = run(sc.history, bp);
      const words = prompt.systemPrompt.split(/\s+/).filter(Boolean).length;
      expect(words, `${sc.name} (${words})`).toBeLessThanOrEqual(250);
    }
  });

  it('Golden D — el secreto no viaja en el prompt', () => {
    for (const sc of buildScenarios(bp)) {
      const { prompt, stateAfter, event } = run(sc.history, bp);

      if (sc.allowKey) {
        expect(prompt.systemPrompt).toContain(KEY);
        continue;
      }

      expect(prompt.systemPrompt, `${sc.name}: clave`).not.toContain(KEY);

      // La palabra del reto SE revela al modelo a propósito (para inventar el enigma).
      const allowed = new Set(sc.allowedValues ?? []);
      if (event.type === 'word_riddle') allowed.add(event.word);
      if (event.type === 'first_challenge' && event.activeWord) allowed.add(event.activeWord);
      if (event.type === 'piece_hit' && event.nextWord) allowed.add(event.nextWord);

      for (const frag of stateAfter.pending) {
        if (allowed.has(frag.value)) continue;
        expect(prompt.systemPrompt, `${sc.name}: valor ${frag.value}`).not.toContain(frag.value);
      }

      for (const frag of stateAfter.pending) {
        if (frag.type !== 'symbol') continue;
        for (const name of bp.info.get(frag.id)?.names ?? []) {
          expect(prompt.systemPrompt.toLowerCase(), `${sc.name}: name ${name}`).not.toContain(
            name.toLowerCase()
          );
        }
      }
    }
  });

  it('el numeric_guess documenta el veredicto correcto (log real: 8128 vs 8075)', () => {
    const { prompt, event } = run(
      withCurrent(huntingPrefix(bp, (f) => f.value === '8128'), 'es 8075'),
      bp
    );
    expect(event.type).toBe('numeric_guess');
    expect(prompt.systemPrompt).toContain('MAYOR que 8075');
    expect(prompt.systemPrompt).not.toContain('8128');
  });

  it('piece_hit numérico: cita la pieza e incluye la mecánica mayor/menor', () => {
    const state = replayState([NEG], bp);
    const event: TurnEvent = {
      type: 'piece_hit',
      kind: 'normal',
      typed: 'Quasar',
      remaining: 3,
      nextLabel: 'número de 4 dígitos',
      nextAngle: null,
      nextKind: 'number',
      nextWord: null,
    };
    const prompt = buildPrompt(event, state, [NEG], bp);
    expect(prompt.systemPrompt).toContain('Pieza conseguida: "Quasar"');
    expect(prompt.systemPrompt).toContain('MAYOR o MENOR');
  });

  it('piece_hit con nueva palabra: la revela al modelo para inventar el enigma', () => {
    const state = replayState([NEG], bp);
    const event: TurnEvent = {
      type: 'piece_hit',
      kind: 'normal',
      typed: '#',
      remaining: 2,
      nextLabel: 'palabra de 6 letras',
      nextAngle: 'lejano: mitología, astronomía o simbolismo',
      nextKind: 'word',
      nextWord: 'Quasar',
    };
    const prompt = buildPrompt(event, state, [NEG], bp);
    expect(prompt.systemPrompt).toContain('Referencia INTERNA');
    expect(prompt.systemPrompt).toContain('Quasar');
    expect(prompt.systemPrompt).toContain('enigma PROPIO');
  });

  it('piece_hit out_of_turn: rotula el reto en curso y no lo anuncia como nuevo', () => {
    const state = replayState([NEG], bp);
    const event: TurnEvent = {
      type: 'piece_hit',
      kind: 'out_of_turn',
      typed: '%',
      remaining: 5,
      nextLabel: 'número de 3 dígitos',
      nextAngle: null,
      nextKind: 'number',
      nextWord: null,
    };
    const prompt = buildPrompt(event, state, [NEG], bp);
    expect(prompt.systemPrompt).toContain('Reto en curso (NO cambió)');
    expect(prompt.systemPrompt).not.toContain('Siguiente reto:');
  });

  it('assembly_hint: entrega la pista de orden (un solo mensaje user)', () => {
    const state = replayState([NEG], bp);
    const event: TurnEvent = {
      type: 'assembly_hint',
      level: 1,
      orderHint: 'Tu mochila tiene 8 piezas: 2 palabras, 2 números y 4 símbolos.',
    };
    const prompt = buildPrompt(event, state, [NEG], bp);
    expect(prompt.systemPrompt).toContain('PISTA DE ORDEN');
    expect(prompt.systemPrompt).toContain('Tu mochila tiene 8 piezas');
    expect(prompt.messagesForAI).toHaveLength(1);
    expect(prompt.temperature).toBe(0.25);
  });
});
