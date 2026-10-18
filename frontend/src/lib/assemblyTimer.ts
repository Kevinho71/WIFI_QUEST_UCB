/**
 * Lógica pura del contador (broma) de la fase de ensamblaje final.
 *
 * El contador es puramente teatral: al llegar a cero no se bloquea ni se reinicia
 * nada. La marca de inicio vive en memoria en `useAssemblyTimer`, de modo que al
 * refrescar o salir la partida arranca desde cero.
 */

export const ASSEMBLY_DURATION_MS = 60_000;

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
