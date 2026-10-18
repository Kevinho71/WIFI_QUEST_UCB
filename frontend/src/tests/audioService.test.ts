import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioService } from '../services/audioService';

describe('AudioService - Sonidos Procedurales de WIFI QUEST (Fase 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('debe tener definidos los métodos de sonido requeridos por la Fase 5', () => {
    expect(typeof audioService.playFragmentUnlockedSound).toBe('function');
    expect(typeof audioService.playComboSound).toBe('function');
    expect(typeof audioService.playAssemblyPhaseSound).toBe('function');
  });

  it('expone el blip de respuesta del LLM (transiciones de frontend)', () => {
    expect(typeof audioService.playLlmReplySound).toBe('function');
  });

  it('debe exponer los efectos y el modo del Ensamblaje Final (Fase 4)', () => {
    expect(typeof audioService.playPiecePlaceSound).toBe('function');
    expect(typeof audioService.playSlotCorrectSound).toBe('function');
    expect(typeof audioService.playAssemblyWrongSound).toBe('function');
    expect(typeof audioService.playAssemblyWarningSound).toBe('function');
    expect(typeof audioService.playAssemblyTickSound).toBe('function');
    expect(typeof audioService.playAssemblyExpiredSound).toBe('function');
    expect(typeof audioService.setAssemblyMode).toBe('function');
    expect(typeof audioService.setAssemblyUrgency).toBe('function');
  });

  it('no lanza errores con los efectos y el modo de ensamblaje si está silenciado', async () => {
    await audioService.setMuted(true);
    expect(audioService.isMuted()).toBe(true);

    expect(() => {
      audioService.playPiecePlaceSound();
      audioService.playSlotCorrectSound();
      audioService.playAssemblyWrongSound();
      audioService.playAssemblyWarningSound();
      audioService.playAssemblyTickSound();
      audioService.playAssemblyExpiredSound();
      audioService.setAssemblyUrgency('critical');
    }).not.toThrow();

    await expect(audioService.setAssemblyMode(true)).resolves.toBeUndefined();
    await expect(audioService.setAssemblyMode(false)).resolves.toBeUndefined();
  });

  it('no debe lanzar errores al ejecutar los efectos cuando está silenciado (isMuted)', () => {
    audioService.setMuted(true);
    expect(audioService.isMuted()).toBe(true);

    expect(() => {
      audioService.playFragmentUnlockedSound();
      audioService.playComboSound();
      audioService.playAssemblyPhaseSound();
      audioService.playModalOpenSound();
      audioService.playLeakDetectedSound();
      audioService.playLlmReplySound();
    }).not.toThrow();
  });

  it('debe permitir suscribirse al cambio de estado de silencio', () => {
    let capturedMuted: boolean | null = null;
    const unsubscribe = audioService.subscribe((muted) => {
      capturedMuted = muted;
    });

    audioService.setMuted(false);
    expect(capturedMuted).toBe(false);

    audioService.setMuted(true);
    expect(capturedMuted).toBe(true);

    unsubscribe();
  });
});
