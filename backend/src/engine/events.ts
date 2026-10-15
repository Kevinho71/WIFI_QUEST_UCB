import { analyzeAssemblyDiff } from '../services/fragmentService.js';
import type { PasswordFragment } from '../types/index.js';
import type { Blueprint } from './blueprint.js';
import { angleLevel } from './blueprint.js';
import type { SessionState } from './session.js';
import { defaultBounds } from './session.js';
import {
  countWellPlaced,
  evaluateMessageV2,
  extractNumericGuess,
  isInstantWinExact,
} from './matching.js';
import {
  classifyIntent,
  classifyNumericProperty,
  numericFact,
  numericVerdict,
  proximity,
} from './intent.js';

/**
 * Fase 4 — Eventos de turno deterministas.
 *
 * `deriveEvent` evalúa el MENSAJE ACTUAL sobre el estado devuelto por el replay y
 * produce un `TurnEvent` (lo único que el LLM necesita para redactar) y el
 * `stateAfter` mutado. Prioridad EXACTA (PLAN_MOTOR_V2 §6.6):
 *   1. instant win exacto  2. rompehielo (turno 1)  3. hunting  4. assembly.
 */

export type PieceHitKind = 'normal' | 'combo' | 'out_of_turn';
export type ProximityLabel = 'CALIENTE' | 'TIBIA' | 'FRÍA';

export type TurnEvent =
  | { type: 'rompehielo' }
  | { type: 'first_challenge'; activeLabel: string; activeAngle: string | null }
  | {
      type: 'numeric_guess';
      guess: number;
      verdict: 'HIGHER' | 'LOWER';
      proximity: ProximityLabel;
    }
  | {
      type: 'word_riddle';
      word: string;
      letters: number;
      attempts: number;
      level: 1 | 2 | 3;
      angle: string;
      typed: string;
    }
  | {
      type: 'symbol_riddle';
      attempts: number;
      level: 1 | 2 | 3;
      angle: string;
      typed: string;
    }
  | {
      type: 'piece_hit';
      kind: PieceHitKind;
      typed: string;
      remaining: number;
      nextLabel: string;
      nextAngle: string | null;
    }
  | { type: 'last_piece'; total: number }
  | {
      type: 'assembly_diff';
      diagnosis: string;
      wellPlaced: number;
      total: number;
      level: 1 | 2 | 3;
      orderHint: string;
    }
  | { type: 'ask_length'; dato: string }
  | { type: 'ask_property'; factText: string }
  | { type: 'ask_future'; activeDesc: string }
  | { type: 'ask_category' }
  | { type: 'ask_mask' }
  | { type: 'chitchat'; activeDesc: string }
  | { type: 'victory' };

/** "una palabra de N letras" | "un número de D dígitos" | "un símbolo" (tipo y tamaño). */
export function describePiece(frag: PasswordFragment | null): string {
  if (!frag) return 'la pieza en juego';
  if (frag.type === 'word') return `una palabra de ${frag.value.length} letras`;
  if (frag.type === 'number') return `un número de ${frag.value.length} dígitos`;
  return 'un símbolo';
}

/** "palabra de N letras" | "número de D dígitos" | "símbolo especial" (etiqueta de reto). */
export function challengeLabel(frag: PasswordFragment): string {
  if (frag.type === 'word') return `palabra de ${frag.value.length} letras`;
  if (frag.type === 'number') return `número de ${frag.value.length} dígitos`;
  return 'símbolo especial';
}

/** Solo el TIPO: "una palabra" | "un número" | "un símbolo". */
function pieceType(frag: PasswordFragment): string {
  if (frag.type === 'word') return 'una palabra';
  if (frag.type === 'number') return 'un número';
  return 'un símbolo';
}

/** Ángulo preescrito (índice 0 = nivel 1). `null` para números. */
function angleForPiece(
  frag: PasswordFragment,
  blueprint: Blueprint,
  levelIndex: number
): string | null {
  if (frag.type === 'number') return null;
  return blueprint.info.get(frag.id)?.angles[levelIndex] ?? null;
}

