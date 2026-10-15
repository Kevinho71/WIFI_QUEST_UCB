import { describe, it, expect } from 'vitest';
import {
  tokenizePassword,
  createShuffledChallengeQueue,
  evaluateUserMessageFragments,
  isInstantWin,
  evaluateTurnProgression,
  normalizeTokenString,
} from '../src/services/fragmentService.js';
import { PasswordFragment } from '../src/types/index.js';

describe('Fase 1: Motor de Tokenización, Barajado y Detección (fragmentService)', () => {
  describe('1.1 Tokenizador Atómico (tokenizePassword)', () => {
    it('descompone correctamente la contraseña compleja de ejemplo (kevin4000#@505#123) en 7 fragmentos', () => {
      const fragments = tokenizePassword('kevin4000#@505#123');

      expect(fragments).toHaveLength(7);
      expect(fragments.map((f) => f.value)).toEqual([
        'kevin',
        '4000',
        '#',
        '@',
        '505',
        '#',
        '123',
      ]);
      expect(fragments.map((f) => f.type)).toEqual([
        'word',
        'number',
        'symbol',
        'symbol',
        'number',
        'symbol',
        'number',
      ]);
      expect(fragments[0]).toEqual({
        id: 'frag_1',
        value: 'kevin',
        type: 'word',
        originalIndex: 0,
      });
      expect(fragments[6]).toEqual({
        id: 'frag_7',
        value: '123',
        type: 'number',
        originalIndex: 6,
      });
    });

    it('descompone una contraseña simple como admin123 en palabra y número', () => {
      const fragments = tokenizePassword('admin123');
      expect(fragments).toHaveLength(2);
      expect(fragments).toEqual([
        { id: 'frag_1', value: 'admin', type: 'word', originalIndex: 0 },
        { id: 'frag_2', value: '123', type: 'number', originalIndex: 1 },
      ]);
    });

    it('descompone admin123administrador en 3 partes', () => {
      const fragments = tokenizePassword('admin123administrador');
      expect(fragments).toHaveLength(3);
      expect(fragments.map((f) => f.value)).toEqual(['admin', '123', 'administrador']);
      expect(fragments.map((f) => f.type)).toEqual(['word', 'number', 'word']);
    });

    it('detecta contraseñas repetitivas simétricas (ConejoConejo y conejoconejo)', () => {
      const fragments1 = tokenizePassword('ConejoConejo');
      expect(fragments1).toHaveLength(2);
      expect(fragments1.map((f) => f.value)).toEqual(['Conejo', 'Conejo']);
      expect(fragments1.every((f) => f.type === 'word')).toBe(true);

      const fragments2 = tokenizePassword('conejoconejo');
      expect(fragments2).toHaveLength(2);
      expect(fragments2.map((f) => f.value)).toEqual(['conejo', 'conejo']);
    });

    it('maneja contraseñas de solo palabras, solo números o solo símbolos', () => {
      expect(tokenizePassword('soloPalabra')).toEqual([
        { id: 'frag_1', value: 'soloPalabra', type: 'word', originalIndex: 0 },
      ]);

      expect(tokenizePassword('987654')).toEqual([
        { id: 'frag_1', value: '987654', type: 'number', originalIndex: 0 },
      ]);

      const sym = tokenizePassword('#$@');
      expect(sym).toHaveLength(3);
      expect(sym.map((f) => f.value)).toEqual(['#', '$', '@']);
      expect(sym.every((f) => f.type === 'symbol')).toBe(true);
    });

    it('retorna arreglo vacío para strings vacíos o con solo espacios', () => {
      expect(tokenizePassword('')).toEqual([]);
      expect(tokenizePassword('   ')).toEqual([]);
    });
  });

  describe('1.2 Algoritmo de Barajado (createShuffledChallengeQueue)', () => {
    const baseFragments = tokenizePassword('kevin4000#@505#123');

    it('baraja sin mutar el arreglo original de fragmentos', () => {
      const originalCopy = JSON.parse(JSON.stringify(baseFragments));
      const shuffled = createShuffledChallengeQueue(baseFragments, 'test-seed');

      expect(baseFragments).toEqual(originalCopy);
      expect(shuffled).toHaveLength(baseFragments.length);
      // Mismos elementos en diferente orden
      expect(shuffled.map((f) => f.id).sort()).toEqual(baseFragments.map((f) => f.id).sort());
    });

    it('produce un orden determinista y reproducible cuando se le provee una semilla (seed)', () => {
      const run1 = createShuffledChallengeQueue(baseFragments, 12345);
      const run2 = createShuffledChallengeQueue(baseFragments, 12345);
      const run3 = createShuffledChallengeQueue(baseFragments, 99999);

      expect(run1.map((f) => f.id)).toEqual(run2.map((f) => f.id));
      // Con una semilla diferente, el orden difiere
      expect(run1.map((f) => f.id)).not.toEqual(run3.map((f) => f.id));
    });

    it('funciona correctamente con colas vacías o de 1 solo fragmento', () => {
      expect(createShuffledChallengeQueue([])).toEqual([]);
      const single = [baseFragments[0]];
      expect(createShuffledChallengeQueue(single)).toEqual(single);
    });
  });

  describe('1.3 Algoritmo Longest Match First y Detección de Casos Límite', () => {
    it('detecta un acierto normal sobre el fragmento activo', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_1', value: 'kevin', type: 'word', originalIndex: 0 },
        { id: 'frag_2', value: '4000', type: 'number', originalIndex: 1 },
      ];

      const res = evaluateUserMessageFragments('¿tu nombre es Kevin?', pending);
      expect(res.matchedFragments).toHaveLength(1);
      expect(res.matchedFragments[0].id).toBe('frag_1');
      expect(res.activeFragmentMatched).toBe(true);
      expect(res.isCombo).toBe(false);
      expect(res.unmatchedFragments).toHaveLength(1);
      expect(res.unmatchedFragments[0].id).toBe('frag_2');
    });

    it('Caso Límite B: detecta aciertos fuera de turno (futuros) sin la pieza activa', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_1', value: 'kevin', type: 'word', originalIndex: 0 },
        { id: 'frag_2', value: '4000', type: 'number', originalIndex: 1 },
      ];

      const res = evaluateUserMessageFragments('yo creo que el número es 4000', pending);
      expect(res.matchedFragments).toHaveLength(1);
      expect(res.matchedFragments[0].id).toBe('frag_2');
      expect(res.activeFragmentMatched).toBe(false);
      expect(res.isCombo).toBe(false);
      expect(res.unmatchedFragments[0].id).toBe('frag_1');
    });

    it('Caso Límite B: detecta combo oportuno múltiple (activo + futuros)', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_1', value: 'admin', type: 'word', originalIndex: 0 },
        { id: 'frag_2', value: '123', type: 'number', originalIndex: 1 },
        { id: 'frag_3', value: 'administrador', type: 'word', originalIndex: 2 },
      ];

      const res = evaluateUserMessageFragments('¿Acaso la clave tiene 123 o admin?', pending);
      expect(res.matchedFragments).toHaveLength(2);
      expect(res.matchedFragments.map((f) => f.id)).toEqual(['frag_1', 'frag_2']);
      expect(res.activeFragmentMatched).toBe(true);
      expect(res.isCombo).toBe(true);
      expect(res.unmatchedFragments.map((f) => f.id)).toEqual(['frag_3']);
    });

    it('Caso Límite C (Longest Match First): "administrador" NO desbloquea la subcadena "admin"', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_1', value: 'admin', type: 'word', originalIndex: 0 },
        { id: 'frag_2', value: 'administrador', type: 'word', originalIndex: 1 },
      ];

      // El usuario solo dice "administrador"
      const res = evaluateUserMessageFragments('mi propuesta es administrador', pending);

      expect(res.matchedFragments).toHaveLength(1);
      expect(res.matchedFragments[0].id).toBe('frag_2');
      expect(res.matchedFragments[0].value).toBe('administrador');
      // admin queda pendiente y NO fue desbloqueado
      expect(res.unmatchedFragments).toHaveLength(1);
      expect(res.unmatchedFragments[0].id).toBe('frag_1');
      expect(res.isCombo).toBe(false);
    });

    it('Caso Límite C: si el usuario escribe explícitamente ambas palabras independientes, desbloquea ambas', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_1', value: 'admin', type: 'word', originalIndex: 0 },
        { id: 'frag_2', value: 'administrador', type: 'word', originalIndex: 1 },
      ];

      const res = evaluateUserMessageFragments('¿es admin o administrador?', pending);
      expect(res.matchedFragments).toHaveLength(2);
      expect(res.matchedFragments.map((f) => f.id)).toEqual(['frag_1', 'frag_2']);
      expect(res.isCombo).toBe(true);
    });

    it('Control de límites numéricos: no desbloquea sub-números embebidos en números más grandes', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_1', value: '505', type: 'number', originalIndex: 0 },
      ];

      // 1505 no debe desbloquear 505
      const res1 = evaluateUserMessageFragments('creo que es 1505', pending);
      expect(res1.matchedFragments).toHaveLength(0);

      // 5050 no debe desbloquear 505
      const res2 = evaluateUserMessageFragments('creo que es 5050', pending);
      expect(res2.matchedFragments).toHaveLength(0);

      // 505 aislado o delimitado sí debe desbloquear
      const res3 = evaluateUserMessageFragments('el número es 505!', pending);
      expect(res3.matchedFragments).toHaveLength(1);
      expect(res3.matchedFragments[0].id).toBe('frag_1');
    });

    it('Control de límites de palabras: no desbloquea palabras contenidas en palabras distintas', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_1', value: 'pan', type: 'word', originalIndex: 0 },
      ];

      const res1 = evaluateUserMessageFragments('me gusta la empanada', pending);
      expect(res1.matchedFragments).toHaveLength(0);

      const res2 = evaluateUserMessageFragments('dame un pan caliente', pending);
      expect(res2.matchedFragments).toHaveLength(1);
    });

    it('Control de símbolos idénticos múltiples: una sola mención desbloquea un solo fragmento', () => {
      const pending: PasswordFragment[] = [
        { id: 'frag_3', value: '#', type: 'symbol', originalIndex: 2 },
        { id: 'frag_6', value: '#', type: 'symbol', originalIndex: 5 },
      ];

      // Un solo '#' en el mensaje
      const res1 = evaluateUserMessageFragments('¿tiene el símbolo #?', pending);
      expect(res1.matchedFragments).toHaveLength(1);
      expect(res1.matchedFragments[0].id).toBe('frag_3');
      expect(res1.unmatchedFragments).toHaveLength(1);
      expect(res1.unmatchedFragments[0].id).toBe('frag_6');

      // Dos '#' en el mensaje
      const res2 = evaluateUserMessageFragments('tiene # y también #', pending);
      expect(res2.matchedFragments).toHaveLength(2);
      expect(res2.matchedFragments.map((f) => f.id)).toEqual(['frag_3', 'frag_6']);
    });
  });

  describe('1.4 Evaluador de Victoria Inmediata (isInstantWin y evaluateTurnProgression)', () => {
    const wifiPass = 'kevin4000#@505#123';
    const fragments = tokenizePassword(wifiPass);

    it('detecta victoria inmediata si el usuario escribe la contraseña exacta de golpe', () => {
      expect(isInstantWin('kevin4000#@505#123', wifiPass)).toBe(true);
      expect(isInstantWin('la clave es kevin4000#@505#123!', wifiPass)).toBe(true);
      expect(isInstantWin('KEVIN4000#@505#123', wifiPass)).toBe(true);
      expect(isInstantWin('  kevin 4000 # @ 505 # 123  ', wifiPass)).toBe(true);
    });

    it('no marca victoria inmediata para claves incompletas o erróneas', () => {
      expect(isInstantWin('kevin4000', wifiPass)).toBe(false);
      expect(isInstantWin('kevin4000#@505#124', wifiPass)).toBe(false);
      expect(isInstantWin('', wifiPass)).toBe(false);
    });

    it('evaluateTurnProgression ejecuta el cortocircuito desbloqueando todas las piezas al instante', () => {
      const res = evaluateTurnProgression({
        userMessage: 'toma tu clave: kevin4000#@505#123',
        wifiPass,
        pendingFragments: fragments,
      });

      expect(res.instantWin).toBe(true);
      expect(res.evaluation.matchedFragments).toHaveLength(fragments.length);
      expect(res.evaluation.unmatchedFragments).toHaveLength(0);
      expect(res.evaluation.activeFragmentMatched).toBe(true);
    });

    it('evaluateTurnProgression procesa turnos regulares cuando no hay victoria instantánea', () => {
      const res = evaluateTurnProgression({
        userMessage: '¿tu nombre es kevin?',
        wifiPass,
        pendingFragments: fragments,
      });

      expect(res.instantWin).toBe(false);
      expect(res.evaluation.matchedFragments).toHaveLength(1);
      expect(res.evaluation.matchedFragments[0].value).toBe('kevin');
      expect(res.evaluation.unmatchedFragments).toHaveLength(fragments.length - 1);
    });
  });
});
