import { detectPasswordInReply } from '../services/leakDetector.js';
import type { PasswordFragment } from '../types/index.js';
import { normalizeAlnum } from '../utils/text.js';
import type { Blueprint } from './blueprint.js';
import type { TurnEvent } from './events.js';

/**
 * Fase 5 — Guardas deterministas de respuesta (PLAN_MOTOR_V2 §6.8).
 *
 * El LLM SOLO redacta: estas guardas verifican el resultado y, si no cumple, el
 * orquestador reintenta (1 vez) o cae a plantilla. Dos responsabilidades separadas:
 *
 *  - `applyReplyCorrections` — Paso 1: correcciones automáticas que NO invalidan
 *    (emojis fuera de la lista permitida y recorte de largo). El orquestador la usa
 *    para obtener el texto corregido antes de `validateReply`.
 *  - `validateReply` — Paso 2: guardas duras. Falla → reintento → plantilla. Una fuga
 *    interceptada devuelve `leak: true` y NUNCA puede terminar en victoria.
 */

export interface GuardContext {
  phase: 'negotiation' | 'hunting' | 'assembly' | 'solved';
  event: TurnEvent;
  userMessage: string;
  datosBlock: string; // lista blanca del guard de dígitos
  blueprint: Blueprint;
  pending: PasswordFragment[]; // pendientes DESPUÉS del evento
}

/** `{ ok: true }` es exacto en éxito; el fallo puede llevar `leak` (fuga interceptada). */
export type GuardVerdict = { ok: true } | { ok: false; reason: string; leak?: boolean };

const ALLOWED_EMOJIS = new Set(['😉', '🤔', '🎮', '🔥', '👀', '😅']);
const MAX_WORDS = 65;
const HARD_CUT_WORDS = 60;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

const FALSE_WIN =
  /\b(gg|me ganaste|ganaste|acertaste|clave correcta|contrase[nñ]a correcta|c[oó]digo exacto|red\s+desbloqueada|ya puedes celebrar)\b/i;

// Sustantivos de categoría vetados en los enigmas (se tolera el artículo intermedio:
// "es un animal", "se trata de un planeta", "como una criatura"...).
const CATEGORY =
  /\b(?:es|son|se\s+trata\s+de|trata\s+de|como\s+un[ao]?|parecido\s+a\s+un[ao]?)\s+(?:un[ao]?\s+|el\s+|la\s+)?(animal|objeto|fruta|planeta|planta|criatura|cosa)\b/i;

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Elimina cualquier emoji que no esté en la lista blanca (limpiando selectores/ZWJ). */
function stripForbiddenEmojis(reply: string): string {
  let out = '';
  for (const ch of reply) {
    if (ch === '\uFE0F' || ch === '\u200D') continue;
    if (PICTOGRAPHIC.test(ch) && !ALLOWED_EMOJIS.has(ch)) continue;
    out += ch;
  }
  return out;
}

/** Recorta a `maxWords` cortando en el último límite de oración; si no hay, corte duro. */
function cutToMaxWords(reply: string, maxWords = MAX_WORDS): string {
  if (countWords(reply) <= maxWords) return reply;

  const re = /[.!?]+|\n/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reply)) !== null) {
    const end = m.index + m[0].length;
    if (countWords(reply.slice(0, end)) > maxWords) break;
    lastEnd = end;
  }
  if (lastEnd > 0) return reply.slice(0, lastEnd).trim();

  const words = reply.split(/\s+/).filter(Boolean);
  return `${words.slice(0, HARD_CUT_WORDS).join(' ')}...`;
}

/** Paso 1 — correcciones automáticas (no invalidan): emojis prohibidos + largo. */
export function applyReplyCorrections(reply: string): string {
  return cutToMaxWords(stripForbiddenEmojis(reply || ''));
}

function digitBlocks(s: string): string[] {
  return (s || '').match(/\d+/g) ?? [];
}

function detectProximityMentions(text: string): Array<'CALIENTE' | 'TIBIA' | 'FRÍA'> {
  const out: Array<'CALIENTE' | 'TIBIA' | 'FRÍA'> = [];
  if (/\bcalientes?\b/i.test(text)) out.push('CALIENTE');
  if (/\btibi[ao]s?\b/i.test(text)) out.push('TIBIA');
  if (/\bfr[ií][ao]s?\b/i.test(text)) out.push('FRÍA');
  return out;
}

