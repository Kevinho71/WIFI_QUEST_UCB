import { describe, it, expect, beforeEach } from 'vitest';
import {
  ASSEMBLY_DURATION_MS,
  ASSEMBLY_EXPIRED_KEY,
  ASSEMBLY_STARTED_AT_KEY,
  clearAssemblyTimerStorage,
  computeRemainingMs,
  formatClock,
  readFlag,
  readTimestamp,
  timerBand,
  writeFlag,
  writeTimestamp,
} from '@/lib/assemblyTimer';

/**
 * Fase 3 — Lógica pura del contador (broma) del ensamblaje.
 * El contador nunca bloquea el juego: al llegar a cero solo se muestra un aviso.
 */

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
};

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
  configurable: true,
});

describe('lib/assemblyTimer', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  describe('computeRemainingMs', () => {
    it('arranca en la duración completa', () => {
      expect(computeRemainingMs(1000, 1000)).toBe(ASSEMBLY_DURATION_MS);
    });

    it('descuenta el tiempo transcurrido', () => {
      expect(computeRemainingMs(1000, 31_000)).toBe(30_000);
    });

    it('nunca baja de cero', () => {
      expect(computeRemainingMs(1000, 61_000)).toBe(0);
      expect(computeRemainingMs(1000, 999_999)).toBe(0);
    });

    it('tolera una marca de tiempo inválida', () => {
      expect(computeRemainingMs(Number.NaN, 1000)).toBe(0);
    });
  });

  describe('formatClock', () => {
    it('formatea como MM:SS', () => {
      expect(formatClock(60_000)).toBe('01:00');
      expect(formatClock(59_000)).toBe('00:59');
      expect(formatClock(30_500)).toBe('00:31');
      expect(formatClock(1000)).toBe('00:01');
    });

    it('no muestra 00:00 antes de expirar (redondeo hacia arriba)', () => {
      expect(formatClock(500)).toBe('00:01');
      expect(formatClock(0)).toBe('00:00');
      expect(formatClock(-100)).toBe('00:00');
    });
  });

  describe('timerBand', () => {
    it('clasifica por cercanía a cero', () => {
      expect(timerBand(60_000)).toBe('normal');
      expect(timerBand(30_001)).toBe('normal');
      expect(timerBand(30_000)).toBe('warning');
      expect(timerBand(10_001)).toBe('warning');
      expect(timerBand(10_000)).toBe('critical');
      expect(timerBand(1)).toBe('critical');
      expect(timerBand(0)).toBe('expired');
      expect(timerBand(-5)).toBe('expired');
    });
  });

  describe('persistencia', () => {
    it('escribe y lee la marca de inicio', () => {
      writeTimestamp(ASSEMBLY_STARTED_AT_KEY, 12345);
      expect(readTimestamp(ASSEMBLY_STARTED_AT_KEY)).toBe(12345);
    });

    it('ignora valores inválidos', () => {
      writeTimestamp(ASSEMBLY_STARTED_AT_KEY, 0);
      expect(readTimestamp(ASSEMBLY_STARTED_AT_KEY)).toBeNull();
    });

    it('lee y escribe el aviso de expiración', () => {
      expect(readFlag(ASSEMBLY_EXPIRED_KEY)).toBe(false);
      writeFlag(ASSEMBLY_EXPIRED_KEY, true);
      expect(readFlag(ASSEMBLY_EXPIRED_KEY)).toBe(true);
    });

    it('clearAssemblyTimerStorage limpia ambos registros', () => {
      writeTimestamp(ASSEMBLY_STARTED_AT_KEY, 999);
      writeFlag(ASSEMBLY_EXPIRED_KEY, true);

      clearAssemblyTimerStorage();

      expect(readTimestamp(ASSEMBLY_STARTED_AT_KEY)).toBeNull();
      expect(readFlag(ASSEMBLY_EXPIRED_KEY)).toBe(false);
    });
  });
});
