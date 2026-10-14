import 'dotenv/config';
import { ChatMessage, AIProviderResult } from '../types/index.js';

// Cargar variables de entorno desde .env local o monorepo
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {}
  try {
    process.loadEnvFile('backend/.env');
  } catch {}
}

export interface AIProviderConfig {
  name: string;
  getModel: () => string;
  getUrl: () => string;
  getHeaders: () => Record<string, string>;
  isEnabled: () => boolean;
  isCloudflareRunApi?: boolean;
}

/**
 * Tres proveedores de IA en esquema Round-Robin con Fallback automático.
 * Modelos configurables mediante variables de entorno:
 * - GROQ_MODEL (por defecto: llama-3.1-8b-instant)
 * - CF_MODEL (por defecto: @cf/meta/llama-3.1-8b-instruct-fp8)
 * - GEMINI_MODEL (por defecto: gemini-3.1-flash-lite)
 */
export const providers: AIProviderConfig[] = [
  {
    name: 'Groq',
    getModel: () => process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
    getUrl: () => 'https://api.groq.com/openai/v1/chat/completions',
    getHeaders: () => ({
      Authorization: `Bearer ${process.env.GROQ_API_KEY || ''}`,
    }),
    isEnabled: () => Boolean(process.env.GROQ_API_KEY),
  },
  {
    name: 'Cloudflare',
    getModel: () =>
      process.env.CF_MODEL ||
      process.env.CLOUDFLARE_MODEL ||
      '@cf/meta/llama-3.1-8b-instruct-fp8',
    getUrl: () => {
      const accountId = process.env.CF_ACCOUNT_ID || '';
      const model =
        process.env.CF_MODEL ||
        process.env.CLOUDFLARE_MODEL ||
        '@cf/meta/llama-3.1-8b-instruct-fp8';
      return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    },
    getHeaders: () => ({
      Authorization: `Bearer ${
        process.env.CF_API_KEY || process.env.CLOUDFLARE_API_KEY || ''
      }`,
    }),
    isEnabled: () =>
      Boolean(
        process.env.CF_ACCOUNT_ID &&
          (process.env.CF_API_KEY || process.env.CLOUDFLARE_API_KEY)
      ),
    isCloudflareRunApi: true,
  },
  {
    name: 'Gemini',
    getModel: () => process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
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

  const model = provider.getModel();

  // Cloudflare ai/run recibe el payload directamente con messages
  const payload = provider.isCloudflareRunApi
    ? {
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        max_tokens: 350,
        temperature: 0.6,
      }
    : {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        temperature: 0.6,
        max_tokens: 350,
      };

  const response = await fetch(provider.getUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...provider.getHeaders(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    // Fallback inteligente en Groq si llama-3.1-8b-instant no está en la región/cuenta
    if (
      provider.name === 'Groq' &&
      response.status === 404 &&
      errorBody.includes('model_not_found') &&
      model === 'llama-3.1-8b-instant'
    ) {
      console.warn(
        `⚠️ [Groq] 'llama-3.1-8b-instant' devolvió 404. Reintentando con 'qwen/qwen3.8-27b'...`
      );
      try {
        const fallbackResp = await fetch(provider.getUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...provider.getHeaders(),
          },
          body: JSON.stringify({
            ...payload,
            model: 'qwen/qwen3.8-27b',
          }),
          signal: AbortSignal.timeout(4500),
        });

        if (fallbackResp.ok) {
          const fbData = (await fallbackResp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const fbReply = fbData?.choices?.[0]?.message?.content?.trim();
          if (fbReply) return fbReply;
        }
      } catch (fbErr) {
        console.warn(`⚠️ [Groq] Fallback secundario también falló:`, fbErr);
      }
    }

    throw new Error(
      `Error HTTP ${response.status} en ${provider.name}: ${errorBody.slice(0, 250)}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    result?: { response?: string };
    success?: boolean;
    errors?: Array<{ message?: string }>;
  };

  if (data.success === false && data.errors?.length) {
    throw new Error(
      `Error devuelto por ${provider.name}: ${data.errors[0]?.message || 'Desconocido'}`
    );
  }

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
  // Logging visible en consola del prompt inyectado a cada llamada
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ 🤖 [LLM REQUEST] LLAMADA A LA IA                                            ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log('📌 SYSTEM PROMPT INYECTADO:');
  console.log(systemPrompt);
  console.log('────────────────────────────────────────────────────────────────────────────────');
  console.log('💬 MENSAJES ENVIADOS AL MODELO:');
  if (!messages || messages.length === 0) {
    console.log('  (Sin mensajes previos)');
  } else {
    messages.forEach((m, idx) => {
      console.log(`  [${idx + 1}] ${m.role.toUpperCase()}: ${m.content}`);
    });
  }
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

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
      console.log(`✨ [LLM RESPONSE (${provider.name}:${provider.getModel()})]:\n${reply}\n`);
      return {
        reply,
        providerUsed: `${provider.name}:${provider.getModel()}`,
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