export function orderHintLevel(attempts: number): 1 | 2 | 3 {
  if (attempts >= 6) return 3;
  if (attempts >= 3) return 2;
  return 1;
}

/** Pistas de orden progresivas, SIN valores ni la secuencia completa. */
export function buildOrderHint(attempts: number, blueprint: Blueprint): string {
  const frags = blueprint.fragments;
  const total = frags.length;
  const words = frags.filter((f) => f.type === 'word').length;
  const numbers = frags.filter((f) => f.type === 'number').length;
  const symbols = frags.filter((f) => f.type === 'symbol').length;

  let hint =
    `Tu mochila tiene ${total} piezas: ${words} palabras, ${numbers} números y ` +
    `${symbols} símbolos. La primera pieza de la clave es ${pieceType(frags[0])}.`;

  const level = orderHintLevel(attempts);
  if (level >= 2) {
    hint += ` La última pieza de la clave es ${pieceType(frags[total - 1])}.`;
  }
  if (level >= 3 && total > 2) {
    const i = 2 + (attempts % (total - 2));
    hint += ` Pista extra: la pieza ${i} es ${describePiece(frags[i - 1])}.`;
  }
  return hint;
}

function lengthDato(current: string, active: PasswordFragment | null, blueprint: Blueprint): string {
  if (/clave|completa|total/i.test(current)) {
    return `la clave completa tiene ${blueprint.totalLength} caracteres`;
  }
  if (!active) return 'es un símbolo';
  if (active.type === 'word') return `${active.value.length} letras`;
  if (active.type === 'number') return `${active.value.length} dígitos`;
  return 'es un símbolo';
}

