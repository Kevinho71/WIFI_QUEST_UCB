import { describe, it, expect } from 'vitest';
import { normalizeForMatch, normalizeAlnum } from '../../src/utils/text.js';

describe('Fase 1: utils/text — normalización compartida del motor v2', () => {
  describe('normalizeForMatch (matching)', () => {
    it('pasa a minúsculas', () => {
      expect(normalizeForMatch('QUASAR')).toBe('quasar');
    });

    it('quita tildes y diacríticos', () => {
      expect(normalizeForMatch('Quásar Fénix')).toBe('quasar fenix');
    });

    it('colapsa espacios múltiples y recorta extremos', () => {
      expect(normalizeForMatch('  hola    mundo  ')).toBe('hola mundo');
      expect(normalizeForMatch('a\t\nb')).toBe('a b');
    });

    it('CONSERVA los símbolos (no los elimina)', () => {
      expect(normalizeForMatch('  ¡Hola! #  ')).toBe('¡hola! #');
      expect(normalizeForMatch('#Quasar8128&Fenix%777!')).toBe('#quasar8128&fenix%777!');
    });

    it('tolera cadena vacía o indefinida', () => {
      expect(normalizeForMatch('')).toBe('');
      expect(normalizeForMatch(undefined as unknown as string)).toBe('');
    });
  });

  describe('normalizeAlnum (detección de fugas)', () => {
    it('deja SOLO [a-z0-9]', () => {
      expect(normalizeAlnum('¡Hola! 123')).toBe('hola123');
      expect(normalizeAlnum('#Quasar8128&Fenix%777!')).toBe('quasar8128fenix777');
    });

    it('atrapa el deletreo "Q-u-a-s-a-r"', () => {
      expect(normalizeAlnum('Q-u-a-s-a-r')).toBe('quasar');
      expect(normalizeAlnum('F-e-n-i-x')).toBe('fenix');
    });

    it('quita tildes y pasa a minúsculas', () => {
      expect(normalizeAlnum('Quásar Fénix')).toBe('quasarfenix');
    });

    it('elimina por completo una cadena de solo símbolos', () => {
      expect(normalizeAlnum('&#%!')).toBe('');
    });

    it('tolera cadena vacía o indefinida', () => {
      expect(normalizeAlnum('')).toBe('');
      expect(normalizeAlnum(undefined as unknown as string)).toBe('');
    });
  });
});
