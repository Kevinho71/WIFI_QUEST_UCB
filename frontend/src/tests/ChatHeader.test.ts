import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatHeader } from '@/components/chat/ChatHeader';
import type { SecurityLevel } from '@/types/chat';

function render(level: SecurityLevel): string {
  return renderToStaticMarkup(
    createElement(ChatHeader, {
      currentLevel: level,
      onSelectLevel: () => {},
      onResetChat: () => {},
      solvedLevels: { 1: false, 2: false },
      isValidatorOpen: false,
      onToggleValidator: () => {},
      onOpenModeInfo: () => {},
    })
  );
}

describe('ChatHeader (anclas de onboarding)', () => {
  it('expone audio, reinicio y pestañas en Modo Fácil', () => {
    const html = render(1);

    expect(html).toContain('data-tour="header-audio"');
    expect(html).toContain('data-tour="header-reset"');
    expect(html).toContain('data-tour="mode-tabs"');
  });

  it('expone validador, más opciones y pestañas en Modo Difícil', () => {
    const html = render(2);

    expect(html).toContain('data-tour="header-validator"');
    expect(html).toContain('data-tour="header-more"');
    expect(html).toContain('data-tour="mode-tabs"');
  });
});
