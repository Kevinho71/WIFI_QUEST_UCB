/**
 * Utilidades de normalización de texto compartidas por el motor v2.
 * El motor v1 (fragmentService/securityLevels) conserva sus propias copias;
 * en v2 estas funciones son la única fuente de verdad para matching y fugas.
 */

/** Comparaciones de matching: minúsculas, sin tildes, espacios colapsados (conserva símbolos). */
export function normalizeForMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detección de fugas: minúsculas, sin tildes, SOLO [a-z0-9] (atrapa "Q-u-a-s-a-r"). */
export function normalizeAlnum(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
