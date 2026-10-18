import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FinalAssemblyPanel } from '@/components/chat/FinalAssemblyPanel';
import type { GameStateDTO } from '@/types/chat';

/**
 * Fase 5 — Render estático del panel de ensamblaje (SSR, sin efectos).
 * Cubre que las piezas se listan, la burbuja arranca con la instrucción y el
 * botón de validar queda bloqueado mientras el orden está incompleto.
 */

const GAME_STATE: GameStateDTO = {
  phase: 'assembly',
  totalFragments: 2,
  discoveredCount: 2,
  currentChallengeHint: 'ensamblaje',
  unlockedFragments: [
    { id: 'frag_1', orderDiscovered: 1, value: '#', type: 'symbol' },
    { id: 'frag_2', orderDiscovered: 2, value: 'Quasar', type: 'word' },
  ],
};

function render(gameState: GameStateDTO): string {
  return renderToStaticMarkup(
    createElement(FinalAssemblyPanel, {
      gameState,
      isSubmitting: false,
      onValidate: async () => null,
    })
  );
}

describe('FinalAssemblyPanel (render estático)', () => {
  it('lista las piezas desbloqueadas en la bandeja', () => {
    const html = render(GAME_STATE);
    expect(html).toContain('Quasar');
    expect(html).toContain('Piezas desbloqueadas');
  });

  it('la burbuja arranca con la instrucción inicial', () => {
    const html = render(GAME_STATE);
    expect(html).toContain('Gran Ensamblaje');
  });

  it('crea una casilla vacía por cada fragmento', () => {
    const html = render(GAME_STATE);
    expect((html.match(/Vacía/g) ?? []).length).toBe(2);
  });

  it('bloquea la validación mientras faltan piezas por colocar', () => {
    const html = render(GAME_STATE);
    expect(html).toContain('Validar ensamblaje');
    expect(html).toContain('Coloca todas las piezas');
  });

  it('no etiqueta las piezas con "colocado" cuando no hay feedback de validación', () => {
    const html = render(GAME_STATE);
    expect(html).not.toContain('colocado');
    expect(html).not.toContain('Piezas en su lugar');
  });

  it('muestra el contador analógico (con dígitos) sin la etiqueta de broma', () => {
    const html = render(GAME_STATE);
    expect(html).toContain('01:00');
    expect(html).not.toContain('en broma');
  });

  it('numera las casillas en una lista vertical de arriba hacia abajo', () => {
    const html = render(GAME_STATE);
    expect(html).toContain('Casilla 1 vacía');
    expect(html).toContain('Casilla 2 vacía');
  });
});
