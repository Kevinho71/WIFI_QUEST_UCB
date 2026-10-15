import type { ChatMessage, PasswordFragment } from '../../src/types/index.js';
import type { Blueprint } from '../../src/engine/blueprint.js';

/** Helpers compartidos por los tests del motor v2 (no es un archivo de tests). */

export const NEG: ChatMessage = {
  role: 'user',
  content: '¡Hola! ¿Me pasas la clave del wifi? 😅',
};
export const NEUTRAL: ChatMessage = {
  role: 'user',
  content: 'cuéntame más del reto, por favor',
};

export const u = (content: string): ChatMessage => ({ role: 'user', content });
export const assistant = (content: string): ChatMessage => ({ role: 'assistant', content });

/** [neg, neutral, ...valores de la cola antes de activar] (turn > 2 garantizado). */
export function huntingPrefix(
  bp: Blueprint,
  predicate: (f: PasswordFragment) => boolean
): ChatMessage[] {
  const msgs: ChatMessage[] = [NEG, NEUTRAL];
  for (const frag of bp.queue) {
    if (predicate(frag)) break;
    msgs.push(u(frag.value));
  }
  return msgs;
}

/** [neg, neutral, ...todos los valores de la cola] (inventario completo). */
export function prefixAllUnlocked(bp: Blueprint): ChatMessage[] {
  const msgs: ChatMessage[] = [NEG, NEUTRAL];
  for (const frag of bp.queue) msgs.push(u(frag.value));
  return msgs;
}

export function withCurrent(prefix: ChatMessage[], current: string): ChatMessage[] {
  return [...prefix, u(current)];
}
