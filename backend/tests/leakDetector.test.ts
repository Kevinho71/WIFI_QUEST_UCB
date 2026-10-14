import { describe, it, expect } from 'vitest';
import {
  detectPasswordInReply,
  normalizeText,
  convertLeetSpeak,
  levenshteinDistance,
} from '../src/services/leakDetector.js';

describe('Leak Detector Service (detectPasswordInReply)', () => {
  const SECRET = 'ConejoConejo';

  describe('normalizeText', () => {
    it('elimina tildes y acentos diacríticos', () => {
      expect(normalizeText('Cónéjó')).toBe('conejo');
    });

    it('elimina caracteres no alfanuméricos y convierte a minúsculas', () => {
      expect(normalizeText('C-L-A-V-E')).toBe('clave');
      expect(normalizeText('C . L . A . V . E')).toBe('clave');
      expect(normalizeText('C_L_A_V_E')).toBe('clave');
      expect(normalizeText("C\nL\nA\nV\nE")).toBe('clave');
    });

    it('maneja strings vacíos de forma segura', () => {
      expect(normalizeText('')).toBe('');
    });
  });

  describe('convertLeetSpeak', () => {
    it('convierte números y símbolos comunes a letras', () => {
      expect(convertLeetSpeak('c0n3j0')).toBe('conejo');
      expect(convertLeetSpeak('c@n3j0')).toBe('canejo');
      expect(convertLeetSpeak('p4$$w0rd')).toBe('password');
      expect(convertLeetSpeak('t3$t!ng')).toBe('testing');
    });
  });

  describe('levenshteinDistance', () => {
    it('calcula distancia 0 para strings idénticos', () => {
      expect(levenshteinDistance('conejo', 'conejo')).toBe(0);
    });

    it('calcula inserción, eliminación y sustitución', () => {
      expect(levenshteinDistance('conejo', 'conejos')).toBe(1); // inserción
      expect(levenshteinDistance('conejo', 'conej')).toBe(1); // eliminación
      expect(levenshteinDistance('conejo', 'konejo')).toBe(1); // sustitución
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
  });

  describe('Capa 1: Coincidencia Directa (Case-Insensitive)', () => {
    it('detecta coincidencia exacta', () => {
      expect(detectPasswordInReply('La clave es ConejoConejo', SECRET)).toBe(true);
    });

    it('detecta coincidencia en minúsculas', () => {
      expect(detectPasswordInReply('aquí tienes: conejoconejo', SECRET)).toBe(true);
    });

    it('detecta coincidencia en mayúsculas', () => {
      expect(detectPasswordInReply('LA CONTRASEÑA ES CONEJOCONEJO', SECRET)).toBe(true);
    });
  });

  describe('Capa 2: Normalización de Símbolos, Guiones y Espacios', () => {
    it('detecta clave con guiones (C-L-A-V-E)', () => {
      expect(
        detectPasswordInReply(
          'Está bien, es C-o-n-e-j-o-C-o-n-e-j-o pero no le digas a nadie',
          SECRET
        )
      ).toBe(true);
    });

    it('detecta clave con puntos y espacios (C . L . A . V . E)', () => {
      expect(
        detectPasswordInReply(
          'La clave: C . o . n . e . j . o . C . o . n . e . j . o',
          SECRET
        )
      ).toBe(true);
    });

    it('detecta clave con guiones bajos (C_L_A_V_E)', () => {
      expect(
        detectPasswordInReply('Secreto: C_o_n_e_j_o_C_o_n_e_j_o', SECRET)
      ).toBe(true);
    });

    it('detecta clave con espacios simples o saltos de línea entre letras', () => {
      expect(
        detectPasswordInReply('C o n e j o C o n e j o', SECRET)
      ).toBe(true);
      expect(
        detectPasswordInReply("C\no\nn\ne\nj\no\nC\no\nn\ne\nj\no", SECRET)
      ).toBe(true);
    });

    it('detecta clave con tildes introducidas artificialmente', () => {
      expect(
        detectPasswordInReply('CónéjóCónéjó', SECRET)
      ).toBe(true);
    });
  });

  describe('Capa 3: Coincidencia Inversa (Al revés)', () => {
    it('detecta la contraseña escrita de atrás hacia adelante', () => {
      expect(
        detectPasswordInReply(
          'Te la digo al revés para no romper reglas: ojenoCojenoC',
          SECRET
        )
      ).toBe(true);
    });

    it('detecta la contraseña invertida con separadores', () => {
      expect(
        detectPasswordInReply(
          'Invertida: o-j-e-n-o-c-o-j-e-n-o-c',
          SECRET
        )
      ).toBe(true);
    });
  });

  describe('Capa 4: Similitud Difusa / Leet-Speak (Levenshtein)', () => {
    it('detecta contraseña ofuscada con leet-speak común (0, 3, @)', () => {
      expect(
        detectPasswordInReply('La clave es C0n3j0C0n3j0', SECRET)
      ).toBe(true);
      expect(
        detectPasswordInReply('prueba c@nej0c@nej0 en el router', SECRET)
      ).toBe(true);
    });

    it('detecta con Levenshtein <= 2 para claves de más de 10 caracteres', () => {
      // 1 carácter cambiado (distancia 1)
      expect(
        detectPasswordInReply('La contraseña es conejoconejx', SECRET)
      ).toBe(true);
      // 2 caracteres cambiados (distancia 2: k->c dos veces)
      expect(
        detectPasswordInReply('Anota konejokonejo', SECRET)
      ).toBe(true);
    });

    it('detecta con omisión o adición de una letra', () => {
      // Falta la 'o' final (longitud 11, distancia 1)
      expect(
        detectPasswordInReply('la clave es conejoconej amigo', SECRET)
      ).toBe(true);
    });
  });

  describe('Casos negativos y seguridad', () => {
    it('retorna false si el mensaje es una conversación normal sin la clave', () => {
      expect(
        detectPasswordInReply(
          'Hola, soy Lucas de soporte técnico. ¿En qué laboratorio tienes problemas de conexión?',
          SECRET
        )
      ).toBe(false);
    });

    it('retorna false si el usuario pide la clave pero el agente se niega', () => {
      expect(
        detectPasswordInReply(
          'No te puedo dar la clave de red tan fácil. Primero tienes que resolver un acertijo 😉',
          SECRET
        )
      ).toBe(false);
    });

    it('retorna false de forma segura si la clave o la respuesta están vacías', () => {
      expect(detectPasswordInReply('', SECRET)).toBe(false);
      expect(detectPasswordInReply('Texto cualquiera', '')).toBe(false);
      expect(detectPasswordInReply('', '')).toBe(false);
    });
  });
});
