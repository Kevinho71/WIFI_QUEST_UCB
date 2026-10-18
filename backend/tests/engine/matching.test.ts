import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../../src/engine/blueprint.js';
import {
  evaluateMessageV2,
  extractNumericGuess,
  isInstantWinExact,
  countWellPlaced,
} from '../../src/engine/matching.js';

const KEY = '#Quasar8128&Fenix%777!';

describe('Fase 3: engine/matching', () => {
  describe('isInstantWinExact (victoria exacta)', () => {
    it('exige trim + sensibilidad a mayúsculas', () => {
      expect(isInstantWinExact(KEY, KEY)).toBe(true);
      expect(isInstantWinExact(`  ${KEY}  `, KEY)).toBe(true);
      expect(isInstantWinExact(KEY.toLowerCase(), KEY)).toBe(false);
      expect(isInstantWinExact(`${KEY}x`, KEY)).toBe(false);
    });
  });

  describe('extractNumericGuess', () => {
    it('extrae bloques sueltos de exactamente d dígitos', () => {
      expect(extractNumericGuess('es 8075', 4)).toBe(8075);
      expect(extractNumericGuess('mi tiro es 505', 3)).toBe(505);
    });

    it('no extrae cuando el bloque está pegado a más dígitos o no existe', () => {
      expect(extractNumericGuess('8075', 3)).toBeNull();
      expect(extractNumericGuess('hola', 4)).toBeNull();
    });
  });

  describe('evaluateMessageV2 — símbolos', () => {
    const bp = buildBlueprint(KEY);

    it('"¡Hola!" NO desbloquea "!"', () => {
      const res = evaluateMessageV2('¡Hola!', bp.queue, bp);
      expect(res.matchedFragments).toHaveLength(0);
    });

    it('"es el # " SÍ desbloquea "#" (token aislado)', () => {
      const res = evaluateMessageV2('es el # ', bp.queue, bp);
      expect(res.matchedFragments.map((f) => f.value)).toContain('#');
    });

    it('"almohadilla" SÍ desbloquea "#" (por name)', () => {
      const res = evaluateMessageV2('creo que es la almohadilla', bp.queue, bp);
      expect(res.matchedFragments.map((f) => f.value)).toContain('#');
    });

    it('un símbolo pegado a una letra no cuenta ("#Quasar")', () => {
      const res = evaluateMessageV2('#Quasar', bp.queue, bp);
      expect(res.matchedFragments.map((f) => f.value)).not.toContain('#');
      expect(res.matchedFragments.map((f) => f.value)).toContain('Quasar');
    });
  });

  describe('evaluateMessageV2 — palabras y aliases', () => {
    const bp = buildBlueprint(KEY);

    it('"cuásar" desbloquea Quasar (alias, sin tildes)', () => {
      const res = evaluateMessageV2('diría cuásar', bp.queue, bp);
      expect(res.matchedFragments.map((f) => f.value)).toContain('Quasar');
    });

    it('"administrador" NO desbloquea admin (límites de palabra)', () => {
      const bp2 = buildBlueprint('admin123');
      const res = evaluateMessageV2('administrador', bp2.queue, bp2);
      expect(res.matchedFragments).toHaveLength(0);
    });

    it('detecta combos múltiples en un mismo mensaje', () => {
      const res = evaluateMessageV2('Quasar y Fenix', bp.queue, bp);
      expect(res.isCombo).toBe(true);
      expect(res.matchedFragments.map((f) => f.value).sort()).toEqual(['Fenix', 'Quasar']);
    });
  });

  describe('evaluateMessageV2 — números', () => {
    const bp = buildBlueprint(KEY);

    it('desbloquea el número exacto y no lo hace con dígitos pegados', () => {
      expect(evaluateMessageV2('es 8128', bp.queue, bp).matchedFragments.map((f) => f.value)).toContain(
        '8128'
      );
      expect(evaluateMessageV2('18128', bp.queue, bp).matchedFragments.map((f) => f.value)).not.toContain(
        '8128'
      );
    });
  });

  describe('countWellPlaced (Mastermind)', () => {
    const bp = buildBlueprint(KEY);

    it('la clave exacta tiene 8 piezas bien ubicadas', () => {
      expect(countWellPlaced(KEY, bp)).toBe(8);
    });

    it('un orden distinto solo cuenta las coincidencias de posición', () => {
      expect(countWellPlaced('#Fenix777!Quasar8128', bp)).toBe(1);
    });
  });
});
