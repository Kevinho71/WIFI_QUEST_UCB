import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processLevel1 } from '../src/services/securityLevels.js';
import * as aiProviderModule from '../src/services/aiProvider.js';
import { clearPasswordMetaCache } from '../src/services/securityLevels.js';
import { ChatMessage } from '../src/types/index.js';

describe('Fase 3: Pipeline End-to-End de Desbloqueo Secuencial (pipeline.test.ts)', () => {
  const originalEnv = process.env.WIFI_PASS;

  beforeEach(() => {
    clearPasswordMetaCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.WIFI_PASS = originalEnv;
    } else {
      delete process.env.WIFI_PASS;
    }
  });

  it('1. Victoria inmediata con clave simple (admin123)', async () => {
    process.env.WIFI_PASS = 'admin123';

    vi.spyOn(aiProviderModule, 'generateAIResponse').mockResolvedValueOnce({
      reply: '¡GG! Me ganaste crack, la clave es admin123',
      providerUsed: 'mock-test',
    });

    const messages: ChatMessage[] = [
      { role: 'user', content: 'la clave es admin123' },
    ];

    const result = await processLevel1(messages, 1);

    expect(result.leakDetected).toBe(true);
    expect(result.gameState).toBeDefined();
    expect(result.gameState?.phase).toBe('solved');
    expect(result.gameState?.totalFragments).toBe(2);
    expect(result.gameState?.discoveredCount).toBe(2);
    expect(result.gameState?.unlockedFragments.map((f) => f.value)).toEqual(['admin', '123']);
    expect(result.reply).toContain('admin123');
  });

  it('2. Combos oportunos con admin123administrador', async () => {
    process.env.WIFI_PASS = 'admin123administrador';

    vi.spyOn(aiProviderModule, 'generateAIResponse').mockResolvedValueOnce({
      reply: '¡Upa combo doble crack! Le pegaste a admin y 123. Ahora dime la última pieza.',
      providerUsed: 'mock-test',
    });

    // Turno 1 rompió hielo, Turno 2 acierta combo
    const messages: ChatMessage[] = [
      { role: 'user', content: 'hola que tal Lucas' },
      { role: 'assistant', content: 'hola cuentame un chiste' },
      { role: 'user', content: '¿Acaso la clave tiene 123 o admin?' },
    ];

    const result = await processLevel1(messages, 2);

    expect(result.gameState).toBeDefined();
    expect(result.gameState?.phase).toBe('hunting');
    expect(result.gameState?.isCombo).toBe(true);
    expect(result.gameState?.totalFragments).toBe(3);
    expect(result.gameState?.discoveredCount).toBe(2);

    const discoveredVals = result.gameState?.unlockedFragments.map((f) => f.value);
    expect(discoveredVals).toContain('admin');
    expect(discoveredVals).toContain('123');
    expect(discoveredVals).not.toContain('administrador');
  });

  it('3. Descarte de falsos positivos (admin dentro de administrador)', async () => {
    process.env.WIFI_PASS = 'admin123administrador';

    vi.spyOn(aiProviderModule, 'generateAIResponse').mockResolvedValueOnce({
      reply: '¡Buena jugada! Le pegaste a la pieza larga administrador.',
      providerUsed: 'mock-test',
    });

    const messages: ChatMessage[] = [
      { role: 'user', content: 'hola Lucas' },
      { role: 'assistant', content: 'rompe el hielo primero' },
      { role: 'user', content: 'mi propuesta es administrador' },
    ];

    const result = await processLevel1(messages, 2);

    expect(result.gameState).toBeDefined();
    expect(result.gameState?.isCombo).toBe(false);
    expect(result.gameState?.discoveredCount).toBe(1);

    const discoveredVals = result.gameState?.unlockedFragments.map((f) => f.value);
    expect(discoveredVals).toEqual(['administrador']);
    // admin NO fue desbloqueado por error
    expect(discoveredVals).not.toContain('admin');
  });

  it('4. Diagnóstico preciso del evaluador de diffs en fase de ensamblaje', async () => {
    process.env.WIFI_PASS = 'kevin4000#@505#123';

    // Simular que el usuario ya descubrió todos los fragmentos en turnos previos
    // y en el turno actual envía un intento con símbolos invertidos: kevin4000@#505#123
    const priorHistory: ChatMessage[] = [
      { role: 'user', content: 'chiste inicial' },
      { role: 'assistant', content: 'jaja bueno' },
      // Descubrir todas las piezas
      { role: 'user', content: 'kevin 4000 # @ 505 # 123 pero desordenado' },
      { role: 'assistant', content: '¡Tienes todas las piezas! Ensámblalas en el orden exacto.' },
      // Intento de ensamblaje con símbolos invertidos
      { role: 'user', content: 'kevin4000@#505#123' },
    ];

    let capturedDirective = '';
    vi.spyOn(aiProviderModule, 'generateAIResponse').mockImplementation(async (prompt) => {
      capturedDirective = prompt;
      return {
        reply: 'Casi lo tienes crack, pero revisa los simbolos @ y #.',
        providerUsed: 'mock-test',
      };
    });

    const result = await processLevel1(priorHistory, 3);

    expect(result.gameState).toBeDefined();
    expect(result.gameState?.phase).toBe('assembly');
    expect(result.gameState?.discoveredCount).toBe(7);
    expect(result.gameState?.assemblyDiffAdvice).toBeDefined();
    expect(result.gameState?.assemblyDiffAdvice).toContain('están invertidas o en orden incorrecto');
    expect(result.gameState?.assemblyDiffAdvice).toContain('@');
    expect(result.gameState?.assemblyDiffAdvice).toContain('#');
    expect(result.leakDetected).toBe(false);

    // Verificar que la directiva al LLM contenga el diagnóstico quirúrgico
    expect(capturedDirective).toContain('DIRECTIVA DE FASE FINAL: EL GRAN ENSAMBLAJE');
    expect(capturedDirective).toContain('DIAGNÓSTICO QUIRÚRGICO DEL INTENTO PREVIO');
  });

  it('5. Seguridad estricta: unlockedFragments jamás expone fragmentos pendientes', async () => {
    process.env.WIFI_PASS = 'kevin4000#@505#123';

    vi.spyOn(aiProviderModule, 'generateAIResponse').mockResolvedValueOnce({
      reply: '¡Encontraste kevin!',
      providerUsed: 'mock-test',
    });

    const messages: ChatMessage[] = [
      { role: 'user', content: 'chiste' },
      { role: 'assistant', content: 'bien' },
      { role: 'user', content: 'es kevin' },
    ];

    const result = await processLevel1(messages, 2);

    expect(result.gameState).toBeDefined();
    expect(result.gameState?.totalFragments).toBe(7);
    expect(result.gameState?.discoveredCount).toBe(1);
    expect(result.gameState?.unlockedFragments).toHaveLength(1);
    expect(result.gameState?.unlockedFragments[0].value).toBe('kevin');

    // Comprobar que ninguna otra pieza sin descubrir viaje en el JSON
    const valuesInDTO = result.gameState?.unlockedFragments.map((f) => f.value);
    expect(valuesInDTO).not.toContain('4000');
    expect(valuesInDTO).not.toContain('505');
    expect(valuesInDTO).not.toContain('123');
    expect(valuesInDTO).not.toContain('@');
  });
});
