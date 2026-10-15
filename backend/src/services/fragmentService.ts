import {
  FragmentEvaluationResult,
  FragmentType,
  PasswordFragment,
} from '../types/index.js';
import { containsSecretPassword, normalizeText } from './securityLevels.js';

/**
 * Normaliza una cadena para comparaciones léxicas sin alterar la estructura:
 * minúsculas y eliminación de marcas diacríticas/tildes.
 */
export function normalizeTokenString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Generador de números pseudo-aleatorios determinista (Mulberry32) para tests y semillas reproducibles.
 */
function createPrng(seed?: number | string): () => number {
  if (seed === undefined) {
    return Math.random;
  }

  let s =
    typeof seed === 'number'
      ? seed
      : Array.from(seed).reduce(
          (acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) | 0,
          0
        );

  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Descompone internamente una cadena en tokens elementales:
 * - Palabras (con soporte PascalCase y caracteres en español)
 * - Bloques numéricos contiguos
 * - Símbolos individuales (un símbolo por fragmento)
 */
function extractRawTokens(input: string): string[] {
  // Manejo de repetición simétrica exacta (ej: "ConejoConejo", "delfindelfin")
  if (input.length >= 4 && input.length % 2 === 0) {
    const half = input.length / 2;
    const first = input.slice(0, half);
    const second = input.slice(half);
    if (first.toLowerCase() === second.toLowerCase()) {
      const sub = extractRawTokens(first);
      if (sub.length === 1) {
        return [first, second];
      }
    }
  }

  // Regex atómica:
  // 1. Palabras PascalCase/Capitalizadas: [A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+
  // 2. Palabras genéricas: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+
  // 3. Bloques numéricos: \d+
  // 4. Símbolos individuales: [^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s]
  const regex =
    /[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+|\d+|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s]/g;
  const matches = input.match(regex);
  return matches ? matches.filter((t) => t.trim().length > 0) : [];
}

/**
 * 1.1 Tokenizador Atómico:
 * Separa limpiamente palabras, bloques numéricos y símbolos especiales.
 */
export function tokenizePassword(wifiPass: string): PasswordFragment[] {
  const cleanPass = (wifiPass || '').trim();
  if (!cleanPass) return [];

  const rawTokens = extractRawTokens(cleanPass);

  return rawTokens.map((token, index) => {
    let type: FragmentType = 'symbol';
    if (/^\d+$/.test(token)) {
      type = 'number';
    } else if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(token)) {
      type = 'word';
    }

    return {
      id: `frag_${index + 1}`,
      value: token,
      type,
      originalIndex: index,
    };
  });
}

/**
 * 1.2 Algoritmo de Barajado (Fisher-Yates Shuffle):
 * Determina el orden aleatorio de retos para la sesión anti-spoilers.
 */
export function createShuffledChallengeQueue(
  fragments: PasswordFragment[],
  seed?: number | string
): PasswordFragment[] {
  const queue = [...fragments];
  if (queue.length <= 1) return queue;

  const rng = createPrng(seed);

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  return queue;
}

/**
 * Valida los límites de coincidencia para evitar falsos positivos
 * (ej: no coincidir '505' dentro de '1505', ni 'pan' dentro de 'empanada').
 */
function hasValidBoundaries(
  text: string,
  startIndex: number,
  length: number,
  type: FragmentType
): boolean {
  if (type === 'symbol') {
    return true;
  }

  const endIndex = startIndex + length;
  const charBefore = startIndex > 0 ? text[startIndex - 1] : '';
  const charAfter = endIndex < text.length ? text[endIndex] : '';

  if (type === 'number') {
    // Un número no debe estar precedido ni seguido inmediatamente por otro dígito
    const isDigitBefore = /\d/.test(charBefore);
    const isDigitAfter = /\d/.test(charAfter);
    return !isDigitBefore && !isDigitAfter;
  }

  if (type === 'word') {
    // Una palabra no debe estar precedida ni seguida por otra letra
    const isLetterBefore = /[a-záéíóúüñ]/i.test(charBefore);
    const isLetterAfter = /[a-záéíóúüñ]/i.test(charAfter);
    return !isLetterBefore && !isLetterAfter;
  }

  return true;
}

