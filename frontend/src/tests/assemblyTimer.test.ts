import { describe, it, expect } from 'vitest';
import {
  ASSEMBLY_DURATION_MS,
  computeRemainingMs,
  formatClock,
  timerBand,
} from '@/lib/assemblyTimer';

/**
 * Fase 3 — Lógica pura del contador (broma) del ensamblaje.
 * El contador nunca bloquea el juego: al llegar a cero solo se muestra un aviso.
 * La marca de inicio ya no se persiste: vive en memoria dentro del hook.
 */

describe('lib/assemblyTimer', () => {
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
});
