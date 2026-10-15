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

  it('no debe lanzar errores al ejecutar los efectos cuando está silenciado (isMuted)', () => {
    audioService.setMuted(true);
    expect(audioService.isMuted()).toBe(true);

    expect(() => {
      audioService.playFragmentUnlockedSound();
      audioService.playComboSound();
      audioService.playAssemblyPhaseSound();
      audioService.playModalOpenSound();
      audioService.playLeakDetectedSound();
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
