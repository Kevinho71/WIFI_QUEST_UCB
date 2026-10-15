import { describe, it, expect, beforeAll } from 'vitest';
import { buildBlueprint, __resetBlueprintCacheForTests } from '../../src/engine/blueprint.js';
import type { Blueprint } from '../../src/engine/blueprint.js';
import { replayState } from '../../src/engine/session.js';
import { deriveEvent } from '../../src/engine/events.js';
import { buildPrompt } from '../../src/engine/prompts.js';
import { validateReply, applyReplyCorrections } from '../../src/engine/guards.js';
import type { GuardContext } from '../../src/engine/guards.js';
import type { ChatMessage, PasswordFragment } from '../../src/types/index.js';
import { NEG, huntingPrefix, prefixAllUnlocked, withCurrent } from './helpers.js';

const KEY = '#Quasar8128&Fenix%777!';

function makeCtx(bp: Blueprint, prefix: ChatMessage[], current: string) {
  const history = withCurrent(prefix, current);
  const state0 = replayState(history, bp);
  const { event, stateAfter } = deriveEvent(state0, bp);
  const prompt = buildPrompt(event, stateAfter, history, bp);
  const ctx: GuardContext = {
    phase: stateAfter.phase,
    event,
    userMessage: current,
    datosBlock: prompt.datosBlock,
    blueprint: bp,
    pending: stateAfter.pending,
  };
  return { ctx, event, stateAfter, prompt };
}

beforeAll(() => {
  process.env.WIFI_PASS = KEY;
  __resetBlueprintCacheForTests();
});

describe('Fase 5: engine/guards', () => {
  const bp = buildBlueprint(KEY);

  describe('Golden A — veredicto numérico (8128 vs 8075)', () => {
    const { ctx } = makeCtx(bp, huntingPrefix(bp, (f) => f.value === '8128'), 'es 8075');

    it('rechaza el veredicto invertido', () => {
      expect(validateReply('Te pasaste: es menor que 8075', ctx)).toMatchObject({ ok: false });
    });

    it('acepta el veredicto correcto (con emoji permitido)', () => {
      expect(validateReply('Te quedaste corto: es mayor que 8075 🔥', ctx)).toEqual({ ok: true });
    });

    it('rechaza una cercanía que no es la del evento', () => {
      // El evento es CALIENTE (8128 vs 8075); decir "frío" debe fallar.
      expect(validateReply('Es mayor que 8075, vas frío', ctx)).toMatchObject({ ok: false });
    });
  });

  describe('guard de dígitos', () => {
    // Pieza activa = 8128 (suma de dígitos = 19, y viaja en el datosBlock).
    const { ctx } = makeCtx(
      bp,
      huntingPrefix(bp, (f) => f.value === '8128'),
      '¿cuál es la suma de sus dígitos?'
    );

    it('acepta un dígito que existe en DATOS DEL SISTEMA', () => {
      // La suma real de 8128 es 19, y viaja en el datosBlock.
      expect(validateReply('La suma de los dígitos es 19, crack 🔥', ctx)).toEqual({ ok: true });
    });

    it('rechaza un dígito inventado', () => {
      const res = validateReply('La suma de los dígitos es 20, crack', ctx);
      expect(res).toMatchObject({ ok: false });
      if (!res.ok) expect(res.reason).toContain('20');
    });
  });

  describe('guard de fugas', () => {
    it('rechaza la palabra activa escrita por el modelo', () => {
      const { ctx, event } = makeCtx(bp, huntingPrefix(bp, (f) => f.type === 'word'), 'no tengo idea');
      expect(event.type).toBe('word_riddle');
      if (event.type !== 'word_riddle') return;

      const res = validateReply(`La palabra secreta es ${event.word}, dale`, ctx);
      expect(res).toMatchObject({ ok: false, leak: true });
    });

    it('rechaza la clave completa (Golden B)', () => {
      const { ctx } = makeCtx(
        bp,
        prefixAllUnlocked(bp),
        '#Fenix777!Quasar8128'
      );
      const res = validateReply(`Toma, la clave es ${KEY}`, ctx);
      expect(res).toMatchObject({ ok: false, leak: true });
    });
  });

  it('rechaza una falsa victoria en fase de caza', () => {
    const { ctx } = makeCtx(
      bp,
      huntingPrefix(bp, (f) => f.type === 'symbol'),
      'jaja, qué buen clima hoy'
    );
    const res = validateReply('GG casi lo tienes', ctx);
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.reason).toContain('victoria');
  });

  it('en fase solved NO marca fuga por la clave (victoria legítima)', () => {
    const ctx: GuardContext = {
      phase: 'solved',
      event: { type: 'victory' },
      userMessage: KEY,
      datosBlock: `- El usuario acaba de enviar la clave completa exacta: "${KEY}".`,
      blueprint: bp,
      pending: [],
    };
    expect(validateReply(`¡GG! La clave es ${KEY}`, ctx)).toEqual({ ok: true });
  });

  describe('correcciones automáticas (paso 1)', () => {
    it('elimina emojis prohibidos y conserva los permitidos', () => {
      const corrected = applyReplyCorrections('Hola 😀 mundo 🎮');
      expect(corrected).not.toContain('😀');
      expect(corrected).toContain('🎮');
    });

    it('no invalida una respuesta correcta que trae un emoji prohibido', () => {
      const { ctx } = makeCtx(bp, huntingPrefix(bp, (f) => f.value === '8128'), 'es 8075');
      expect(validateReply('Te quedaste corto: es mayor que 8075 🎉', ctx)).toEqual({ ok: true });
    });

    it('corta por el último límite de oración dentro de las 65 palabras', () => {
      const first = Array(10).fill('palabra').join(' ');
      const rest = Array(60).fill('palabra').join(' ');
      const corrected = applyReplyCorrections(`${first}. ${rest}`);
      expect(corrected.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(65);
      expect(corrected.endsWith('.')).toBe(true);
      expect(corrected).toContain(first);
    });

    it('aplica corte duro con "..." si no hay límite de oración', () => {
      const long = Array(80).fill('palabra').join(' ');
      const corrected = applyReplyCorrections(long);
      expect(corrected.endsWith('...')).toBe(true);
      expect(corrected.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(65);
    });
  });
});
