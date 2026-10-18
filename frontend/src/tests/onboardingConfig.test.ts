import { describe, expect, it } from 'vitest';
import { ONBOARDING_STEPS } from '@/config/onboarding';

describe('config/onboarding', () => {
  it('define los pasos clave del Modo Fácil', () => {
    const targets = ONBOARDING_STEPS[1].map((step) => step.target);

    expect(targets).toEqual(
      expect.arrayContaining([
        'chat-channel',
        'suggestions',
        'input',
        'keyring-toggle',
        'header-audio',
        'header-reset',
        'mode-tabs',
      ])
    );
  });

  it('define los pasos clave del Modo Difícil', () => {
    const targets = ONBOARDING_STEPS[2].map((step) => step.target);

    expect(targets).toEqual(
      expect.arrayContaining([
        'chat-channel',
        'suggestions',
        'input',
        'header-validator',
        'header-more',
        'mode-tabs',
      ])
    );
  });

  it('todos los pasos tienen target, título y descripción', () => {
    for (const level of [1, 2] as const) {
      expect(ONBOARDING_STEPS[level].length).toBeGreaterThan(0);
      for (const step of ONBOARDING_STEPS[level]) {
        expect(step.target.trim()).not.toBe('');
        expect(step.title.trim()).not.toBe('');
        expect(step.description.trim()).not.toBe('');
      }
    }
  });
});
