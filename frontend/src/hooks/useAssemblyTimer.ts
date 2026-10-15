import { useEffect, useState } from 'react';
import {
  ASSEMBLY_STARTED_AT_KEY,
  computeRemainingMs,
  formatClock,
  readTimestamp,
  timerBand,
  writeTimestamp,
  type TimerBand,
} from '@/lib/assemblyTimer';

export interface AssemblyTimer {
  clock: string;
  remainingMs: number;
  expired: boolean;
  band: TimerBand;
}

/**
 * Contador de la fase de ensamblaje. La marca de inicio se persiste en
 * localStorage, de modo que el tiempo restante se reconstruye desde `Date.now()`
 * y sobrevive una recarga (no se reinicia al remontar).
 */
export function useAssemblyTimer(): AssemblyTimer {
  // Marca de inicio: se lee (o crea) una sola vez al montar el panel.
  const [startedAt] = useState<number>(() => {
    const stored = readTimestamp(ASSEMBLY_STARTED_AT_KEY);
    if (stored !== null) return stored;
    const ts = Date.now();
    writeTimestamp(ASSEMBLY_STARTED_AT_KEY, ts);
    return ts;
  });

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
