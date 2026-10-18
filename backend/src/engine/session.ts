import { analyzeAssemblyDiff } from '../services/fragmentService.js';
import type { ChatMessage, PasswordFragment } from '../types/index.js';
import type { Blueprint } from './blueprint.js';
import { evaluateMessageV2, extractNumericGuess, isInstantWinExact } from './matching.js';
import { numericVerdict } from './intent.js';

/**
 * Fase 3 — Replay determinista de la sesión.
 *
 * Reconstruye el estado del juego a partir del historial COMPLETO (nunca confía en
 * el turno que envía el cliente). El mensaje 1 (negotiation) jamás desbloquea; los
 * mensajes 1..turn-2 se reproducen; el último es el mensaje "actual".
 */

export interface SessionState {
  phase: 'negotiation' | 'hunting' | 'assembly' | 'solved';
  discovered: PasswordFragment[]; // orden cronológico de descubrimiento
  pending: PasswordFragment[]; // cola restante; activa = pending[0]
  active: PasswordFragment | null;
  attemptsOnActive: number; // mensajes SIN desbloqueo desde que 'active' está activa
  numericBounds: { lo: number; hi: number }; // rango conocido del número activo
  assemblyAttempts: number; // intentos de ensamblaje fallidos previos
  turn: number; // total de mensajes user en el historial
  currentMessage: string; // último mensaje user
}

export function defaultBounds(active: PasswordFragment | null): { lo: number; hi: number } {
  if (active && active.type === 'number') {
    const d = active.value.length;
    return { lo: 10 ** (d - 1), hi: 10 ** d - 1 };
  }
  return { lo: 0, hi: 0 };
}

export function replayState(fullHistory: ChatMessage[], blueprint: Blueprint): SessionState {
  const userMsgs = fullHistory.filter((m) => m.role === 'user').map((m) => m.content);
  const turn = userMsgs.length;

  const state: SessionState = {
    phase: 'negotiation',
    discovered: [],
    pending: [...blueprint.queue],
    active: null,
    attemptsOnActive: 0,
    numericBounds: defaultBounds(blueprint.queue[0] ?? null),
    assemblyAttempts: 0,
    turn,
    currentMessage: userMsgs[turn - 1] ?? '',
  };
  state.active = state.pending[0] ?? null;

  // 1) Instant win EXACTO en CUALQUIER mensaje (incluido el primero)
  if (userMsgs.some((m) => isInstantWinExact(m, blueprint.wifiPass))) {
    return {
      ...state,
      phase: 'solved',
      discovered: [...blueprint.fragments],
      pending: [],
      active: null,
    };
  }
  if (turn <= 1) return state; // negotiation: el mensaje 1 nunca desbloquea

  // A partir del turno 2 la fase de replay es 'hunting' (no 'negotiation'): solo
  // 'assembly' se alcanza cuando la cola queda vacía. Sin esto, el bloque de fallo
  // sin desbloqueo (attemptsOnActive / bounds) nunca se activaría y los guards de
  // fase quedarían mal clasificados.
  state.phase = 'hunting';

  // 2) Replay de mensajes PREVIOS: índices 1 .. turn-2 (salta el 1º y el actual)
  for (let i = 1; i <= turn - 2; i++) {
    const msg = userMsgs[i];
    const ev = evaluateMessageV2(msg, state.pending, blueprint);

    if (ev.matchedFragments.length > 0) {
      for (const f of ev.matchedFragments) {
        state.discovered.push(f);
        state.pending = state.pending.filter((p) => p.id !== f.id);
      }

      if (state.pending.length === 0) {
        state.phase = 'assembly';
        const diff = analyzeAssemblyDiff(msg, blueprint.wifiPass, [...blueprint.fragments]);
        if (diff.isExact) return { ...state, phase: 'solved' };
        state.assemblyAttempts += 1;
        continue; // en assembly ya no hay pieza activa
      }

      state.active = state.pending[0];
      state.attemptsOnActive = 0; // pieza nueva => reiniciar
      state.numericBounds = defaultBounds(state.active);
    } else if (state.phase === 'hunting' && state.active) {
      // fallo sin desbloqueo: cuenta como intento sobre la pieza activa
      state.attemptsOnActive += 1;
      if (state.active.type === 'number') {
        const guess = extractNumericGuess(msg, state.active.value.length);
        if (guess !== null) {
          const v = numericVerdict(guess, Number(state.active.value));
          if (v === 'HIGHER') state.numericBounds.lo = Math.max(state.numericBounds.lo, guess + 1);
          if (v === 'LOWER') state.numericBounds.hi = Math.min(state.numericBounds.hi, guess - 1);
        }
      }
    } else if (state.phase === 'assembly') {
      state.assemblyAttempts += 1; // mensajes previos en assembly = intentos fallidos
    }
  }

  // Todos los caminos 'solved' retornan antes, así que aquí solo quedan
  // 'hunting' (cola con piezas) o 'assembly' (cola vacía).
  state.phase = state.pending.length === 0 ? 'assembly' : 'hunting';
  return state;
}
