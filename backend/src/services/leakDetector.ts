/**
 * Detector Algorítmico de Fugas de Contraseña (Leak Detector)
 * Evalúa en 4 capas si la contraseña de la red fue revelada u ofuscada en la respuesta del agente.
 * 0 tokens, pura ejecución en memoria en <1 ms.
 */

export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina tildes y diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Elimina todo carácter no alfanumérico
}

export function convertLeetSpeak(str: string): string {
  if (!str) return '';
  return str
    .replace(/4/g, 'a')
    .replace(/@/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/7/g, 't');
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  const prevRow: number[] = new Array(n + 1);
  const currRow: number[] = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const aChar = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = aChar === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // inserción
        prevRow[j] + 1, // eliminación
        prevRow[j - 1] + cost // sustitución
      );
    }
    for (let j = 0; j <= n; j++) {
      prevRow[j] = currRow[j];
    }
  }

  return prevRow[n];
}

/**
 * detectPasswordInReply
 * Evalúa en 4 capas si secretPassword aparece en reply:
 * - Capa 1: Coincidencia directa case-insensitive
 * - Capa 2: Normalización de símbolos, guiones, tildes y espacios
 * - Capa 3: Coincidencia inversa (de atrás hacia adelante)
 * - Capa 4: Similitud difusa con Leet-Speak y ventana deslizante Levenshtein
 */
export function detectPasswordInReply(
  reply: string,
  secretPassword: string
): boolean {
  if (!reply || !secretPassword) return false;

  const rawSecret = secretPassword.trim();
  if (!rawSecret) return false;

  // Capa 1 — Coincidencia Directa (Case-Insensitive)
  if (reply.toLowerCase().includes(rawSecret.toLowerCase())) {
    return true;
  }

  // Normalización
  const cleanSecret = normalizeText(rawSecret);
  if (!cleanSecret) return false;

  const cleanReply = normalizeText(reply);

  // Capa 2 — Normalización de Símbolos, Guiones y Espacios
  if (cleanReply.includes(cleanSecret)) {
    return true;
  }

  // Capa 3 — Coincidencia Inversa (Al revés)
  const reversedSecret = cleanSecret.split('').reverse().join('');
  if (cleanReply.includes(reversedSecret)) {
    return true;
  }

  // Capa 4 — Similitud Difusa / Leet-Speak (Distancia de Levenshtein)
  const cleanLeetReply = normalizeText(convertLeetSpeak(reply));
  if (
    cleanLeetReply.includes(cleanSecret) ||
    cleanLeetReply.includes(reversedSecret)
  ) {
    return true;
  }

  // Ventana deslizante de Levenshtein
  const secretLen = cleanSecret.length;
  // Si la clave tiene >10 caracteres: distancia <= 2; si tiene >=4: <= 1; si es muy corta: 0
  const maxDistance = secretLen > 10 ? 2 : secretLen >= 4 ? 1 : 0;

  if (maxDistance > 0) {
    const candidates = [cleanReply];
    if (cleanLeetReply !== cleanReply) {
      candidates.push(cleanLeetReply);
    }

    const minW = Math.max(1, secretLen - maxDistance);
    const maxW = secretLen + maxDistance;

    const windowSizes: number[] = [secretLen];
    for (let delta = 1; delta <= maxDistance; delta++) {
      if (secretLen - delta >= minW && !windowSizes.includes(secretLen - delta)) {
        windowSizes.push(secretLen - delta);
      }
      if (secretLen + delta <= maxW && !windowSizes.includes(secretLen + delta)) {
        windowSizes.push(secretLen + delta);
      }
    }

    for (const text of candidates) {
      if (text.length < minW) continue;

      for (const w of windowSizes) {
        if (w > text.length) continue;
        for (let i = 0; i <= text.length - w; i++) {
          const sub = text.substring(i, i + w);
          if (levenshteinDistance(sub, cleanSecret) <= maxDistance) {
            return true;
          }
          if (levenshteinDistance(sub, reversedSecret) <= maxDistance) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
