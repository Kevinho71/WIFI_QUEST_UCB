import { generateAIResponse, type AIResponseOptions } from '../services/aiProvider.js';
import type {
  AIProviderResult,
  ChatMessage,
  DiscoveredFragmentDTO,
  GameStateDTO,
  PasswordFragment,
  SecurityLevelResult,
} from '../types/index.js';
import { getBlueprint } from './blueprint.js';
import type { Blueprint } from './blueprint.js';
import { deriveEvent } from './events.js';
import type { TurnEvent } from './events.js';
import { applyReplyCorrections, validateReply } from './guards.js';
import type { GuardContext } from './guards.js';
import { buildPrompt } from './prompts.js';
import { replayState } from './session.js';
import type { SessionState } from './session.js';
import { renderTemplate } from './templates.js';

/**
 * Fase 6 — Orquestador del motor Nivel 1 v2 (PLAN_MOTOR_V2 §6.10).
 *
 * Une todo el pipeline: replay → evento → prompt → LLM → guardas (reintento +
 * plantilla) → respuesta. El backend decide TODO; el LLM solo redacta.
 */

/** Pista descriptiva del reto en curso (misma lógica que `getChallengeHint` de v1). */
function challengeHint(active: PasswordFragment | null, phase: SessionState['phase']): string {
  if (phase === 'negotiation') return 'Rompe el hielo con Lucas (envía una excusa o chiste)';
  if (phase === 'assembly') return '¡Gran Ensamblaje! Deduce el orden exacto de los fragmentos';
  if (phase === 'solved') return '¡Contraseña descifrada! Acceso total concedido';
  if (!active) return 'Descubre los fragmentos de la clave';
  if (active.type === 'number') return `Reto: Cifra ${active.value.length} Dígitos`;
  if (active.type === 'word') return `Reto: Palabra ${active.value.length} Letras`;
  return 'Reto: Símbolo Especial';
}

function buildGameState(
  state0: SessionState,
  state: SessionState,
  event: TurnEvent,
  blueprint: Blueprint
): GameStateDTO {
  const beforeIds = new Set(state0.discovered.map((f) => f.id));
  const newlyUnlocked =
    event.type === 'piece_hit' || event.type === 'last_piece'
      ? state.discovered.filter((f) => !beforeIds.has(f.id))
      : [];

  const unlockedFragments: DiscoveredFragmentDTO[] = state.discovered.map((f, i) => ({
    id: f.id,
    orderDiscovered: i + 1,
    value: f.value,
    type: f.type,
  }));

  return {
    phase: state.phase,
    totalFragments: blueprint.fragments.length,
    discoveredCount: state.discovered.length,
    currentChallengeHint: challengeHint(state.active, state.phase),
    unlockedFragments,
    justUnlockedFragment: newlyUnlocked.length
      ? newlyUnlocked.map((f) => f.value).join(', ')
      : undefined,
    isCombo: event.type === 'piece_hit' ? event.kind === 'combo' : undefined,
    assemblyDiffAdvice: event.type === 'assembly_diff' ? event.diagnosis : undefined,
  };
}

interface CheckedReply {
  ok: boolean;
  corrected: string;
  reason?: string;
  leak?: boolean;
}

/** Corrección automática (paso 1) + guardas duras (paso 2); vacío ⇒ inválido. */
function checkReply(raw: string, ctx: GuardContext): CheckedReply {
  const corrected = applyReplyCorrections(raw);
  if (!corrected.trim()) return { ok: false, corrected, reason: 'respuesta vacía' };
  const verdict = validateReply(corrected, ctx);
  return verdict.ok
    ? { ok: true, corrected }
    : { ok: false, corrected, reason: verdict.reason, leak: verdict.leak };
}

async function safeGenerate(
  systemPrompt: string,
  messages: ChatMessage[],
  options: AIResponseOptions
): Promise<AIProviderResult | null> {
  try {
    return await generateAIResponse(systemPrompt, messages, options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [orchestrator v2] La generación falló: ${msg}`);
    return null;
  }
}

export async function processLevel1V2(
  messages: ChatMessage[],
  _userTurnNumber?: number, // IGNORADO: el turno se deriva del historial
  fullHistory?: ChatMessage[]
): Promise<SecurityLevelResult & { victory?: boolean; leakBlocked?: boolean }> {
  const blueprint = getBlueprint();
  const history = fullHistory && fullHistory.length ? fullHistory : messages;

  const state0 = replayState(history, blueprint);
  const { event, stateAfter } = deriveEvent(state0, blueprint);
  const prompt = buildPrompt(event, stateAfter, history, blueprint);

  const guardCtx: GuardContext = {
    phase: stateAfter.phase,
    event,
    userMessage: stateAfter.currentMessage,
    datosBlock: prompt.datosBlock,
    blueprint,
    pending: stateAfter.pending,
  };

  let reply = '';
  let provider = 'engine-template';
  let leakBlocked = false;

  const attempt1 = await safeGenerate(prompt.systemPrompt, prompt.messagesForAI, {
    temperature: prompt.temperature,
    maxTokens: prompt.maxTokens,
  });

  if (attempt1) {
    const first = checkReply(attempt1.reply, guardCtx);
    if (first.ok) {
      reply = first.corrected;
      provider = attempt1.providerUsed;
    } else {
      if (first.leak) leakBlocked = true;

      const correction = `\nCORRECCIÓN: tu respuesta anterior fue inválida porque ${first.reason}. Reescribila cumpliendo DATOS DEL SISTEMA.`;
      const attempt2 = await safeGenerate(prompt.systemPrompt + correction, prompt.messagesForAI, {
        temperature: 0.2,
        maxTokens: prompt.maxTokens,
      });

      if (attempt2) {
        const second = checkReply(attempt2.reply, guardCtx);
        if (second.ok) {
          reply = second.corrected;
          provider = attempt2.providerUsed;
        } else if (second.leak) {
          leakBlocked = true;
        }
      }
    }
  }

  if (!reply) {
    reply = renderTemplate(event, blueprint);
    provider = 'engine-template';
  }

  const gameState = buildGameState(state0, stateAfter, event, blueprint);
  const solved = stateAfter.phase === 'solved';

  return {
    reply,
    leakDetected: solved, // compat con el frontend actual
    victory: solved, // SOLO victoria legítima (enviar la clave exacta)
    leakBlocked, // una fuga interceptada nunca es victoria
    blockedByFirewall: false,
    provider,
    gameState,
  };
}
