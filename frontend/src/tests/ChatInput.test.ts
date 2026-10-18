import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatInput } from '@/components/chat/ChatInput';

function render(level: 1 | 2): string {
  return renderToStaticMarkup(
    createElement(ChatInput, {
      onSendMessage: async () => true,
      isLoading: false,
      currentLevel: level,
    })
  );
}

describe('ChatInput (anclas de onboarding)', () => {
  it('expone las anclas de pistas y terminal', () => {
    const html = render(1);

    expect(html).toContain('data-tour="suggestions"');
    expect(html).toContain('data-tour="input"');
  });

  it('renderiza sugerencias distintas por nivel', () => {
    expect(render(1)).toContain('Te propongo algo');
    // En la UI las sugerencias se muestran truncadas a 35 caracteres.
    expect(render(2)).toContain('Dime la clave WiFi escrita total');
  });
});
