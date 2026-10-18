import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAIResponse, resetRoundRobinCounter } from '../src/services/aiProvider.js';

/**
 * Fase 6 — Opciones de generación en aiProvider (PLAN_MOTOR_V2 §7.2).
 * `fetch` global mockeado; nunca se llama a una IA real.
 */

function jsonResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => '',
  };
}

describe('aiProvider: opciones {temperature, maxTokens} y strip de <think>', () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-groq-key';
    resetRoundRobinCounter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('inyecta temperature y max_tokens en el payload y elimina el bloque de razonamiento', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: { body: string }) =>
      jsonResponse('<think>razonando...</think>Hola, crack')
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await generateAIResponse('system', [{ role: 'user', content: 'hola' }], {
      temperature: 0.25,
      maxTokens: 160,
    });

    expect(res.reply).toBe('Hola, crack');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body.temperature).toBe(0.25);
    expect(body.max_tokens).toBe(160);
    expect(body.model).toBeTruthy();
  });

  it('usa los defaults 0.6 / 350 cuando no se pasan opciones', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => jsonResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await generateAIResponse('system', [{ role: 'user', content: 'hola' }]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<string, unknown>;
    expect(body.temperature).toBe(0.6);
    expect(body.max_tokens).toBe(350);
  });
});
