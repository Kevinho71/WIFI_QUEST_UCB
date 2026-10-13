import 'dotenv/config';
import { ChatMessage, AIProviderResult } from '../types/index.js';

export interface AIProviderConfig {
  name: string;
  getUrl: () => string;
  getHeaders: () => Record<string, string>;
  models: string[];
  isEnabled: () => boolean;
}

const providers: AIProviderConfig[] = [
  {
    name: 'Groq',
    getUrl: () => 'https://api.groq.com/openai/v1/chat/completions',
    getHeaders: () => ({
      Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}`,
    }),
    models: [
      process.env.GROQ_MODEL || '',
      'llama-3.1-8b-instant',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
    ].filter(Boolean),
    isEnabled: () => Boolean(process.env.GROQ_API_KEY),
  },
  {
    name: 'Cloudflare',
    getUrl: () => {
      const accountId = process.env.CF_ACCOUNT_ID || '';
      return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
    },
    getHeaders: () => ({
      Authorization: `Bearer ${process.env.CF_API_KEY || process.env.CLOUDFLARE_API_KEY || ''}`,
    }),
    models: [
      process.env.CF_MODEL || '',
      '@cf/meta/llama-3.1-8b-instruct-fast',
    ].filter(Boolean),
    isEnabled: () =>
      Boolean(
        process.env.CF_ACCOUNT_ID &&
          (process.env.CF_API_KEY || process.env.CLOUDFLARE_API_KEY)
      ),
  },
  {
    name: 'Gemini',
    getUrl: () =>
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    getHeaders: () => ({
      Authorization: `Bearer ${process.env.GEMINI_API_KEY || ''}`,
    }),
    models: [
      process.env.GEMINI_MODEL || '',
      'gemini-2.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
    ].filter(Boolean),
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

/**
 * Llama a un proveedor de IA específico con timeout estricto de 4500ms
 */
async function callProvider(
  provider: AIProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!provider.isEnabled()) {
    throw new Error(`Credenciales o variables no configuradas para el proveedor ${provider.name}`);
  }

  const url = provider.getUrl();
  const headers = {
    'Content-Type': 'application/json',
    ...provider.getHeaders(),
  };

  let lastModelError: Error | null = null;

  for (const model of provider.models) {
    const payload = {
      model,
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

    const signal = AbortSignal.timeout(4500);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        // Si el modelo específico no existe o está saturado, probar el siguiente modelo del proveedor
        if (
          response.status === 404 ||
          response.status === 503 ||
          errorBody.includes('model_not_found') ||
          errorBody.includes('not available')
        ) {
          lastModelError = new Error(
            `Modelo ${model} no disponible en ${provider.name} (${response.status})`
          );
          continue;
        }

        throw new Error(
          `Error HTTP ${response.status} en ${provider.name}: ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as any;
      const reply =
        data?.choices?.[0]?.message?.content?.trim() ||
        data?.result?.response?.trim();

      if (!reply) {
        throw new Error(`Respuesta vacía devuelta por ${provider.name}`);
      }

      return reply;
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
        throw err;
      }
      lastModelError = err;
    }
  }

  throw lastModelError || new Error(`No se pudo generar respuesta con ${provider.name}`);
}

/**
 * Genera una respuesta de IA rotando proveedores en Round-Robin
 * con fallback automático ante errores (429, 5xx, timeout >4500ms o red).
 */
export async function generateAIResponse(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<AIProviderResult> {
  const total = providers.length;
  const startIndex = Math.abs(roundRobinCounter) % total;
  roundRobinCounter = (roundRobinCounter + 1) % total;

  // Cola ordenada por round-robin comenzando por startIndex
  const queue: AIProviderConfig[] = [];
  for (let i = 0; i < total; i++) {
    queue.push(providers[(startIndex + i) % total]);
  }

  const errors: string[] = [];

  for (const provider of queue) {
    try {
      const reply = await callProvider(provider, systemPrompt, messages);
      return {
        reply,
        providerUsed: provider.name,
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
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
