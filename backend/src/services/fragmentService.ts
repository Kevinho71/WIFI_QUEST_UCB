import {
  ChatMessage,
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
 * 1.2.1 Reasigna ids a los fragmentos con una permutación derivada de `seed`.
 * Mantiene el orden de `fragments` (original, para el ensamblaje) pero cambia los
 * ids para que NO revelen la posición original. Estable para una misma seed, de modo
 * que el replay reconstructa idénticos ids durante toda la partida.
 */
export function randomizeFragmentIds(
  fragments: PasswordFragment[],
  seed: number | string
): PasswordFragment[] {
  const n = fragments.length;
  if (n <= 1) return fragments.map((f) => ({ ...f }));

  const rng = createPrng(seed);
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }

  return fragments.map((f) => ({
    ...f,
    id: `frag_${perm[f.originalIndex] + 1}`,
  }));
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

/**
 * 2.3 Aislamiento de Contexto para Ensamblaje:
 * Descarta el historial ruidoso de adivinanzas previas (chistes, adivinanzas de números individuales)
 * al entrar a la fase 'assembly', conservando únicamente la interacción inmediata de ensamblaje.
 */
export function pruneHistoryForAssembly(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
  if (lastUserIdx === -1) {
    return messages.slice(-2);
  }

  // Conservar como máximo el mensaje previo del asistente y el intento actual del usuario
  const startIndex = Math.max(0, lastUserIdx - 1);
  return messages.slice(startIndex);
}

export interface AssemblyDiffResult {
  isExact: boolean;
  diagnosis: string;
  details: {
    missingFragments?: string[];
    invertedSymbols?: string[];
    extraneousChars?: string[];
    hasSpaces?: boolean;
    caseMismatch?: boolean;
    orderAdvice?: string;
  };
}

/**
 * 2.4 Evaluador de Diff Determinista (analyzeAssemblyDiff):
 * Compara el intento de ensamblaje del usuario contra la contraseña real y genera
 * un diagnóstico quirúrgico y amigable (espacios, caracteres intrusos, partes faltantes o símbolos invertidos).
 */
export function analyzeAssemblyDiff(
  attempt: string,
  realPassword: string,
  fragments?: PasswordFragment[]
): AssemblyDiffResult {
  const cleanAttempt = (attempt || '').trim();
  const cleanReal = (realPassword || '').trim();
  const tokenList =
    fragments && fragments.length > 0 ? fragments : tokenizePassword(cleanReal);

  // 1. Coincidencia exacta
  if (cleanAttempt === cleanReal) {
    return {
      isExact: true,
      diagnosis:
        '¡Combinación perfecta y exacta! Has ensamblado la clave correctamente.',
      details: {},
    };
  }

  // 2. Coincidencia ignorando espacios
  if (cleanAttempt.replace(/\s+/g, '') === cleanReal) {
    return {
      isExact: false,
      diagnosis:
        'Tienes todas las piezas en el orden correcto, pero agregaste espacios entre ellas. La contraseña WiFi debe ir completamente unida sin espacios.',
      details: { hasSpaces: true },
    };
  }

  // 3. Coincidencia ignorando mayúsculas/minúsculas
  if (cleanAttempt.toLowerCase() === cleanReal.toLowerCase()) {
    return {
      isExact: false,
      diagnosis:
        'El orden y los caracteres son correctos, pero hay diferencias en las mayúsculas y minúsculas. Revisa cómo escribiste las palabras.',
      details: { caseMismatch: true },
    };
  }

  const noSpacesAttempt = cleanAttempt.replace(/\s+/g, '');

  // 4. Caracteres intrusos (caracteres presentes en attempt que no pertenecen a realPassword)
  const allowedChars = new Map<string, number>();
  for (const ch of cleanReal) {
    allowedChars.set(ch, (allowedChars.get(ch) || 0) + 1);
  }

  const attemptCharCounts = new Map<string, number>();
  for (const ch of noSpacesAttempt) {
    attemptCharCounts.set(ch, (attemptCharCounts.get(ch) || 0) + 1);
  }

  const extraneousChars: string[] = [];
  for (const [ch, count] of attemptCharCounts.entries()) {
    const allowed = allowedChars.get(ch) || 0;
    if (count > allowed) {
      extraneousChars.push(ch);
    }
  }

  if (extraneousChars.length > 0) {
    return {
      isExact: false,
      diagnosis: `Detecté caracteres extra que no pertenecen a las piezas descubiertas: [${extraneousChars
        .map((c) => `'${c}'`)
        .join(', ')}]. Retíralos de tu combinación.`,
      details: { extraneousChars },
    };
  }

  // 5. Partes faltantes (fragmentos que faltan en el intento)
  const missingFragments: string[] = [];
  let remainingAttempt = noSpacesAttempt;

  for (const frag of tokenList) {
    const idx = remainingAttempt.indexOf(frag.value);
    if (idx !== -1) {
      remainingAttempt =
        remainingAttempt.slice(0, idx) +
        remainingAttempt.slice(idx + frag.value.length);
    } else {
      missingFragments.push(frag.value);
    }
  }

  if (missingFragments.length > 0) {
    return {
      isExact: false,
      diagnosis: `Te faltan piezas por incluir en la combinación: [${missingFragments
        .map((f) => `'${f}'`)
        .join(', ')}]. Debes usar todos los fragmentos descubiertos.`,
      details: { missingFragments },
    };
  }

  // 6. Piezas o símbolos invertidos / fuera de orden
  const invertedSymbols: string[] = [];
  for (let i = 0; i < tokenList.length - 1; i++) {
    const current = tokenList[i].value;
    const next = tokenList[i + 1].value;
    if (
      noSpacesAttempt.includes(next + current) &&
      !cleanReal.includes(next + current)
    ) {
      invertedSymbols.push(current, next);
    }
  }

  if (invertedSymbols.length > 0) {
    const uniqueInverted = Array.from(new Set(invertedSymbols));
    return {
      isExact: false,
      diagnosis: `Tienes todas las piezas, pero algunas están invertidas o en orden incorrecto (revisa la posición de: [${uniqueInverted
        .map((s) => `'${s}'`)
        .join(', ')}]).`,
      details: {
        invertedSymbols: uniqueInverted,
        orderAdvice: `Revisa el orden relativo entre ${uniqueInverted.join(' y ')}.`,
      },
    };
  }

  // 7. Diagnóstico general de orden sintáctico
  return {
    isExact: false,
    diagnosis:
      'Tienes todas las piezas necesarias, pero están en un orden diferente al de la contraseña real. Reorganiza las piezas pensando en su estructura sintáctica lógica.',
    details: {
      orderAdvice: 'Reorganiza los fragmentos en el orden sintáctico correcto.',
    },
  };
}

export interface LucasReactionOptions {
  type: 'combo' | 'out_of_turn' | 'normal_hit' | 'future_diversion';
  matchedFragments?: PasswordFragment[];
  activeTarget?: PasswordFragment | null;
  nextTarget?: PasswordFragment | null;
  remainingCount?: number;
}

/**
 * 2.2 Manejador de Respuestas Gamer:
 * Genera directivas para que Lucas reaccione adecuadamente ante aciertos normales,
 * combos dobles, hallazgos fuera de turno o desvíos cuando el usuario pregunta por pasos futuros.
 */
export function buildLucasReactionDirective(options: LucasReactionOptions): string {
  const matchedTokens =
    options.matchedFragments?.map((f) => `"${f.value}"`).join(', ') || '';
  const nextDesc = options.nextTarget
    ? `el siguiente objetivo: "${options.nextTarget.value}" (${
        options.nextTarget.type === 'number'
          ? `número de ${options.nextTarget.value.length} dígitos`
          : options.nextTarget.type === 'word'
          ? `palabra de ${options.nextTarget.value.length} letras`
          : 'símbolo especial'
      })`
    : 'el siguiente reto pendiente';

  switch (options.type) {
    case 'combo':
      return `### REACCIÓN GAMER OBLIGATORIA (COMBO MÚLTIPLE) ###
- ¡COMBO DOBLE/MÚLTIPLE LOGRADO! El usuario acaba de acertar varias piezas en este solo mensaje: [${matchedTokens}].
- Reacciona con gran entusiasmo gamer de Lucas ("¡Upa, combo doble crack! Le pegaste al objetivo actual y de paso le atinaste a otra pieza sin querer. Te anoto ambas en la mochila.").
- Confirma las piezas agregadas al inventario y reorienta inmediatamente la atención hacia ${nextDesc}.${
        options.remainingCount !== undefined
          ? ` Ya solo faltan ${options.remainingCount} fragmentos.`
          : ''
      }`;

    case 'out_of_turn':
      return `### REACCIÓN GAMER OBLIGATORIA (ACIERTO ADELANTADO FUERA DE TURNO) ###
- El usuario acertó por casualidad una pieza futura: [${matchedTokens}], pero NO la pieza activa en juego.
- Reacciona celebrando con humor gamer su puntería ("¡Ey, te me adelantaste a la jugada pero diste en el blanco con esa pieza! Te la guardo en el inventario.").
- Reorienta amistosamente al usuario para volver al objetivo activo actual: ${
        options.activeTarget ? `"${options.activeTarget.value}"` : 'el objetivo en curso'
      }. No te desvíes.`;

    case 'normal_hit':
      return `### REACCIÓN GAMER OBLIGATORIA (PIEZA CONSEGUIDA) ###
- El usuario acertó la pieza activa: [${matchedTokens}].
- Felicítalo con tono gamer ("¡Buena jugada, crack! Pieza asegurada en tu inventario.").
- Inmediatamente presenta la pista o enigma para ${nextDesc}.`;

    case 'future_diversion':
      return `### REACCIÓN ANTE PREGUNTAS POR PASOS FUTUROS ###
- El usuario intenta adelantarse preguntando por pasos o piezas futuras.
- Responde con humor gamer reorientándolo: "Paso a paso, crack. No te adelantes a la jugada; primero concéntrate en resolver el reto en curso: ${
        options.activeTarget ? options.activeTarget.value : 'el objetivo activo'
      }".`;

    default:
      return '';
  }
}

