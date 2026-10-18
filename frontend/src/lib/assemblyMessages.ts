/**
 * Mensajes visibles de la burbuja del ensamblaje final.
 *
 * Regla del producto: en el apartado de ensamblaje SOLO se ve el último mensaje
 * del LLM. Si todavía no hubo ninguna validación, se muestra el aviso de
 * expiración (si el minuto ya se agotó) o la instrucción inicial.
 */

export const ASSEMBLY_INTRO_MESSAGE =
  '¡Llegaste al Gran Ensamblaje! Ordená todas las piezas y validá tu combinación. Yo mientras me río del reloj... digo, de tu intento. 😉';

export const ASSEMBLY_EXPIRED_TAUNT =
  '😏 ¡Y se acabó el minuto! ¿Te la creíste? Tranqui, crack, acá el reloj es puro teatro: no pasa absolutamente nada. Seguí ordenando las piezas y validá cuando quieras. 🙃';

/** Mensaje a mostrar: gana el último reply del LLM; si no hay, intro o burla. */
export function resolveAssemblyBubbleMessage(
  llmReply: string | null,
  expired: boolean
): string {
  if (llmReply) return llmReply;
  return expired ? ASSEMBLY_EXPIRED_TAUNT : ASSEMBLY_INTRO_MESSAGE;
}
