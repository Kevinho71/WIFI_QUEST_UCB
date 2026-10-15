import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../../src/engine/blueprint.js';
import { computeAssemblyFeedback } from '../../src/engine/matching.js';

/**
 * Fase 1 — Feedback por posición del ensamblaje.
 *
 * `computeAssemblyFeedback` solo confía en el payload cuando este es consistente
 * (misma longitud, concatenación exacta y multiset del inventario). El resultado
 * expone únicamente booleanos por posición y contadores, nunca la clave.
 */

const KEY = '#Quasar8128&Fenix%777!';

describe('computeAssemblyFeedback', () => {
  const bp = buildBlueprint(KEY);
  const keyPieces = bp.fragments.map((f) => f.value);
  // Todas las piezas del inventario, en un orden incorrecto (solo acierta la primera).
  const attemptPieces = ['#', 'Fenix', '777', '!', 'Quasar', '8128', '&', '%'];
  const ATTEMPT = attemptPieces.join('');

  it('orden exacto: todas las posiciones son correctas', () => {
    const feedback = computeAssemblyFeedback(KEY, keyPieces, bp);

    expect(feedback).toBeDefined();
    expect(feedback?.total).toBe(bp.fragments.length);
    expect(feedback?.wellPlaced).toBe(bp.fragments.length);
    expect(feedback?.slotCorrect).toEqual(new Array(bp.fragments.length).fill(true));
  });

  it('orden parcial: solo marca las posiciones acertadas', () => {
    const feedback = computeAssemblyFeedback(ATTEMPT, attemptPieces, bp);

    expect(feedback).toBeDefined();
    expect(feedback?.total).toBe(8);
    // Este intento solo acierta la primera posición ("#").
    expect(feedback?.wellPlaced).toBe(1);
    expect(feedback?.slotCorrect).toEqual([true, false, false, false, false, false, false, false]);
  });

  it('orden totalmente incorrecto (mismas piezas, permutadas): ninguna posición', () => {
    // Rotación completa: mismo multiset, ninguna pieza en su lugar.
    const rotated = [...keyPieces.slice(1), keyPieces[0]];
    const joined = rotated.join('');

    const feedback = computeAssemblyFeedback(joined, rotated, bp);

    expect(feedback).toBeDefined();
    expect(feedback?.wellPlaced).toBe(0);
    expect(feedback?.slotCorrect.every((ok) => ok === false)).toBe(true);
  });

  it('devuelve undefined si no se envían piezas', () => {
    expect(computeAssemblyFeedback(KEY, undefined, bp)).toBeUndefined();
    expect(computeAssemblyFeedback(KEY, [], bp)).toBeUndefined();
  });

  it('devuelve undefined si la concatenación no coincide con el mensaje', () => {
    expect(computeAssemblyFeedback('otra cosa', keyPieces, bp)).toBeUndefined();
  });

  it('devuelve undefined si la longitud no coincide con el inventario', () => {
    expect(computeAssemblyFeedback('#', ['#'], bp)).toBeUndefined();
  });

  it('devuelve undefined si hay una pieza ajena al inventario (multiset distinto)', () => {
    const tampered = [...keyPieces.slice(0, -1), 'Intruso'];
    const joined = tampered.join('');

    expect(computeAssemblyFeedback(joined, tampered, bp)).toBeUndefined();
  });

  it('el resultado nunca filtra valores de la clave', () => {
    const feedback = computeAssemblyFeedback(ATTEMPT, attemptPieces, bp);
    const serialized = JSON.stringify(feedback);

    for (const value of keyPieces) {
      expect(serialized).not.toContain(value);
    }
  });
});
