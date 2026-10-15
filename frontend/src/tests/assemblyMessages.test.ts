import { describe, it, expect } from 'vitest';
import {
  ASSEMBLY_EXPIRED_TAUNT,
  ASSEMBLY_INTRO_MESSAGE,
  resolveAssemblyBubbleMessage,
} from '@/lib/assemblyMessages';

/**
 * Fase 5 — Regla "solo el último mensaje del LLM" en la burbuja del ensamblaje.
 */

describe('lib/assemblyMessages', () => {
  it('muestra la instrucción inicial cuando no hubo validación ni expiración', () => {
    expect(resolveAssemblyBubbleMessage(null, false)).toBe(ASSEMBLY_INTRO_MESSAGE);
  });

  it('muestra la burla cuando el minuto expiró y aún no hubo validación', () => {
    expect(resolveAssemblyBubbleMessage(null, true)).toBe(ASSEMBLY_EXPIRED_TAUNT);
  });

  it('el último mensaje del LLM SIEMPRE reemplaza lo anterior', () => {
    expect(resolveAssemblyBubbleMessage('respuesta de Lucas', false)).toBe('respuesta de Lucas');
    expect(resolveAssemblyBubbleMessage('respuesta de Lucas', true)).toBe('respuesta de Lucas');
  });
});