/**
 * Fuga del texto del LLM. Devuelve el motivo si hay fuga, o `null` si está limpio.
 * En `solved` no aplica (la victoria legítima SÍ lleva la clave); en `assembly` solo
 * se revisa la clave completa (todas las piezas ya son propiedad del usuario).
 */
function detectLeak(reply: string, ctx: GuardContext): string | null {
  if (ctx.phase === 'solved') return null;
  if (detectPasswordInReply(reply, ctx.blueprint.wifiPass)) return 'fuga de la clave completa';
  if (ctx.phase === 'assembly') return null;

  const alnumReply = normalizeAlnum(reply);
  for (const frag of ctx.pending) {
    const info = ctx.blueprint.info.get(frag.id);
    if (frag.type === 'word') {
      for (const cand of [frag.value, ...(info?.aliases ?? [])]) {
        const norm = normalizeAlnum(cand);
        if (norm && alnumReply.includes(norm)) return 'fuga de la palabra en juego';
      }
    } else if (frag.type === 'number') {
      if (new RegExp(`(?<!\\d)${frag.value}(?!\\d)`).test(reply)) {
        return 'fuga de un número pendiente';
      }
    } else {
      for (const name of info?.names ?? []) {
        const norm = normalizeAlnum(name);
        if (norm && alnumReply.includes(norm)) return 'fuga del nombre de un símbolo pendiente';
      }
    }
  }
  return null;
}

/**
 * Paso 2 — guardas duras. Se validan sobre el texto ya corregido (idempotente).
 * El ORDEN importa: la fuga va antes que los dígitos, porque la clave completa
 * también contiene dígitos y debe reportarse como fuga (`leakBlocked`), no como
 * "dígito no autorizado".
 */
export function validateReply(reply: string, ctx: GuardContext): GuardVerdict {
  const text = applyReplyCorrections(reply);

  // 1) Veredicto numérico + 2) cercanía (solo numeric_guess)
  if (ctx.event.type === 'numeric_guess') {
    const higher = ctx.event.verdict === 'HIGHER';
    const hi = /\b(mayor|m[aá]s alto|m[aá]s grande)\b/i.test(text);
    const lo = /\b(menor|m[aá]s bajo|m[aá]s chico|m[aá]s peque[nñ]o)\b/i.test(text);
    const verdictOk = (higher && hi && !lo) || (!higher && lo && !hi);
    if (!verdictOk) {
      return { ok: false, reason: `veredicto incorrecto (se esperaba ${higher ? 'MAYOR' : 'MENOR'})` };
    }

    const expected = ctx.event.proximity;
    const mentioned = detectProximityMentions(text);
    if (mentioned.some((m) => m !== expected)) {
      return { ok: false, reason: `cercanía incorrecta (se esperaba ${expected})` };
    }
  }

  // 3) Fuga (negotiation | hunting | assembly)
  const leak = detectLeak(text, ctx);
  if (leak) return { ok: false, reason: leak, leak: true };

  // 4) Dígitos inventados: todo bloque debe existir en el mensaje del usuario o en DATOS
  const allowed = new Set([...digitBlocks(ctx.userMessage), ...digitBlocks(ctx.datosBlock)]);
  for (const block of digitBlocks(text)) {
    if (!allowed.has(block)) return { ok: false, reason: `dígito no autorizado: ${block}` };
  }

  // 5) Falsa victoria (cualquier fase ≠ solved)
  if (ctx.phase !== 'solved' && FALSE_WIN.test(text)) {
    return { ok: false, reason: 'falsa victoria (el juego no ha terminado)' };
  }

  // 6) Categoría revelada (solo enigmas de apertura/palabra/símbolo)
  if (
    ctx.event.type === 'word_riddle' ||
    ctx.event.type === 'symbol_riddle' ||
    ctx.event.type === 'first_challenge'
  ) {
    if (CATEGORY.test(text)) {
      return { ok: false, reason: 'revela la categoría de la pieza' };
    }
  }

  return { ok: true };
}
