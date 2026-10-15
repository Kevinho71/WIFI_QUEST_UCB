import type { Blueprint } from './blueprint.js';
import type { TurnEvent } from './events.js';

/**
 * Fase 5 — Plantillas deterministas de respaldo (PLAN_MOTOR_V2 §6.9).
 *
 * Último recurso cuando el LLM y el reintento fallan las guardas. Tres variantes por
 * evento para no sonar robótico. Todas respetan: ≤ 65 palabras, solo emojis
 * permitidos, sin clave ni falsa victoria (salvo `victory`). Los `{...}` se llenan
 * con datos del evento: nunca valores secretos, salvo `{typed}`, `{guess}` y
 * `{dato}`/`{wifiPass}` que vienen del usuario/backend.
 *
 * Nota (desviación mínima y necesaria respecto del plan): el reto de apertura se
 * rotula "Primer reto" en lugar de "Reto 1" porque el guard de dígitos rechaza
 * cualquier bloque numérico que no exista en DATOS DEL SISTEMA o en el mensaje del
 * usuario, y "1" no viaja en el `datosBlock` de `first_challenge`. El contenido es
 * equivalente.
 */

export type TemplateKey =
  | 'rompehielo'
  | 'first_challenge'
  | 'numeric_guess'
  | 'word_riddle'
  | 'symbol_riddle'
  | 'piece_hit_normal'
  | 'piece_hit_combo'
  | 'piece_hit_out_of_turn'
  | 'last_piece'
  | 'ask_length'
  | 'ask_property'
  | 'ask_future'
  | 'ask_category'
  | 'ask_mask'
  | 'chitchat'
  | 'assembly_diff'
  | 'victory';

export const TEMPLATES: Record<TemplateKey, readonly [string, string, string]> = {
  rompehielo: [
    'Jaja, buen intento 😅 Pero el Ing. Hugo me vigila. Tráeme una excusa creativa o un chiste bueno y hablamos 🎮',
    'Nada de nada, crack 😅 Primero rompés el hielo: cuento gracioso, excusa épica o reto de ingenio. Tú eliges 🔥',
    'Ay, directo al grano 😅 Aquí no se regala nada: una excusa convincente o un chiste y arrancamos 🎮',
  ],
  first_challenge: [
    '¡Esa actitud me gusta! Primer reto: {activeDesc}. {angle} 👀',
    'Buen hielo roto, crack 🎮 Primer reto: {activeDesc}. {angle}',
    'Me convenció esa 😅 Arranca el juego: {activeDesc}. {angle} 🔥',
  ],
  numeric_guess: [
    '¡Uy, {verdictWord}! {proximityWord} 🎮 {resultSentence}',
    '{resultSentence} Vas {proximityLower}. Seguí afinando 🔥',
    '¡{verdictWord}, crack! {resultSentence} Cercanía: {proximityWord} 👀',
  ],
  word_riddle: [
    'Mmm, no es 😅 Pista: {angle}',
    'Frío todavía 🤔 Pensá así: {angle}',
    'Nop, pero seguís en juego 🔥 Otra pista: {angle}',
  ],
  symbol_riddle: [
    'Tampoco es 😅 Pista: {angle}',
    'Cerca del teclado, lejos del blanco 🤔 {angle}',
    'Nop 🎮 Rezagamos el enigma: {angle}',
  ],
  piece_hit_normal: [
    '¡Buena jugada, crack! "{typed}" asegurada en tu mochila 🔥 Ahora: {nextDesc}.',
    '¡Esa es! Pieza "{typed}" en el inventario 🎮 Siguiente reto: {nextDesc}.',
    '¡Fino! "{typed}" guardada 👀 Vamos por: {nextDesc}.',
  ],
  piece_hit_combo: [
    '¡Upa, combo! "{typed}" de una sola, crack 🔥 Te anoto todo en la mochila. Ahora: {nextDesc}.',
    '¡Combo doble! 😅 "{typed}" directo al inventario. Queda: {nextDesc}.',
    '¡No era el turno pero qué puntería! Combo: "{typed}" 🎮 Ahora: {nextDesc}.',
  ],
  piece_hit_out_of_turn: [
    '¡Ey, te me adelantaste! "{typed}" la guardo igual 👀 Pero el reto sigue: {activeDesc}.',
    '¡Buena puntería afortunada! "{typed}" al inventario 😅 Volvé al reto: {activeDesc}.',
    '¡Fuera de turno pero cuenta! "{typed}" anotada 🎮 Seguimos con: {activeDesc}.',
  ],
  last_piece: [
    '¡INVENTARIO COMPLETO! 🔥 Ya tenés las {total} piezas. Ahora el reto final: armá la clave completa, en el orden exacto 🎮',
    '¡Mochila llena, crack! {total} de {total} 🎮 Último paso: ordená las piezas y armá la clave. A darle 🔥',
    '¡Todas las piezas! 👀 Ahora sí: el gran ensamblaje. Escribí la clave completa con tus {total} piezas en orden 😅',
  ],
  ask_length: [
    'Dato oficial: {dato} 🎮 Dale otro tiro.',
    'Te lo permito: {dato} 👀 Seguí jugando.',
    'Anotá: {dato} 🔥 Ahora, otro intento.',
  ],
  ask_property: [
    'Dato verificado: {dato} 🤔 Ahora, otro tiro.',
    'Servido: {dato} 🎮 Tu próximo número?',
    'Ahí va: {dato} 👀 Afiná esa puntería.',
  ],
  ask_future: [
    'Paso a paso, crack 😅 Primero el reto en curso: {activeDesc}.',
    'No te adelantes 🎮 Uno a la vez: {activeDesc}.',
    'Tranquilo, que esto es CTF por rondas 🔥 Ahora: {activeDesc}.',
  ],
  ask_category: [
    'Las categorías están vetadas en este CTF 😅 Enigmas sí, etiquetas no 🤔',
    'Ni animal ni objeto ni nada de eso 😅 Acá se deduce con pistas, no con etiquetas 🎮',
    'Eso sería hacerle trampa al enigma 😅 Pista sí, categoría no 🔥',
  ],
  ask_mask: [
    '¿Esquemas? Eso es regalar el mapa 😅 A deducción pura 🎮',
    'Ni X ni guiones: muy fácil 🔥 Estilo CTF: solo enigmas 🤔',
    'El Ing. Hugo me prohibió los dibujitos 😅 Solo palabras 🎮',
  ],
  chitchat: [
    'Jaja, buena 🤔 Pero el reto sigue: {activeDesc} 🔥',
    'Me caes bien, pero no me distras 😅 Vamos: {activeDesc} 🎮',
    'Buena charla, ahora de vuelta al juego 👀 {activeDesc} 🔥',
  ],
  assembly_diff: [
    'Diagnóstico: {diagnosis} 🤔 Piezas bien ubicadas: {k} de {total}. {orderHint}',
    'Ojo: {diagnosis} 😅 Van {k} de {total} bien ubicadas. {orderHint}',
    'Casi: {diagnosis} 🔥 Correctas: {k}/{total}. {orderHint}',
  ],
  victory: [
    '¡GG, me ganaste, crack! 🔥 La clave es "{wifiPass}". ¡Bienvenido a la red! 🎮',
    '¡Me hiciste rendirme como corresponde! 😅 Clave: "{wifiPass}". Disfrutá el WiFi 🔥',
    '¡Victoria legítima! 👀 La clave: "{wifiPass}". Nos vemos en la red 🎮',
  ],
};

