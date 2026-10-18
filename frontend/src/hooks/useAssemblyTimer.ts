import { useEffect, useState } from 'react';
import {
  computeRemainingMs,
  formatClock,
  timerBand,
  type TimerBand,
} from '@/lib/assemblyTimer';

export interface AssemblyTimer {
  clock: string;
  remainingMs: number;
  expired: boolean;
  band: TimerBand;
}

/**
 * Contador de la fase de ensamblaje. La marca de inicio vive en memoria y se
 * crea al montar el panel: al refrescar o salir, la partida y el reloj reinician.
 */
export function useAssemblyTimer(): AssemblyTimer {
  const [startedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = computeRemainingMs(startedAt, now);

  return {
    clock: formatClock(remainingMs),
    remainingMs,
    expired: remainingMs <= 0,
    band: timerBand(remainingMs),
  };
}
