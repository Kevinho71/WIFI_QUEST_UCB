import { tokenizePassword } from '../services/fragmentService.js';
import type { Blueprint } from './blueprint.js';
import type { FragmentEvaluationResult, PasswordFragment } from '../types/index.js';
import { normalizeForMatch } from '../utils/text.js';

/**
 * Fase 3 — Matching v2.
 *
 * A diferencia de v1: victoria EXACTA (trim + case-sensitive), matching de palabras
 * con aliases, matching de símbolos solo como token aislado (o por sus `names`), y
 * números con límites de dígito. Longest Match First con consumo (array `consumed`).
 *
 * Nota: los límites se evalúan sobre el texto ORIGINAL normalizado (no sobre el
 * texto consumido) para que un símbolo pegado a una palabra que se desbloqueó en el
 * mismo mensaje siga contando como "no aislado" (ej. "#Quasar" no desbloquea "#").
 */

/** VICTORIA EXACTA (decisión cerrada): trim + case-sensitive. */
export function isInstantWinExact(msg: string, wifiPass: string): boolean {
  return (msg || '').trim() === wifiPass;
}

/** Extrae el primer bloque de dígitos suelto de exactamente `digits` dígitos. */
export function extractNumericGuess(msg: string, digits: number): number | null {
  const m = (msg || '').match(new RegExp(`(?<!\\d)\\d{${digits}}(?!\\d)`));
  return m ? Number(m[0]) : null;
}

// `normalizeForMatch` ya dejó el texto en minúsculas y sin tildes: solo a-z y 0-9.
const isLetter = (c: string): boolean => c >= 'a' && c <= 'z';
const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isAlnum = (c: string): boolean => isLetter(c) || isDigit(c);

type Boundary = (before: string, after: string) => boolean;

const alphaBoundary: Boundary = (b, a) => !isLetter(b) && !isLetter(a);
const digitBoundary: Boundary = (b, a) => !isDigit(b) && !isDigit(a);
const isolatedBoundary: Boundary = (b, a) => !isAlnum(b) && !isAlnum(a);

/** Primera ocurrencia de `needle` (no consumida) que cumpla los límites. */
function findMatch(
  original: string[],
  consumed: boolean[],
  needle: string,
  boundary: Boundary
): number {
  if (!needle) return -1;
  for (let i = 0; i + needle.length <= original.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (consumed[i + j] || original[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const before = i > 0 ? original[i - 1] : '';
    const after = i + needle.length < original.length ? original[i + needle.length] : '';
    if (boundary(before, after)) return i;
  }
  return -1;
}

interface FoundMatch {
  index: number;
  length: number;
  token: string;
}

function findFragmentMatch(
  original: string[],
  consumed: boolean[],
  frag: PasswordFragment,
  info: { aliases: string[]; names: string[] } | undefined
): FoundMatch | null {
  if (frag.type === 'number') {
    const idx = findMatch(original, consumed, frag.value, digitBoundary);
    return idx === -1 ? null : { index: idx, length: frag.value.length, token: frag.value };
  }

  if (frag.type === 'word') {
    for (const raw of [frag.value, ...(info?.aliases ?? [])]) {
      const cand = normalizeForMatch(raw);
      const idx = findMatch(original, consumed, cand, alphaBoundary);
      if (idx !== -1) return { index: idx, length: cand.length, token: raw };
    }
    return null;
  }

  // symbol: (a) carácter aislado, (b) uno de sus names como palabra
  const charIdx = findMatch(original, consumed, frag.value, isolatedBoundary);
  if (charIdx !== -1) {
    return { index: charIdx, length: frag.value.length, token: frag.value };
  }
  for (const name of info?.names ?? []) {
    const cand = normalizeForMatch(name);
    const idx = findMatch(original, consumed, cand, alphaBoundary);
    if (idx !== -1) return { index: idx, length: cand.length, token: name };
  }
  return null;
}

export function evaluateMessageV2(
  message: string,
  pending: readonly PasswordFragment[],
  blueprint: Blueprint
): FragmentEvaluationResult {
  const activeTarget = pending.length > 0 ? pending[0] : null;

  if (!message || message.trim().length === 0 || pending.length === 0) {
    return {
      matchedFragments: [],
      unmatchedFragments: [...pending],
      isCombo: false,
      activeFragmentMatched: false,
      activeTarget,
      consumedTokens: [],
    };
  }

  const original = normalizeForMatch(message).split('');
  const consumed = new Array<boolean>(original.length).fill(false);
  const sortedByLength = [...pending].sort((a, b) => b.value.length - a.value.length);
  const matchedSet = new Set<string>();
  const consumedTokens: string[] = [];

  for (const frag of sortedByLength) {
    const info = blueprint.info.get(frag.id);
    const found = findFragmentMatch(original, consumed, frag, info);
    if (!found) continue;
    for (let i = found.index; i < found.index + found.length; i++) consumed[i] = true;
    matchedSet.add(frag.id);
    if (found.token) consumedTokens.push(found.token);
  }

  const matchedFragments = pending.filter((f) => matchedSet.has(f.id));
  const unmatchedFragments = pending.filter((f) => !matchedSet.has(f.id));

  return {
    matchedFragments,
    unmatchedFragments,
    isCombo: matchedFragments.length > 1,
    activeFragmentMatched: activeTarget ? matchedSet.has(activeTarget.id) : false,
    activeTarget,
    consumedTokens,
  };
}

/** k = piezas exactamente correctas en TIPO, VALOR y POSICIÓN (estilo Mastermind). */
export function countWellPlaced(attempt: string, blueprint: Blueprint): number {
  const tokens = tokenizePassword((attempt || '').replace(/\s+/g, '')).map((f) => f.value);
  let k = 0;
  for (let i = 0; i < Math.min(tokens.length, blueprint.fragments.length); i++) {
    if (tokens[i] === blueprint.fragments[i].value) k += 1; // case-sensitive (exacta)
  }
  return k;
}
