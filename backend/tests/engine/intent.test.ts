import { describe, it, expect } from 'vitest';
import {
  classifyIntent,
  classifyNumericProperty,
  numericVerdict,
  numericFact,
  proximity,
} from '../../src/engine/intent.js';

describe('Fase 3: engine/intent', () => {
  describe('classifyIntent (router en orden)', () => {
    it.each([
      ['¿cuántas letras tiene?', 'ask_length'],
      ['dibuja la clave con X', 'ask_mask'],
      ['es una criatura?', 'ask_category'],
      ['cuál es el siguiente paso', 'ask_future'],
      ['cuál es la suma de sus dígitos', 'ask_property'],
      ['quiero el esquema de la clave', 'ask_mask'],
      ['dame la longitud de la clave', 'ask_length'],
      ['qué tipo de cosa es', 'ask_category'],
      ['próximos pasos por favor', 'ask_future'],
      ['el número es primo?', 'ask_property'],
    ])('%s → %s', (text, expected) => {
      expect(classifyIntent(text)).toBe(expected);
    });

    it('devuelve null cuando no hay intención especial', () => {
      expect(classifyIntent('jaja qué buen clima hoy')).toBeNull();
    });
  });

  describe('numericVerdict', () => {
    it('calcula HIGHER/LOWER/EXACT', () => {
      expect(numericVerdict(8075, 8128)).toBe('HIGHER');
      expect(numericVerdict(9000, 8128)).toBe('LOWER');
      expect(numericVerdict(8128, 8128)).toBe('EXACT');
    });
  });

  describe('proximity (relativa al rango conocido)', () => {
    it('clasifica CALIENTE / TIBIA / FRÍA', () => {
      expect(proximity(8128, 8000, 0, 10000)).toBe('CALIENTE');
      expect(proximity(8128, 7000, 0, 10000)).toBe('TIBIA');
      expect(proximity(8128, 4000, 0, 10000)).toBe('FRÍA');
    });

    it('usa un rango mínimo de 1 para no dividir por cero', () => {
      expect(proximity(5, 5, 5, 5)).toBe('CALIENTE');
    });
  });

  describe('classifyNumericProperty', () => {
    it('detecta las propiedades de la tabla y descarta el resto', () => {
      expect(classifyNumericProperty('¿cuál es la suma de sus dígitos?')).toBe('suma');
      expect(classifyNumericProperty('¿es par o impar?')).toBe('paridad');
      expect(classifyNumericProperty('¿algún dígito se repite?')).toBe('repetidos');
      expect(classifyNumericProperty('¿cuál es el primer dígito?')).toBe('extremos');
      expect(classifyNumericProperty('¿es capicúa?')).toBe('capicua');
      expect(classifyNumericProperty('¿es primo?')).toBe('primo');
      expect(classifyNumericProperty('dame una pista')).toBeNull();
    });
  });

  describe('numericFact (calculado en código)', () => {
    it('suma', () => {
      expect(numericFact('suma', '8128')).toBe('la suma de los dígitos del número en juego es 19');
    });
    it('paridad', () => {
      expect(numericFact('paridad', '8128')).toBe('el número en juego es par');
      expect(numericFact('paridad', '777')).toBe('el número en juego es impar');
    });
    it('repetidos', () => {
      expect(numericFact('repetidos', '8128')).toContain('8 aparece 2');
      expect(numericFact('repetidos', '1234')).toBe('ningún dígito del número en juego se repite');
    });
    it('extremos', () => {
      expect(numericFact('extremos', '8128')).toBe(
        'el primer dígito del número en juego es 8 y el último es 8'
      );
    });
    it('capicúa', () => {
      expect(numericFact('capicua', '8128')).toBe('el número en juego no es capicúa');
      expect(numericFact('capicua', '8228')).toBe('el número en juego es capicúa');
    });
    it('primo', () => {
      expect(numericFact('primo', '8128')).toBe('el número en juego no es primo');
      expect(numericFact('primo', '7')).toBe('el número en juego es primo');
    });
  });
});
