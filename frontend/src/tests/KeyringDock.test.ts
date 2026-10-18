import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KeyringDock } from '@/components/chat/KeyringDock';

describe('KeyringDock (anclas de onboarding)', () => {
  it('expone el inventario y su botón de apertura', () => {
    const html = renderToStaticMarkup(
      createElement(KeyringDock, { gameState: null })
    );

    expect(html).toContain('data-tour="keyring"');
    expect(html).toContain('data-tour="keyring-toggle"');
    expect(html).toContain('Ver piezas');
  });
});
