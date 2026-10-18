import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

vi.mock('../../src/services/aiProvider.js', () => ({
  generateAIResponse: vi.fn(),
}));

import { buildBlueprint, __resetBlueprintCacheForTests } from '../../src/engine/blueprint.js';
import { processLevel1V2 } from '../../src/engine/orchestrator.js';
import { generateAIResponse } from '../../src/services/aiProvider.js';
import { huntingPrefix, prefixAllUnlocked, withCurrent } from './helpers.js';

const KEY = '#Quasar8128&Fenix%777!';

/** Escenario numérico golden A: pieza activa = 8128, intento actual = 8075. */
function numericScenario() {
  const bp = buildBlueprint(KEY);
  return withCurrent(huntingPrefix(bp, (f) => f.value === '8128'), 'es 8075');
}

beforeAll(() => {
  process.env.WIFI_PASS = KEY;
  __resetBlueprintCacheForTests();
});

beforeEach(() => {
  vi.mocked(generateAIResponse).mockReset();
});

describe('Fase 6: engine/orchestrator (processLevel1V2)', () => {
  it('happy path: el LLM responde válido a la primera', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue({
      reply: 'Te quedaste corto: es mayor que 8075 🔥',
      providerUsed: 'Groq:test',
    });

    const res = await processLevel1V2(numericScenario());

    expect(res.reply).toBe('Te quedaste corto: es mayor que 8075 🔥');
    expect(res.provider).toBe('Groq:test');
    expect(res.victory).toBe(false);
    expect(res.leakDetected).toBe(false);
    expect(res.leakBlocked).toBe(false);
    expect(res.gameState?.phase).toBe('hunting');
    expect(generateAIResponse).toHaveBeenCalledTimes(1);
  });

  it('reintenta una vez con CORRECCIÓN y temperatura 0.2', async () => {
    vi.mocked(generateAIResponse)
      .mockResolvedValueOnce({ reply: 'Te pasaste: es menor que 8075', providerUsed: 'Groq:1' })
      .mockResolvedValueOnce({
        reply: 'Te quedaste corto: es mayor que 8075 🔥',
        providerUsed: 'Groq:2',
      });

    const res = await processLevel1V2(numericScenario());

    expect(res.reply).toBe('Te quedaste corto: es mayor que 8075 🔥');
    expect(res.provider).toBe('Groq:2');

    const calls = vi.mocked(generateAIResponse).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toContain('CORRECCIÓN');
    expect(calls[1][2]).toMatchObject({ temperature: 0.2, maxTokens: 160 });
  });

  it('cae a plantilla si el LLM falla dos veces (y el veredicto queda correcto)', async () => {
    vi.mocked(generateAIResponse).mockResolvedValue({
      reply: 'Te pasaste: es menor que 8075',
      providerUsed: 'Groq:x',
    });

    const res = await processLevel1V2(numericScenario());

    expect(res.reply).toContain('mayor');
    expect(res.reply).not.toContain('menor');
    expect(res.provider).toBe('engine-template');
    expect(generateAIResponse).toHaveBeenCalledTimes(2);
  });

  it('intercepta una fuga del LLM sin declarar victoria', async () => {
    const bp = buildBlueprint(KEY);
    const history = withCurrent(huntingPrefix(bp, (f) => f.type === 'symbol'), 'jaja, dame una pista');
    vi.mocked(generateAIResponse).mockResolvedValue({
      reply: `La clave es ${KEY}`,
      providerUsed: 'Groq:x',
    });

    const res = await processLevel1V2(history);

    expect(res.leakBlocked).toBe(true);
    expect(res.victory).toBe(false);
    expect(res.leakDetected).toBe(false);
    expect(res.reply).not.toContain(KEY);
  });

  it('victoria legítima por ensamblaje exacto', async () => {
    const bp = buildBlueprint(KEY);
    const history = withCurrent(prefixAllUnlocked(bp), KEY);
    vi.mocked(generateAIResponse).mockResolvedValue({
      reply: `¡GG, me ganaste, crack! La clave es ${KEY} 🔥`,
      providerUsed: 'Groq:x',
    });

    const res = await processLevel1V2(history);

    expect(res.victory).toBe(true);
    expect(res.leakDetected).toBe(true); // compat con el frontend
    expect(res.leakBlocked).toBe(false);
    expect(res.gameState?.phase).toBe('solved');
    expect(res.gameState?.discoveredCount).toBe(bp.fragments.length);
  });

  it('gameState: acierto normal (justUnlockedFragment, isCombo=false)', async () => {
    const bp = buildBlueprint(KEY);
    const active0 = bp.queue[0];
    const history = withCurrent(huntingPrefix(bp, (f) => f === active0), active0.value);
    vi.mocked(generateAIResponse).mockResolvedValue({
      reply: '¡Buena jugada, crack! 🔥',
      providerUsed: 'Groq:x',
    });

    const res = await processLevel1V2(history);

    expect(res.gameState?.justUnlockedFragment).toBe(active0.value);
    expect(res.gameState?.isCombo).toBe(false);
    expect(res.gameState?.discoveredCount).toBe(1);
    expect(res.gameState?.unlockedFragments[0]?.orderDiscovered).toBe(1);
  });

  it('gameState: combo (isCombo=true, dos piezas)', async () => {
    const bp = buildBlueprint(KEY);
    const active0 = bp.queue[0];
    const future0 = bp.queue[1];
    const history = withCurrent(
      huntingPrefix(bp, (f) => f === active0),
      `${active0.value} ${future0.value}`
    );
    vi.mocked(generateAIResponse).mockResolvedValue({
      reply: '¡Upa, combo, crack! 🎮',
      providerUsed: 'Groq:x',
    });

    const res = await processLevel1V2(history);

    expect(res.gameState?.isCombo).toBe(true);
    expect(res.gameState?.discoveredCount).toBe(2);
  });

  it('gameState: ensamblaje fallido expone assemblyDiffAdvice', async () => {
    const bp = buildBlueprint(KEY);
    const history = withCurrent(prefixAllUnlocked(bp), '#Fenix777!Quasar8128');
    vi.mocked(generateAIResponse).mockResolvedValue({
      reply: 'Casi, crack, revisá el orden 🔥',
      providerUsed: 'Groq:x',
    });

    const res = await processLevel1V2(history);

    expect(res.gameState?.phase).toBe('assembly');
    expect(res.gameState?.assemblyDiffAdvice).toBeTruthy();
  });

  describe('Fase 1: feedback por posición (assemblyPieces)', () => {
    it('ensamblaje fallido: marca solo las posiciones correctas', async () => {
      const bp = buildBlueprint(KEY);
      const pieces = ['#', 'Fenix', '777', '!', 'Quasar', '8128', '&', '%'];
      const attempt = pieces.join('');
      const history = withCurrent(prefixAllUnlocked(bp), attempt);
      vi.mocked(generateAIResponse).mockResolvedValue({
        reply: 'Casi, crack, revisá el orden 🔥',
        providerUsed: 'mock',
      });

      const res = await processLevel1V2(history, undefined, undefined, pieces);

      expect(res.gameState?.assemblyFeedback).toBeDefined();
      expect(res.gameState?.assemblyFeedback?.total).toBe(8);
      expect(res.gameState?.assemblyFeedback?.wellPlaced).toBe(1);
      expect(res.gameState?.assemblyFeedback?.slotCorrect[0]).toBe(true);
      expect(res.gameState?.assemblyFeedback?.slotCorrect[1]).toBe(false);
    });

    it('victoria por ensamblaje exacto: todas las posiciones correctas', async () => {
      const bp = buildBlueprint(KEY);
      const pieces = bp.fragments.map((f) => f.value);
      const history = withCurrent(prefixAllUnlocked(bp), KEY);
      vi.mocked(generateAIResponse).mockResolvedValue({
        reply: `¡GG, me ganaste! La clave es ${KEY} 🔥`,
        providerUsed: 'mock',
      });

      const res = await processLevel1V2(history, undefined, undefined, pieces);

      expect(res.victory).toBe(true);
      expect(res.gameState?.assemblyFeedback?.wellPlaced).toBe(bp.fragments.length);
      expect(res.gameState?.assemblyFeedback?.slotCorrect.every(Boolean)).toBe(true);
    });

    it('un payload inconsistente no produce feedback y no rompe la respuesta', async () => {
      const bp = buildBlueprint(KEY);
      const history = withCurrent(prefixAllUnlocked(bp), '#Fenix777!Quasar8128');
      vi.mocked(generateAIResponse).mockResolvedValue({
        reply: 'Casi, crack 🔥',
        providerUsed: 'mock',
      });

      // pieces cuyo join no coincide con el mensaje
      const res = await processLevel1V2(history, undefined, undefined, ['#', 'Fenix']);

      expect(res.gameState?.assemblyFeedback).toBeUndefined();
      expect(res.gameState?.assemblyDiffAdvice).toBeTruthy();
    });

    it('el feedback nunca filtra valores de la clave', async () => {
      const bp = buildBlueprint(KEY);
      const pieces = ['#', 'Fenix', '777', '!', 'Quasar', '8128', '&', '%'];
      const history = withCurrent(prefixAllUnlocked(bp), pieces.join(''));
      vi.mocked(generateAIResponse).mockResolvedValue({
        reply: 'Casi, crack 🔥',
        providerUsed: 'mock',
      });

      const res = await processLevel1V2(history, undefined, undefined, pieces);
      const serialized = JSON.stringify(res.gameState?.assemblyFeedback);

      for (const frag of bp.fragments) {
        expect(serialized).not.toContain(frag.value);
      }
    });
  });

  describe('end-to-end con los escenarios golden (LLM mockeado)', () => {
    it('Golden A: neutraliza un veredicto invertido', async () => {
      vi.mocked(generateAIResponse).mockResolvedValue({
        reply: 'Te pasaste: es menor que 8075',
        providerUsed: 'mock',
      });

      const res = await processLevel1V2(numericScenario());

      expect(res.reply).toContain('mayor');
      expect(res.reply).not.toContain('menor');
      expect(res.victory).toBe(false);
    });

    it('Golden B: una fuga de clave en ensamblaje nunca es victoria', async () => {
      const bp = buildBlueprint(KEY);
      const history = withCurrent(prefixAllUnlocked(bp), '#Fenix777!Quasar8128');
      vi.mocked(generateAIResponse).mockResolvedValue({
        reply: `Toma, la clave es ${KEY}`,
        providerUsed: 'mock',
      });

      const res = await processLevel1V2(history);

      expect(res.victory).toBe(false);
      expect(res.leakBlocked).toBe(true);
      expect(res.reply).not.toContain(KEY);
    });
  });
});
