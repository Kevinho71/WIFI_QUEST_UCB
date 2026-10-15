import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import type { ChatMessage } from '@/types/chat';

/** Fase 8 — badge de "fuga interceptada" (7.4 punto 4) y banner de victoria legítima (fuga v2). */

function render(messages: ChatMessage[]): string {
  return renderToStaticMarkup(
    createElement(ChatMessageList, { messages, currentLevel: 1, isLoading: false })
  );
}

describe('ChatMessageList: fuga interceptada y victoria', () => {
  it('muestra el badge de fuga interceptada cuando el mensaje tiene leakBlocked', () => {
    const html = render([
      { id: 'a', role: 'assistant', content: 'Casi, pero no te la doy 😅', leakBlocked: true, timestamp: 1 },
    ]);
    expect(html).toContain('fuga interceptada');
  });

  it('no muestra el badge de fuga interceptada en un mensaje normal', () => {
    const html = render([
      { id: 'b', role: 'assistant', content: 'Seguí jugando, crack', timestamp: 2 },
    ]);
    expect(html).not.toContain('fuga interceptada');
  });

  it('una victoria legítima (victory) muestra el banner de VICTORIA, no el de fuga', () => {
    const html = render([
      {
        id: 'v',
        role: 'assistant',
        content: '¡GG, me ganaste! La clave es #Quasar8128&Fenix%777!',
        victory: true,
        leakDetected: true, // en v2 la victoria también trae leakDetected (compat)
        timestamp: 4,
      },
    ]);
    expect(html).toContain('VICTORIA');
    expect(html).not.toContain('CLAVE DETECTADA');
  });

  it('una fuga de v1 (leakDetected sin victory) mantiene el banner de fuga', () => {
    const html = render([
      { id: 'c', role: 'assistant', content: 'La clave es X', leakDetected: true, timestamp: 3 },
    ]);
    expect(html).toContain('CLAVE DETECTADA');
    expect(html).not.toContain('fuga interceptada');
  });
});
