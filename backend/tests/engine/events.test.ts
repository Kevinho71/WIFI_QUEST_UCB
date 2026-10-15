import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../../src/engine/blueprint.js';
import { replayState } from '../../src/engine/session.js';
import { deriveEvent, buildOrderHint, orderHintLevel } from '../../src/engine/events.js';
import type { ChatMessage } from '../../src/types/index.js';
import type { Blueprint } from '../../src/engine/blueprint.js';
import { huntingPrefix, prefixAllUnlocked, withCurrent, u } from './helpers.js';

const KEY = '#Quasar8128&Fenix%777!';

function eventFor(history: ChatMessage[], bp: Blueprint) {
  const state0 = replayState(history, bp);
  return deriveEvent(state0, bp);
}

describe('Fase 4: engine/events (deriveEvent)', () => {
  describe('instant win exacto', () => {
    it('gana en el turno 1', () => {
      const bp = buildBlueprint(KEY);
      const { event, stateAfter } = eventFor([u(KEY)], bp);
      expect(event.type).toBe('victory');
      expect(stateAfter.phase).toBe('solved');
      expect(stateAfter.pending).toHaveLength(0);
    });

    it('gana en un turno avanzado', () => {
      const bp = buildBlueprint(KEY);
      const { event } = eventFor([u('hola'), u('nada'), u(KEY)], bp);
      expect(event.type).toBe('victory');
    });
  });

  it('rompehielo en el turno 1', () => {
    const bp = buildBlueprint(KEY);
    const { event, stateAfter } = eventFor([u('hola, dame el wifi')], bp);
    expect(event.type).toBe('rompehielo');
    expect(stateAfter.phase).toBe('negotiation');
  });

  describe('first_challenge en el turno 2', () => {
    it('sin pregunta', () => {
      const bp = buildBlueprint(KEY);
      const { event } = eventFor([u('hola'), u('te cuento un chiste')], bp);
      expect(event.type).toBe('first_challenge');
    });

    it('con pregunta (el reto gana igual)', () => {
      const bp = buildBlueprint(KEY);
      const { event } = eventFor([u('hola'), u('¿cuántas letras tiene la clave?')], bp);
      expect(event.type).toBe('first_challenge');
    });
  });

  describe('piece_hit', () => {
    const bp = buildBlueprint(KEY);
    const active0 = bp.queue[0];
    const future0 = bp.queue[1];

    it('normal (acierta la pieza activa)', () => {
      const { event } = eventFor(withCurrent(huntingPrefix(bp, (f) => f === active0), active0.value), bp);
      expect(event.type).toBe('piece_hit');
      if (event.type === 'piece_hit') expect(event.kind).toBe('normal');
    });

    it('combo (activa + futura)', () => {
      const { event } = eventFor(
        withCurrent(huntingPrefix(bp, (f) => f === active0), `${active0.value} ${future0.value}`),
        bp
      );
      expect(event.type).toBe('piece_hit');
      if (event.type === 'piece_hit') expect(event.kind).toBe('combo');
    });

    it('out_of_turn (solo una pieza futura)', () => {
      const { event } = eventFor(withCurrent(huntingPrefix(bp, (f) => f === active0), future0.value), bp);
      expect(event.type).toBe('piece_hit');
      if (event.type === 'piece_hit') expect(event.kind).toBe('out_of_turn');
    });
  });

  it('last_piece al completar el inventario (sin ensamblar exacto)', () => {
    const bp = buildBlueprint(KEY);
    const last = bp.queue[bp.queue.length - 1];
    const { event, stateAfter } = eventFor(withCurrent(huntingPrefix(bp, (f) => f === last), last.value), bp);
    expect(event.type).toBe('last_piece');
    expect(stateAfter.phase).toBe('assembly');
  });

  describe('assembly_diff', () => {
    it('reporta k/N y una pista de orden', () => {
      const bp = buildBlueprint(KEY);
      const { event } = eventFor(withCurrent(prefixAllUnlocked(bp), '#Fenix777!Quasar8128'), bp);
      expect(event.type).toBe('assembly_diff');
      if (event.type === 'assembly_diff') {
        expect(event.total).toBe(8);
        expect(event.wellPlaced).toBe(1);
        expect(event.orderHint.length).toBeGreaterThan(0);
        expect(event.diagnosis).toContain('&');
        expect(event.diagnosis).toContain('%');
      }
    });

    it('victory si el ensamblaje es exacto', () => {
      const bp = buildBlueprint(KEY);
      const { event, stateAfter } = eventFor(withCurrent(prefixAllUnlocked(bp), KEY), bp);
      expect(event.type).toBe('victory');
      expect(stateAfter.phase).toBe('solved');
    });
  });

  describe('pista de orden progresiva (sin valores)', () => {
    const bp = buildBlueprint(KEY);
    const leaves = ['Quasar', 'Fenix', '8128', '777', '#', '&', '%', '!'];

    it('niveles', () => {
      expect(orderHintLevel(0)).toBe(1);
      expect(orderHintLevel(3)).toBe(2);
      expect(orderHintLevel(6)).toBe(3);
    });

    it('nivel 1 solo nombra la primera pieza; nivel 2 agrega la última; nivel 3 una interior', () => {
      const h1 = buildOrderHint(0, bp);
      const h2 = buildOrderHint(3, bp);
      const h3 = buildOrderHint(6, bp);

      expect(h1).toContain('La primera pieza de la clave es');
      expect(h1).not.toContain('La última pieza de la clave es');
      expect(h1).not.toContain('Pista extra');

      expect(h2).toContain('La primera pieza de la clave es');
      expect(h2).toContain('La última pieza de la clave es');
      expect(h2).not.toContain('Pista extra');

      expect(h3).toContain('Pista extra: la pieza');
    });

    it('ninguna pista contiene valores de piezas', () => {
      for (const attempts of [0, 3, 6, 9]) {
        const hint = buildOrderHint(attempts, bp);
        for (const value of leaves) {
          expect(hint, `intento ${attempts}: ${value}`).not.toContain(value);
        }
      }
    });
  });
});
