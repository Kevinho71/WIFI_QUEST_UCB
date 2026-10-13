import 'dotenv/config';
import { ChatMessage, AIProviderResult } from '../types/index.js';

export interface AIProviderConfig {
  name: string;
  model: string;
  getUrl: () => string;
  getHeaders: () => Record<string, string>;
  isEnabled: () => boolean;
}

/**
 * Tres proveedores OpenAI-compatibles. Round-robin rota el inicial;
 * si uno falla (sin key, 429, 5xx, red o timeout >4500ms) se salta al siguiente.
 */
const providers: AIProviderConfig[] = [
  {
    name: 'Groq',
    model: 'llama-3.1-8b-instant',
    getUrl: () => 'https://api.groq.com/openai/v1/chat/completions',
    getHeaders: () => ({
      Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}`,
    }),
    isEnabled: () => Boolean(process.env.GROQ_API_KEY),
  },
  {
    name: 'Cloudflare',
    model: '@cf/meta/llama-3.1-8b-instruct-fast',
    getUrl: () => {
      const accountId = process.env.CF_ACCOUNT_ID || '';
      return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    },
    getHeaders: () => ({
      Authorization: `Bearer ${process.env.CF_API_KEY || ''}`,
    }),
    isEnabled: () =>
      Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_KEY),
  },
  {
    name: 'Gemini',
    model: 'gemini-2.5-flash',
    getUrl: () =>
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    getHeaders: () => ({
      Authorization: `Bearer ${process.env.GEMINI_API_KEY || ''}`,
    }),
    isEnabled: () => Boolean(process.env.GEMINI_API_KEY),
  },
];

let roundRobinCounter = 0;

export function getRoundRobinCounter(): number {
  return roundRobinCounter;
}

export function resetRoundRobinCounter(): void {
  roundRobinCounter = 0;
}

async function callProvider(
  provider: AIProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!provider.isEnabled()) {
    throw new Error(
      `Credenciales no configuradas para el proveedor ${provider.name}`
    );
  }

  const payload = {
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
    temperature: 0.6,
    max_tokens: 220,
  };

  const response = await fetch(provider.getUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...provider.getHeaders(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4500),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `Error HTTP ${response.status} en ${provider.name}: ${errorBody.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    result?: { response?: string };
  };

  const reply =
    data?.choices?.[0]?.message?.content?.trim() ||
    data?.result?.response?.trim();

  if (!reply) {
    throw new Error(`Respuesta vacía devuelta por ${provider.name}`);
  }

  return reply;
}

/**
 * Round-robin entre Groq → Cloudflare → Gemini con fallback automático.
 */
export async function generateAIResponse(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<AIProviderResult> {
  const total = providers.length;
  const startIndex = Math.abs(roundRobinCounter) % total;
  roundRobinCounter = (roundRobinCounter + 1) % total;

  const queue: AIProviderConfig[] = [];
  for (let i = 0; i < total; i++) {
    queue.push(providers[(startIndex + i) % total]);
  }

  const errors: string[] = [];

  for (const provider of queue) {
    if (!provider.isEnabled()) {
      const msg = `${provider.name}: API key / cuenta no configurada en .env`;
      console.warn(`⚠️ [Multi-IA Fallback] ${msg}. Saltando...`);
      errors.push(msg);
      continue;
    }

    try {
      const reply = await callProvider(provider, systemPrompt, messages);
      return {
        reply,
        providerUsed: provider.name,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `⚠️ [Multi-IA Fallback] Falló proveedor ${provider.name}: ${errorMsg}. Reintentando con el siguiente...`
      );
      errors.push(`${provider.name}: ${errorMsg}`);
    }
  }

  throw new Error(
    `Todos los proveedores de IA fallaron después de reintentar. Detalles: [${errors.join(' | ')}]`
  );
}
