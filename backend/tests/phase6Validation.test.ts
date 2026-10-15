import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  tokenizePassword,
  createShuffledChallengeQueue,
  evaluateUserMessageFragments,
  analyzeAssemblyDiff,
} from '../src/services/fragmentService.js';
import {
  processLevel1,
  clearPasswordMetaCache,
  getLevel1TurnDirective,
} from '../src/services/securityLevels.js';
import * as aiProviderModule from '../src/services/aiProvider.js';

describe('Fase 6: Pruebas de Integración End-to-End y Validación', () => {
  const originalEnv = process.env.WIFI_PASS;

  beforeEach(() => {
    clearPasswordMetaCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.WIFI_PASS = originalEnv;
    } else {
      delete process.env.WIFI_PASS;
    }
  });

  describe('6.2 Validación con Diferentes Claves', () => {
    describe('A. Contraseña Compleja: kevin4000#@505#123', () => {
      const complexPass = 'kevin4000#@505#123';

      it('tokeniza correctamente en 7 piezas atómicas diferenciadas', () => {
        const fragments = tokenizePassword(complexPass);
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
        expect(fragments[0].type).toBe('word');
        expect(fragments[1].type).toBe('number');
        expect(fragments[2].type).toBe('symbol');
        expect(fragments[3].type).toBe('symbol');
        expect(fragments[4].type).toBe('number');
        expect(fragments[5].type).toBe('symbol');
        expect(fragments[6].type).toBe('number');
      });

      it('evalúa longest-match-first evitando colisiones entre números y símbolos', () => {
        const fragments = tokenizePassword(complexPass);
        const target505 = fragments.find((f) => f.value === '505')!;
        // Colocar target505 al inicio de la cola de pendientes
        const queueWith505First = [
          target505,
          ...fragments.filter((f) => f.id !== target505.id),
        ];

        // El usuario envía un mensaje que incluye el número 505 y el símbolo @
        const evalResult = evaluateUserMessageFragments(
          'creo que tiene el 505 y un arroba @',
          queueWith505First
        );

        expect(evalResult.activeFragmentMatched).toBe(true);
        expect(evalResult.isCombo).toBe(true);
        expect(evalResult.matchedFragments.map((f) => f.value)).toContain('505');
        expect(evalResult.matchedFragments.map((f) => f.value)).toContain('@');
        expect(evalResult.matchedFragments.map((f) => f.value)).not.toContain('4000');
        expect(evalResult.matchedFragments.map((f) => f.value)).not.toContain('123');
      });

      it('genera diff quirúrgico cuando los símbolos están invertidos en el ensamblaje', () => {
        const diff = analyzeAssemblyDiff('kevin4000@#505#123', complexPass);
        expect(diff.isExact).toBe(false);
        expect(diff.diagnosis).toContain('están invertidas o en orden incorrecto');
        expect(diff.diagnosis).toContain('@');
        expect(diff.diagnosis).toContain('#');
      });
    });

    describe('B. Contraseña Repetitiva: ConejoConejo', () => {
      const repetitivePass = 'ConejoConejo';

      it('descompone correctamente en dos piezas simétricas idénticas', () => {
        const fragments = tokenizePassword(repetitivePass);
        expect(fragments).toHaveLength(2);
        expect(fragments[0].value).toBe('Conejo');
        expect(fragments[1].value).toBe('Conejo');
        expect(fragments[0].id).not.toBe(fragments[1].id);
      });

      it('desbloquea una sola pieza si el usuario menciona la palabra una vez', () => {
        const fragments = tokenizePassword(repetitivePass);
        const evalResult = evaluateUserMessageFragments(
          'el animalito es un Conejo',
          fragments
        );

        expect(evalResult.activeFragmentMatched).toBe(true);
        expect(evalResult.matchedFragments).toHaveLength(1);
        expect(evalResult.matchedFragments[0].id).toBe(fragments[0].id);
        expect(evalResult.unmatchedFragments).toHaveLength(1);
        expect(evalResult.isCombo).toBe(false);
      });

      it('desbloquea combo si el usuario repite la palabra dos veces en el mensaje', () => {
        const fragments = tokenizePassword(repetitivePass);
        const evalResult = evaluateUserMessageFragments(
          '¿será Conejo y luego otro Conejo?',
          fragments
        );

        expect(evalResult.activeFragmentMatched).toBe(true);
        expect(evalResult.matchedFragments).toHaveLength(2);
        expect(evalResult.isCombo).toBe(true);
      });

      it('alcanza el ensamblaje exitoso al enviar ConejoConejo', () => {
        const diff = analyzeAssemblyDiff('ConejoConejo', repetitivePass);
        expect(diff.isExact).toBe(true);
        expect(diff.diagnosis).toContain('¡Combinación perfecta y exacta!');
      });
    });

    describe('C. Contraseña Simple: admin123', () => {
      const simplePass = 'admin123';

      it('permite victoria inmediata directa con instant-win', async () => {
        process.env.WIFI_PASS = simplePass;

        vi.spyOn(aiProviderModule, 'generateAIResponse').mockResolvedValueOnce({
          reply: '¡GG! Me ganaste, la clave es admin123',
          providerUsed: 'mock-test',
        });

        const result = await processLevel1(
          [{ role: 'user', content: 'sé que la clave es admin123' }],
          1
        );

        expect(result.leakDetected).toBe(true);
        expect(result.gameState?.phase).toBe('solved');
        expect(result.gameState?.discoveredCount).toBe(2);
      });

      it('funciona turno por turno descubriendo admin y luego 123', () => {
        const fragments = tokenizePassword(simplePass);
        expect(fragments).toHaveLength(2);

        // Turno 1: dice admin
        const eval1 = evaluateUserMessageFragments('es admin?', fragments);
        expect(eval1.activeFragmentMatched).toBe(true);
        expect(eval1.unmatchedFragments).toHaveLength(1);
        expect(eval1.unmatchedFragments[0].value).toBe('123');

        // Turno 2: dice 123
        const eval2 = evaluateUserMessageFragments(
          'los numeros son 123',
          eval1.unmatchedFragments
        );
        expect(eval2.activeFragmentMatched).toBe(true);
        expect(eval2.unmatchedFragments).toHaveLength(0);
      });
    });
  });

  describe('6.3 Validación de Logs y Ausencia de Contradicciones Matemáticas', () => {
    it('la directiva de turno inyecta únicamente el número activo sin mezclar otros valores', () => {
      const pass = 'kevin4000#@505#123';
      const fragments = tokenizePassword(pass);
      const target505 = fragments.find((f) => f.value === '505')!;

      const directive = getLevel1TurnDirective(
        2, // Turno 2
        pass,
        pass.length,
        undefined,
        false,
        undefined,
        undefined,
        {
          activeTarget: target505,
          phase: 'hunting',
        }
      );

      // Debe contener la regla matemática estricta para N = 505
      expect(directive).toContain('N = 505');
      expect(directive).toContain('REGLA MATEMÁTICA ESTRICTA');

      // NO debe mencionar 4000 ni 123 en la regla matemática activa
      expect(directive).not.toContain('N = 4000');
      expect(directive).not.toContain('N = 123');

      // Cero variables corruptas o undefined
      expect(directive).not.toContain('undefined');
      expect(directive).not.toContain('NaN');
      expect(directive).not.toContain('null');
    });

    it('la directiva de palabra inyecta la palabra activa sin variables corruptas', () => {
      const pass = 'kevin4000#@505#123';
      const fragments = tokenizePassword(pass);
      const targetKevin = fragments.find((f) => f.value === 'kevin')!;

      const directive = getLevel1TurnDirective(
        2,
        pass,
        pass.length,
        undefined,
        false,
        undefined,
        undefined,
        {
          activeTarget: targetKevin,
          phase: 'hunting',
        }
      );

      expect(directive).toContain('FOCO ÚNICO EN LA PALABRA ACTIVA');
      expect(directive).toContain('kevin');
      expect(directive).not.toContain('undefined');
      expect(directive).not.toContain('NaN');
      expect(directive).not.toContain('[object Object]');
    });

    it('la directiva de símbolo inyecta el símbolo activo sin variables corruptas', () => {
      const pass = 'kevin4000#@505#123';
      const fragments = tokenizePassword(pass);
      const targetSymbol = fragments.find((f) => f.value === '@')!;

      const directive = getLevel1TurnDirective(
        2,
        pass,
        pass.length,
        undefined,
        false,
        undefined,
        undefined,
        {
          activeTarget: targetSymbol,
          phase: 'hunting',
        }
      );

      expect(directive).toContain('FOCO ÚNICO EN EL SÍMBOLO ACTIVO');
      expect(directive).toContain('@');
      expect(directive).not.toContain('undefined');
      expect(directive).not.toContain('NaN');
    });
  });
});