/**
 * Busca la primera ocurrencia con límites válidos de un fragmento en el texto actual.
 */
function findValidMatchIndex(
  currentText: string,
  target: string,
  type: FragmentType
): number {
  let searchStart = 0;
  while (searchStart <= currentText.length - target.length) {
    const idx = currentText.indexOf(target, searchStart);
    if (idx === -1) {
      return -1;
    }
    if (hasValidBoundaries(currentText, idx, target.length, type)) {
      return idx;
    }
    searchStart = idx + 1;
  }
  return -1;
}

/**
 * 1.3 Algoritmo Longest Match First:
 * Escanea el mensaje del usuario contra los fragmentos pendientes ordenados por longitud descendente.
 * Marca los caracteres consumidos como '\0' para evitar colisiones de subcadenas (ej. 'admin' vs 'administrador')
 * y detecta combos de múltiples aciertos.
 */
export function evaluateUserMessageFragments(
  message: string,
  pendingFragments: PasswordFragment[]
): FragmentEvaluationResult {
  const activeTarget = pendingFragments.length > 0 ? pendingFragments[0] : null;

  if (!message || message.trim().length === 0 || pendingFragments.length === 0) {
    return {
      matchedFragments: [],
      unmatchedFragments: [...pendingFragments],
      isCombo: false,
      activeFragmentMatched: false,
      activeTarget,
      consumedTokens: [],
    };
  }

  const normalizedMessage = normalizeTokenString(message);
  const chars = Array.from(normalizedMessage);

  // Ordenar fragmentos pendientes por mayor longitud de valor para evitar colisiones
  const sortedByLength = [...pendingFragments].sort(
    (a, b) => b.value.length - a.value.length
  );

  const matchedSet = new Set<string>();

  for (const fragment of sortedByLength) {
    const target = normalizeTokenString(fragment.value);
    if (!target) continue;

    const currentText = chars.join('');
    const matchIdx = findValidMatchIndex(currentText, target, fragment.type);

    if (matchIdx !== -1) {
      matchedSet.add(fragment.id);
      // Consumir los caracteres correspondientes con '\0'
      for (let i = matchIdx; i < matchIdx + target.length; i++) {
        chars[i] = '\0';
      }
    }
  }

  // Mantener el orden original de la cola de pendientes
  const matchedFragments = pendingFragments.filter((f) => matchedSet.has(f.id));
  const unmatchedFragments = pendingFragments.filter((f) => !matchedSet.has(f.id));
  const activeFragmentMatched =
    activeTarget !== null && matchedSet.has(activeTarget.id);
  const isCombo = matchedFragments.length > 1;

  return {
    matchedFragments,
    unmatchedFragments,
    isCombo,
    activeFragmentMatched,
    activeTarget,
    consumedTokens: matchedFragments.map((f) => f.value),
  };
}

/**
 * 1.4 Evaluador de Victoria Inmediata:
 * Cortocircuito para verificar si el usuario envió la contraseña completa exacta en cualquier momento.
 */
export function isInstantWin(userMessage: string, wifiPass: string): boolean {
  if (!userMessage || !wifiPass) return false;
  return containsSecretPassword(userMessage, wifiPass);
}

/**
 * Evaluador integral de progresión del turno:
 * Ejecuta el cortocircuito de victoria inmediata si el usuario escribió la clave completa,
 * o procesa la detección de fragmentos con Longest Match First.
 */
export function evaluateTurnProgression({
  userMessage,
  wifiPass,
  pendingFragments,
}: {
  userMessage: string;
  wifiPass: string;
  pendingFragments: PasswordFragment[];
}): {
  instantWin: boolean;
  evaluation: FragmentEvaluationResult;
} {
  const instantWin = isInstantWin(userMessage, wifiPass);
  if (instantWin) {
    return {
      instantWin: true,
      evaluation: {
        matchedFragments: [...pendingFragments],
        unmatchedFragments: [],
        isCombo: false,
        activeFragmentMatched: true,
        activeTarget: pendingFragments.length > 0 ? pendingFragments[0] : null,
        consumedTokens: pendingFragments.map((f) => f.value),
      },
    };
  }

  const evaluation = evaluateUserMessageFragments(userMessage, pendingFragments);
  return {
    instantWin: false,
    evaluation,
  };
}
