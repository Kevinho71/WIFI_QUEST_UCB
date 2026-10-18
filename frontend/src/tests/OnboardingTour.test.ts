import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';

describe('OnboardingTour (render estático)', () => {
  it('no renderiza nada sin document (SSR)', () => {
    const html = renderToStaticMarkup(
      createElement(OnboardingTour, { level: 1, onClose: () => {} })
    );

    expect(html).toBe('');
  });
});
