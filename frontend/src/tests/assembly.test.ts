import { describe, it, expect } from 'vitest';
import {
  placePiece,
  removeFromSlot,
  clearSlots,
  isLayoutFull,
  buildCandidate,
  type AssemblyLayout,
} from '@/lib/assembly';

/**
 * Fase 2 — Lógica pura de colocación del ensamblaje final.
 *
 * Cubre colocar, mover, intercambiar y retirar piezas, además de la construcción
 * exacta del intento (sin separadores).
 */

const empty = (slotCount: number, tray: string[]): AssemblyLayout => ({
  tray,
  slots: new Array(slotCount).fill(null),
});

describe('lib/assembly', () => {
  describe('placePiece', () => {
    it('coloca una pieza de la bandeja en una casilla vacía', () => {
      const before = empty(3, ['a', 'b', 'c']);
      const after = placePiece(before, 'a', 1);

      expect(after.slots).toEqual([null, 'a', null]);
      expect(after.tray).toEqual(['b', 'c']);
    });

    it('mueve una pieza de una casilla a una vacía', () => {
      const before: AssemblyLayout = { tray: ['c'], slots: ['a', 'b', null] };
      const after = placePiece(before, 'a', 2);

      expect(after.slots).toEqual([null, 'b', 'a']);
      expect(after.tray).toEqual(['c']);
    });

    it('intercambia piezas entre dos casillas', () => {
      const before: AssemblyLayout = { tray: [], slots: ['a', 'b', 'c'] };
      const after = placePiece(before, 'a', 2);

      expect(after.slots).toEqual(['c', 'b', 'a']);
      expect(after.tray).toEqual([]);
    });

    it('al soltar en una casilla ocupada, la pieza desplazada vuelve a la bandeja', () => {
      const before: AssemblyLayout = { tray: ['z'], slots: ['a', null, null] };
      const after = placePiece(before, 'z', 0);

      expect(after.slots).toEqual(['z', null, null]);
      expect(after.tray).toEqual(['a']);
    });

    it('es no-op si la pieza se suelta en su propia casilla', () => {
      const before: AssemblyLayout = { tray: [], slots: ['a', null] };
      const after = placePiece(before, 'a', 0);

      expect(after).toBe(before);
    });

    it('no muta el layout original', () => {
      const before = empty(2, ['a', 'b']);
      placePiece(before, 'a', 0);

      expect(before.slots).toEqual([null, null]);
      expect(before.tray).toEqual(['a', 'b']);
    });
  });

  describe('removeFromSlot', () => {
    it('devuelve la pieza a la bandeja', () => {
      const before: AssemblyLayout = { tray: ['c'], slots: ['a', 'b'] };
      const after = removeFromSlot(before, 0);

      expect(after.slots).toEqual([null, 'b']);
      expect(after.tray).toEqual(['c', 'a']);
    });

    it('es no-op en una casilla vacía', () => {
      const before: AssemblyLayout = { tray: ['c'], slots: [null] };
      expect(removeFromSlot(before, 0)).toBe(before);
    });
  });

  describe('clearSlots', () => {
    it('vacía las casillas conservando el orden de la bandeja', () => {
      const before: AssemblyLayout = { tray: ['d'], slots: ['a', null, 'b'] };
      const after = clearSlots(before);

      expect(after.slots).toEqual([null, null, null]);
      expect(after.tray).toEqual(['d', 'a', 'b']);
    });

    it('es no-op si no hay piezas colocadas', () => {
      const before = empty(2, ['a']);
      expect(clearSlots(before)).toBe(before);
    });
  });

  describe('isLayoutFull', () => {
    it('es true con todas las casillas ocupadas', () => {
      expect(isLayoutFull({ tray: [], slots: ['a', 'b'] })).toBe(true);
    });

    it('es false con alguna casilla vacía o sin casillas', () => {
      expect(isLayoutFull({ tray: ['c'], slots: ['a', null] })).toBe(false);
      expect(isLayoutFull({ tray: [], slots: [] })).toBe(false);
    });
  });

  describe('buildCandidate', () => {
    it('concatena los valores en el orden de las casillas, sin separadores', () => {
      const layout: AssemblyLayout = { tray: [], slots: ['f1', 'f2', 'f3'] };
      const values = { f1: '#', f2: 'Quasar', f3: '8128' };

      expect(buildCandidate(layout, values)).toBe('#Quasar8128');
    });

    it('ignora las casillas vacías', () => {
      const layout: AssemblyLayout = { tray: ['f2'], slots: ['f1', null] };
      expect(buildCandidate(layout, { f1: 'abc' })).toBe('abc');
    });
  });
});
