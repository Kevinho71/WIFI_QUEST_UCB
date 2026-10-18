import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../../src/engine/blueprint.js';
import { countWellPlaced } from '../../src/engine/matching.js';
import { buildOrderHint, orderHintLevel, deriveEvent } from '../../src/engine/events.js';
import { replayState } from '../../src/engine/session.js';
import { analyzeAssemblyDiff } from '../../src/services/fragmentService.js';
import type { ChatMessage } from '../../src/types/index.js';
import { prefixAllUnlocked, withCurrent } from './helpers.js';

/**
 * Fase 7 — Ensamblaje pulido (PLAN_MOTOR_V2 §6.4.1 y §6.6).
 *
 * Valida a fondo el contador estilo Mastermind (`countWellPlaced`) y las pistas de
 * orden progresivas (`buildOrderHint`), ya integrados en `events.ts`/`prompts.ts`/
 * `templates.ts` en las Fases 4-6.
 */

const KEY = '#Quasar8128&Fenix%777!';
const ATTEMPT = '#Fenix777!Quasar8128'; // intento del log real (todas las piezas, mal orden)

describe('Fase 7: ensamblaje', () => {
  const bp = buildBlueprint(KEY);

  describe('countWellPlaced (Mastermind: tipo + valor + posición)', () => {
    it('la clave exacta ubica las 8 piezas', () => {
      expect(countWellPlaced(KEY, bp)).toBe(8);
    });

    it('el intento del log real ubica solo 1', () => {
      // ["#","Fenix","777","!","Quasar","8128"] vs ["#","Quasar","8128","&","Fenix","%","777","!"]
      // Solo la primera posición ("#") coincide.
      expect(countWellPlaced(ATTEMPT, bp)).toBe(1);
    });

    it('ignora los espacios entre piezas', () => {
      expect(countWellPlaced('# Quasar 8128 & Fenix % 777 !', bp)).toBe(8);
    });

    it('es sensible a mayúsculas (las palabras en minúscula no cuentan)', () => {
      // Solo fallan "Quasar" y "Fenix"; el resto (símbolos y números) coincide => 6.
      expect(countWellPlaced(KEY.toLowerCase(), bp)).toBe(6);
    });
  });

  describe('pistas de orden progresivas', () => {
    const values = bp.fragments.map((f) => f.value);

    it('umbrales de nivel', () => {
      expect(orderHintLevel(0)).toBe(1);
      expect(orderHintLevel(2)).toBe(1);
      expect(orderHintLevel(3)).toBe(2);
      expect(orderHintLevel(5)).toBe(2);
      expect(orderHintLevel(6)).toBe(3);
    });

    it('nivel 1 revela solo la primera pieza; nivel 2 la última; nivel 3 una interior', () => {
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

    it('ninguna pista (ningún nivel) contiene VALORES de piezas', () => {
      for (const attempts of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        const hint = buildOrderHint(attempts, bp);
        for (const value of values) {
          expect(hint, `attempts=${attempts}, value=${value}`).not.toContain(value);
        }
      }
    });

    it('niveles 1-2 no exponen la secuencia completa de tipos', () => {
      const tipos = ['una palabra', 'un número', 'un símbolo'];
      const countTipos = (hint: string) =>
        tipos.reduce((acc, t) => acc + (hint.split(t).length - 1), 0);

      expect(countTipos(buildOrderHint(0, bp))).toBeLessThanOrEqual(1); // solo la primera
      expect(countTipos(buildOrderHint(3, bp))).toBeLessThanOrEqual(2); // primera + última
      // nivel 3 sí puede nombrar una posición interior extra
      expect(countTipos(buildOrderHint(6, bp))).toBeGreaterThanOrEqual(3);
    });
  });

  describe('caseMismatch (política de victoria exacta)', () => {
    it('un intento todo en minúsculas NO es victoria y el diagnóstico lo señala', () => {
      const attempt = KEY.toLowerCase(); // #quasar8128&fenix%777!
      const history: ChatMessage[] = withCurrent(prefixAllUnlocked(bp), attempt);

      const { event, stateAfter } = deriveEvent(replayState(history, bp), bp);

      expect(event.type).toBe('assembly_diff');
      expect(stateAfter.phase).not.toBe('solved');
      if (event.type === 'assembly_diff') {
        expect(event.diagnosis.toLowerCase()).toMatch(/may[uú]sculas/);
      }

      const diff = analyzeAssemblyDiff(attempt, KEY, [...bp.fragments]);
      expect(diff.isExact).toBe(false);
      expect(diff.details.caseMismatch).toBe(true);
    });

    it('la clave exacta sí gana (política exacta activa)', () => {
      const history = withCurrent(prefixAllUnlocked(bp), KEY);
      const { event, stateAfter } = deriveEvent(replayState(history, bp), bp);
      expect(event.type).toBe('victory');
      expect(stateAfter.phase).toBe('solved');
    });
  });
});