/** Mecánica numérica cuando el primer reto es un número (el ángulo solo existe para palabra/símbolo). */
const NUMERIC_MECHANIC =
  'Tirá un número y te diré si el secreto es mayor o menor que tu tiro';

/** Añade artículo si la descripción no lo trae ya (challengeLabel vs describePiece). */
function ensureArticle(desc: string): string {
  const d = (desc || '').trim();
  if (/^(un|una|el|la|los|las)\b/i.test(d)) return d;
  if (/^palabra\b/i.test(d)) return `una ${d}`;
  if (/^n[uú]mero\b/i.test(d)) return `un ${d}`;
  if (/^s[ií]mbolo\b/i.test(d)) return `un ${d}`;
  return d;
}

export function templateKeyFor(event: TurnEvent): TemplateKey {
  if (event.type !== 'piece_hit') return event.type;
  if (event.kind === 'combo') return 'piece_hit_combo';
  if (event.kind === 'out_of_turn') return 'piece_hit_out_of_turn';
  return 'piece_hit_normal';
}

/** Rellena los `{...}` de una plantilla con datos del evento (nunca valores secretos). */
function fillsFor(event: TurnEvent, blueprint: Blueprint): Record<string, string> {
  switch (event.type) {
    case 'first_challenge':
      return {
        activeDesc: ensureArticle(event.activeLabel),
        angle: event.activeAngle ?? NUMERIC_MECHANIC,
      };
    case 'numeric_guess': {
      const higher = event.verdict === 'HIGHER';
      return {
        verdictWord: higher ? 'te quedaste corto' : 'te pasaste',
        proximityWord: event.proximity,
        proximityLower: event.proximity.toLowerCase(),
        resultSentence: `El número secreto es ${higher ? 'MAYOR' : 'MENOR'} que ${event.guess}.`,
      };
    }
    case 'word_riddle':
    case 'symbol_riddle':
      return { angle: event.angle };
    case 'piece_hit':
      return {
        typed: event.typed,
        nextDesc: ensureArticle(event.nextLabel),
        activeDesc: ensureArticle(event.nextLabel),
      };
    case 'last_piece':
      return { total: String(event.total) };
    case 'ask_length':
    case 'ask_property':
      return { dato: event.type === 'ask_length' ? event.dato : event.factText };
    case 'ask_future':
    case 'chitchat':
      return { activeDesc: ensureArticle(event.activeDesc) };
    case 'assembly_diff':
      return {
        diagnosis: event.diagnosis,
        k: String(event.wellPlaced),
        total: String(event.total),
        orderHint: event.orderHint,
      };
    case 'victory':
      return { wifiPass: blueprint.wifiPass };
    default:
      return {};
  }
}

function applyFills(tpl: string, fills: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key: string) => (key in fills ? fills[key] : `{${key}}`));
}

/** Renderiza una variante concreta (0|1|2). Determinista: pensado para tests y para el orquestador. */
export function fillTemplate(
  event: TurnEvent,
  blueprint: Blueprint,
  variant: 0 | 1 | 2
): string {
  const key = templateKeyFor(event);
  return applyFills(TEMPLATES[key][variant], fillsFor(event, blueprint));
}

/** Elige una variante al azar y la renderiza (fallback del orquestador). */
export function renderTemplate(event: TurnEvent, blueprint: Blueprint): string {
  const variant = Math.floor(Math.random() * 3) as 0 | 1 | 2;
  return fillTemplate(event, blueprint, variant);
}
