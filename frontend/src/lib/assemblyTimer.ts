/**
 * Lógica pura del contador (broma) de la fase de ensamblaje final.
 *
 * El contador es puramente teatral: al llegar a cero no se bloquea ni se reinicia
 * nada. Se calcula desde una marca de tiempo persistida para sobrevivir recargas.
 */

export const ASSEMBLY_DURATION_MS = 60_000;
export const ASSEMBLY_STARTED_AT_KEY = 'wifi_quest_assembly_started_at_lvl_1';
export const ASSEMBLY_EXPIRED_KEY = 'wifi_quest_assembly_expired_lvl_1';

/** Tiempo restante en ms, nunca negativo. */
export function computeRemainingMs(
  startedAt: number,
  now: number,
  duration: number = ASSEMBLY_DURATION_MS
): number {
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, duration - (now - startedAt));
}

/** "MM:SS" con redondeo hacia arriba para no mostrar 00:00 antes de tiempo. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export type TimerBand = 'normal' | 'warning' | 'critical' | 'expired';

/** Banda visual/verbal según la cercanía a cero. */
export function timerBand(remainingMs: number): TimerBand {
  if (remainingMs <= 0) return 'expired';
  if (remainingMs <= 10_000) return 'critical';
  if (remainingMs <= 30_000) return 'warning';
  return 'normal';
}

export function readTimestamp(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeTimestamp(key: string, value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* almacenamiento no disponible: el contador sigue funcionando en memoria */
  }
}

export function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function writeFlag(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Limpia la marca de tiempo y el aviso de expiración (al reiniciar el reto). */
export function clearAssemblyTimerStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ASSEMBLY_STARTED_AT_KEY);
    window.localStorage.removeItem(ASSEMBLY_EXPIRED_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
