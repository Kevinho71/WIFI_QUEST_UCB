/**
 * Claves de progreso que versiones anteriores guardaban en localStorage/sessionStorage.
 * La partida actual vive solo en memoria: al refrescar o salir se reinicia.
 */
export const LEGACY_GAME_KEYS = [
  'wifi_quest_messages',
  'wifi_quest_level',
  'wifi_quest_session_seed_lvl_1',
  'wifi_quest_game_state_lvl_1',
  'wifi_quest_solved',
  'wifi_quest_solved_lvl_1',
  'wifi_quest_solved_lvl_2',
  'wifi_quest_mode_chosen',
  'wifi_quest_chat_lvl_1',
  'wifi_quest_chat_lvl_2',
  'wifi_quest_assembly_started_at_lvl_1',
  'wifi_quest_assembly_expired_lvl_1',
] as const;

/**
 * Borra el progreso de partidas viejas. No toca `wifi_quest_muted`, que es una
 * preferencia de audio y no forma parte del estado del juego.
 */
export function clearLegacyGameStorage(): void {
  if (typeof window === 'undefined') return;

  for (const key of LEGACY_GAME_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* almacenamiento no disponible */
    }
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