export function deriveEvent(
  state0: SessionState,
  blueprint: Blueprint
): { event: TurnEvent; stateAfter: SessionState } {
  const state: SessionState = {
    ...state0,
    discovered: [...state0.discovered],
    pending: [...state0.pending],
  };
  const current = state.currentMessage;

  // 1) Instant win EXACTO
  if (isInstantWinExact(current, blueprint.wifiPass)) {
    state.phase = 'solved';
    state.discovered = [...blueprint.fragments];
    state.pending = [];
    state.active = null;
    return { event: { type: 'victory' }, stateAfter: state };
  }

  // 2) Negotiation (turno 1)
  if (state.turn <= 1) {
    state.phase = 'negotiation';
    return { event: { type: 'rompehielo' }, stateAfter: state };
  }

  // 3) Hunting
  if (state.pending.length > 0) {
    const ev = evaluateMessageV2(current, state.pending, blueprint);

    if (ev.matchedFragments.length > 0) {
      for (const f of ev.matchedFragments) {
        state.discovered.push(f);
        state.pending = state.pending.filter((p) => p.id !== f.id);
      }
      const typed = ev.matchedFragments.map((f) => f.value).join(' ');

      if (state.pending.length === 0) {
        state.phase = 'assembly';
        const diff = analyzeAssemblyDiff(current, blueprint.wifiPass, [...blueprint.fragments]);
        if (diff.isExact) {
          state.phase = 'solved';
          return { event: { type: 'victory' }, stateAfter: state };
        }
        state.assemblyAttempts += 1;
        return {
          event: { type: 'last_piece', total: blueprint.fragments.length },
          stateAfter: state,
        };
      }

      state.active = state.pending[0];
      state.attemptsOnActive = 0;
      state.numericBounds = defaultBounds(state.active);
      const kind: PieceHitKind = ev.activeFragmentMatched
        ? ev.isCombo
          ? 'combo'
          : 'normal'
        : 'out_of_turn';

      return {
        event: {
          type: 'piece_hit',
          kind,
          typed,
          remaining: state.pending.length,
          nextLabel: challengeLabel(state.active),
          nextAngle: angleForPiece(state.active, blueprint, 0),
        },
        stateAfter: state,
      };
    }

    // 3c) Sin matches: turn===2 SIEMPRE presenta el primer reto
    const active = state.active;
    if (state.turn === 2) {
      return {
        event: active
          ? {
              type: 'first_challenge',
              activeLabel: challengeLabel(active),
              activeAngle: angleForPiece(active, blueprint, 0),
            }
          : { type: 'chitchat', activeDesc: describePiece(active) },
        stateAfter: state,
      };
    }

    const intent = classifyIntent(current);
    if (intent === 'ask_mask') return { event: { type: 'ask_mask' }, stateAfter: state };
    if (intent === 'ask_category') return { event: { type: 'ask_category' }, stateAfter: state };
    if (intent === 'ask_future') {
      return { event: { type: 'ask_future', activeDesc: describePiece(active) }, stateAfter: state };
    }
    if (intent === 'ask_length') {
      return {
        event: { type: 'ask_length', dato: lengthDato(current, active, blueprint) },
        stateAfter: state,
      };
    }
    if (intent === 'ask_property' && active && active.type === 'number') {
      const prop = classifyNumericProperty(current);
      if (prop) {
        return {
          event: { type: 'ask_property', factText: numericFact(prop, active.value) },
          stateAfter: state,
        };
      }
    }

    // Pieza activa NUMÉRICA: tirada mayor/menor
    if (active && active.type === 'number') {
      const guess = extractNumericGuess(current, active.value.length);
      if (guess !== null) {
        const verdict = numericVerdict(guess, Number(active.value));
        const prox = proximity(
          Number(active.value),
          guess,
          state.numericBounds.lo,
          state.numericBounds.hi
        );
        if (verdict === 'HIGHER') {
          state.numericBounds.lo = Math.max(state.numericBounds.lo, guess + 1);
        }
        if (verdict === 'LOWER') {
          state.numericBounds.hi = Math.min(state.numericBounds.hi, guess - 1);
        }
        // EXACT es imposible aquí: habría sido match y piece_hit
        return {
          event: {
            type: 'numeric_guess',
            guess,
            verdict: verdict === 'LOWER' ? 'LOWER' : 'HIGHER',
            proximity: prox,
          },
          stateAfter: state,
        };
      }
      return { event: { type: 'chitchat', activeDesc: describePiece(active) }, stateAfter: state };
    }

    // Pieza activa PALABRA
    if (active && active.type === 'word') {
      const attempts = state.attemptsOnActive + 1;
      const level = angleLevel(attempts);
      return {
        event: {
          type: 'word_riddle',
          word: active.value,
          letters: active.value.length,
          attempts,
          level,
          angle: angleForPiece(active, blueprint, level - 1) ?? '',
          typed: current,
        },
        stateAfter: state,
      };
    }

    // Pieza activa SÍMBOLO
    if (active && active.type === 'symbol') {
      const attempts = state.attemptsOnActive + 1;
      const level = angleLevel(attempts);
      return {
        event: {
          type: 'symbol_riddle',
          attempts,
          level,
          angle: angleForPiece(active, blueprint, level - 1) ?? '',
          typed: current,
        },
        stateAfter: state,
      };
    }

    return { event: { type: 'chitchat', activeDesc: describePiece(active) }, stateAfter: state };
  }

  // 4) Assembly
  const diff = analyzeAssemblyDiff(current, blueprint.wifiPass, [...blueprint.fragments]);
  if (diff.isExact) {
    state.phase = 'solved';
    return { event: { type: 'victory' }, stateAfter: state };
  }

  const attempts = state.assemblyAttempts;
  state.assemblyAttempts += 1;
  return {
    event: {
      type: 'assembly_diff',
      diagnosis: diff.diagnosis,
      wellPlaced: countWellPlaced(current, blueprint),
      total: blueprint.fragments.length,
      level: orderHintLevel(attempts),
      orderHint: buildOrderHint(attempts, blueprint),
    },
    stateAfter: state,
  };
}
