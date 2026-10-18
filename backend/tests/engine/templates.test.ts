import { describe, it, expect, beforeAll } from 'vitest';
import { buildBlueprint, __resetBlueprintCacheForTests } from '../../src/engine/blueprint.js';
import type { Blueprint } from '../../src/engine/blueprint.js';
import { replayState } from '../../src/engine/session.js';
import { deriveEvent } from '../../src/engine/events.js';
import type { TurnEvent } from '../../src/engine/events.js';
import { buildPrompt } from '../../src/engine/prompts.js';
import { validateReply } from '../../src/engine/guards.js';
import type { GuardContext } from '../../src/engine/guards.js';
import { TEMPLATES, fillTemplate, templateKeyFor } from '../../src/engine/templates.js';
import type { TemplateKey } from '../../src/engine/templates.js';
import type { ChatMessage } from '../../src/types/index.js';
import { NEG, huntingPrefix, prefixAllUnlocked, withCurrent, u } from './helpers.js';

const KEY = '#Quasar8128&Fenix%777!';

interface Fixture {
  event: TurnEvent;
  ctx: GuardContext;
}

function fromScenario(bp: Blueprint, history: ChatMessage[]): Fixture {
  const state0 = replayState(history, bp);
  const { event, stateAfter } = deriveEvent(state0, bp);
  const prompt = buildPrompt(event, stateAfter, history, bp);
  const current = [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  return {
    event,
    ctx: {
      phase: stateAfter.phase,
      event,
      userMessage: current,
      datosBlock: prompt.datosBlock,
      blueprint: bp,
      pending: stateAfter.pending,
    },
  };
}

/** Historia representativa por evento (chitchat no es alcanzable desde un historial). */
function scenarioHistory(bp: Blueprint, key: TemplateKey): ChatMessage[] {
  const active0 = bp.queue[0];
  const future0 = bp.queue[1];
  const last = bp.queue[bp.queue.length - 1];
  const hunt = (predicate: (f: (typeof bp.queue)[number]) => boolean) => huntingPrefix(bp, predicate);

  switch (key) {
    case 'rompehielo':
      return [NEG];
    case 'first_challenge':
      return [NEG, u('te cuento un chiste')];
    case 'numeric_guess':
      return withCurrent(hunt((f) => f.value === '8128'), 'es 8075');
    case 'word_riddle':
      return withCurrent(hunt((f) => f.type === 'word'), 'no tengo idea');
    case 'symbol_riddle':
      return withCurrent(hunt((f) => f.type === 'symbol'), 'ni idea');
    case 'piece_hit_normal':
      return withCurrent(hunt((f) => f === active0), active0.value);
    case 'piece_hit_combo':
      return withCurrent(hunt((f) => f === active0), `${active0.value} ${future0.value}`);
    case 'piece_hit_out_of_turn':
      return withCurrent(hunt((f) => f === active0), future0.value);
    case 'last_piece':
      return withCurrent(hunt((f) => f === last), last.value);
    case 'assembly_diff':
      return withCurrent(prefixAllUnlocked(bp), '#Fenix777!Quasar8128');
    case 'assembly_hint':
      return withCurrent(prefixAllUnlocked(bp), 'dame una pista del orden, hay demasiadas posibilidades');
    case 'victory':
      return withCurrent(prefixAllUnlocked(bp), KEY);
    case 'ask_length':
      return withCurrent(hunt((f) => f.type === 'symbol'), '¿cuántas letras tiene la clave?');
    case 'ask_property':
      return withCurrent(hunt((f) => f.value === '8128'), '¿cuál es la suma de sus dígitos?');
    case 'ask_future':
      return withCurrent(hunt((f) => f.type === 'symbol'), '¿cuál es el siguiente paso?');
    case 'ask_category':
      return withCurrent(hunt((f) => f.type === 'word'), '¿es una criatura?');
    case 'ask_mask':
      return withCurrent(hunt((f) => f.type === 'symbol'), 'dibuja la clave con X');
    case 'chitchat':
      // El evento `chitchat` es el fallback cuando no hay pieza activa: se construye a mano.
      throw new Error('chitchat se construye de forma sintética');
  }
}

function fixture(bp: Blueprint, key: TemplateKey): Fixture {
  if (key === 'chitchat') {
    const event: TurnEvent = { type: 'chitchat', activeDesc: 'una palabra de 6 letras' };
    return {
      event,
      ctx: {
        phase: 'hunting',
        event,
        userMessage: 'jaja, qué buen clima hoy',
        datosBlock: '- Reto en curso: una palabra de 6 letras (solo eso).',
        blueprint: bp,
        pending: [...bp.queue],
      },
    };
  }
  return fromScenario(bp, scenarioHistory(bp, key));
}

const ALL_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

beforeAll(() => {
  process.env.WIFI_PASS = KEY;
  __resetBlueprintCacheForTests();
});

describe('Fase 5: engine/templates', () => {
  const bp = buildBlueprint(KEY);

  it('registra las 3 variantes de cada evento', () => {
    for (const key of ALL_KEYS) {
      expect(TEMPLATES[key], key).toHaveLength(3);
      for (const variant of TEMPLATES[key]) expect(variant.length).toBeGreaterThan(0);
    }
  });

  it('cada plantilla tiene un fixture que produce su evento', () => {
    for (const key of ALL_KEYS) {
      const { event } = fixture(bp, key);
      expect(templateKeyFor(event), key).toBe(key);
    }
  });

  it('cada variante pasa validateReply (sin fugas, sin falsa victoria, largo OK)', () => {
    for (const key of ALL_KEYS) {
      const { event, ctx } = fixture(bp, key);

      for (const variant of [0, 1, 2] as const) {
        const reply = fillTemplate(event, bp, variant);
        expect(reply, `${key}#${variant}: placeholder sin rellenar`).not.toContain('{');

        if (key === 'victory') {
          expect(reply, `${key}#${variant}: clave`).toContain(KEY);
          continue; // la victoria no se valida con guards (fase solved)
        }

        expect(validateReply(reply, ctx), `${key}#${variant}`).toEqual({ ok: true });
        expect(reply.split(/\s+/).filter(Boolean).length, `${key}#${variant}: largo`).toBeLessThanOrEqual(65);
      }
    }
  });
});
