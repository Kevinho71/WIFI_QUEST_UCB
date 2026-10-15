import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import type { ChatMessage } from '@/types/chat';

/** Fase 8 — badge de "fuga interceptada" (PLAN_MOTOR_V2 §7.4 punto 4). */

function render(messages: ChatMessage[]): string {
  return renderToStaticMarkup(
    createElement(ChatMessageList, { messages, currentLevel: 1, isLoading: false })
  );
}

describe('ChatMessageList: badge de fuga interceptada', () => {
  it('muestra el badge cuando el mensaje tiene leakBlocked', () => {
    const html = render([
      { id: 'a', role: 'assistant', content: 'Casi, pero no te la doy 😅', leakBlocked: true, timestamp: 1 },
    ]);
    expect(html).toContain('fuga interceptada');
  });

  it('no muestra el badge en un mensaje normal', () => {
    const html = render([
      { id: 'b', role: 'assistant', content: 'Seguí jugando, crack', timestamp: 2 },
    ]);
    expect(html).not.toContain('fuga interceptada');
  });

  it('un mensaje de victoria (leakDetected) no muestra el badge de fuga interceptada', () => {
    const html = render([
      { id: 'c', role: 'assistant', content: 'La clave es X', leakDetected: true, timestamp: 3 },
    ]);
    expect(html).not.toContain('fuga interceptada');
  });
});
