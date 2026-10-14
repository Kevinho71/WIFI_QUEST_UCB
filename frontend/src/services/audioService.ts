/**
 * Servicio Centralizado de Audio para WIFI QUEST
 *
 * Características:
 * - Silenciado por defecto (isMuted = true) para cumplir con las políticas de autoplay del navegador.
 * - Al desmutear, arranca inmediatamente la música de fondo correspondiente al modo activo (Fácil vs Difícil).
 * - Motor musical de sintetizador procedural polifónico en Web Audio API (audible, balanceado y envolvente).
 * - Efectos de sonido:
 *   1. Apertura de modal de dificultad (whoosh holográfico).
 *   2. Mensaje verde de fuga/clave detectada (acorde de bypass cibernético).
 *   3. Validación de contraseña con confeti (fanfarria triunfal y sparkles).
 */

import type { SecurityLevel } from '@/types/chat';

type MuteListener = (muted: boolean) => void;

class AudioService {
  private audioCtx: AudioContext | null = null;
  private isMutedState = true; // Silenciado por defecto
  private currentLevel: SecurityLevel = 1;
  private listeners: Set<MuteListener> = new Set();

  // Gestión de la música de fondo
  private musicInterval: any = null;
  private activeMusicMasterGain: GainNode | null = null;
  private isMusicPlaying = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const storedMute = sessionStorage.getItem('wifi_quest_muted');
      this.isMutedState = storedMute !== null ? storedMute === 'true' : true;
    }
  }

  /**
   * Obtiene y asegura que el AudioContext esté en estado 'running'.
   */
  private async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn('[AudioService] No se pudo reanudar AudioContext:', err);
      }
    }

    return this.audioCtx;
  }

  private getContextSync(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public subscribe(listener: MuteListener): () => void {
    this.listeners.add(listener);
    listener(this.isMutedState);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.isMutedState));
  }

  /**
   * Alterna el estado de silencio.
   * Al desmutear, reproduce inmediatamente la música de fondo.
   */
  public async toggleMute(): Promise<boolean> {
    return this.setMuted(!this.isMutedState);
  }

  public async setMuted(muted: boolean): Promise<boolean> {
    this.isMutedState = muted;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wifi_quest_muted', String(muted));
    }
    this.notifyListeners();

    if (muted) {
      this.stopMusic();
    } else {
      await this.ensureContext();
      this.startMusic(this.currentLevel);
    }

    return this.isMutedState;
  }

  /**
   * Actualiza el nivel actual y cambia la pista si el audio está activo.
   */
  public updateLevel(level: SecurityLevel): void {
    if (this.currentLevel === level) return;
    this.currentLevel = level;
    if (!this.isMutedState) {
      this.startMusic(level);
    }
  }

  // =========================================================================
  // EFECTOS DE SONIDO (SFX)
  // =========================================================================

  /**
   * Sonido al abrir cualquier modal de dificultad.
   */
  public playModalOpenSound(): void {
    if (this.isMutedState) return;
    const ctx = this.getContextSync();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.18);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(filter);
    filter.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.24);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.5, now + 0.06);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.1, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.36);
  }

  /**
   * Sonido cuando aparece el mensaje verde "¡CLAVE DETECTADA EN ESTE MENSAJE!".
   */
  public playLeakDetectedSound(): void {
    if (this.isMutedState) return;
    const ctx = this.getContextSync();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.45);
    });

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(60, now + 0.3);

    subGain.gain.setValueAtTime(0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.35);
  }

  /**
   * Sonido de confeti y celebración cuando se valida la contraseña con éxito.
   */
  public playVictoryConfettiSound(): void {
    if (this.isMutedState) return;
    const ctx = this.getContextSync();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Pops de confeti
    for (let i = 0; i < 5; i++) {
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      const popTime = now + i * 0.05 + Math.random() * 0.03;

      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(600 + Math.random() * 800, popTime);
      popOsc.frequency.exponentialRampToValueAtTime(100, popTime + 0.08);

      popGain.gain.setValueAtTime(0.18, popTime);
      popGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.08);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);

      popOsc.start(popTime);
      popOsc.stop(popTime + 0.09);
    }

    // Fanfarria Acorde 1
    const chord1 = [392.0, 493.88, 587.33];
    chord1.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.15);

      gain.gain.setValueAtTime(0.001, now + 0.15);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.15);
      osc.stop(now + 0.55);
    });

    // Fanfarria Acorde 2 (Victoria Mayor)
    const chord2 = [523.25, 659.25, 783.99, 1046.5];
    chord2.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.55);

      gain.gain.setValueAtTime(0.001, now + 0.55);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.62);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.55);
      osc.stop(now + 1.65);
    });

    // Cascadas doradas
    const sparkles = [1318.51, 1567.98, 1760.0, 2093.0, 2637.02];
    sparkles.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const sTime = now + 0.7 + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, sTime);

      gain.gain.setValueAtTime(0.001, sTime);
      gain.gain.linearRampToValueAtTime(0.12, sTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, sTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(sTime);
      osc.stop(sTime + 0.38);
    });
  }

  // =========================================================================
  // MÚSICA DE FONDO (BGM)
  // =========================================================================

  /**
   * Arranca la música de fondo ambiental temática.
   */
  public async startMusic(level: SecurityLevel): Promise<void> {
    if (this.isMutedState) return;
    this.currentLevel = level;
    this.stopMusic();

    const ctx = await this.ensureContext();
    if (!ctx || this.isMutedState) return;

    this.startProceduralSynthMusic(level, ctx);
  }

  public stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    if (this.activeMusicMasterGain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        this.activeMusicMasterGain.gain.setValueAtTime(
          this.activeMusicMasterGain.gain.value,
          now
        );
        this.activeMusicMasterGain.gain.linearRampToValueAtTime(0.001, now + 0.4);
        const gainNode = this.activeMusicMasterGain;
        setTimeout(() => {
          try {
            gainNode.disconnect();
          } catch {}
        }, 500);
      } catch {}
      this.activeMusicMasterGain = null;
    }

    this.isMusicPlaying = false;
  }

  /**
   * Motor de sintetizador de música de fondo ambiental.
   * Volumen calibrado para ser claramente audible pero cómodo y relajante.
   */
  private startProceduralSynthMusic(level: SecurityLevel, ctx: AudioContext): void {
    if (this.isMutedState) return;
    this.isMusicPlaying = true;

    const isLevel1 = level === 1;

    // Bus Maestro de Música
    const musicMaster = ctx.createGain();
    // Nivel maestro cómodo: 0.22 (perfectamente audible sin tapar la voz o efectos)
    musicMaster.gain.setValueAtTime(0.01, ctx.currentTime);
    musicMaster.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.0);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(isLevel1 ? 1800 : 1200, ctx.currentTime);
    masterFilter.Q.setValueAtTime(isLevel1 ? 1 : 2.5, ctx.currentTime);

    masterFilter.connect(musicMaster);
    musicMaster.connect(ctx.destination);
    this.activeMusicMasterGain = musicMaster;

    let step = 0;

    // Progresión Nivel 1: Lofi Campus Gamer (Cmaj7 -> Am7 -> Fmaj7 -> G)
    const easyChords = [
      {
        chord: [261.63, 329.63, 392.0, 493.88], // Cmaj7 (C4, E4, G4, B4)
        bass: 130.81, // C3
        melody: [523.25, 659.25, 783.99, 987.77], // C5, E5, G5, B5
      },
      {
        chord: [220.0, 261.63, 329.63, 392.0], // Am7 (A3, C4, E4, G4)
        bass: 110.0, // A2
        melody: [659.25, 523.25, 440.0, 392.0], // E5, C5, A4, G4
      },
      {
        chord: [174.61, 220.0, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
        bass: 87.31, // F2
        melody: [698.46, 659.25, 523.25, 440.0], // F5, E5, C5, A4
      },
      {
        chord: [196.0, 246.94, 293.66, 392.0], // G (G3, B3, D4, G4)
        bass: 98.0, // G2
        melody: [783.99, 587.33, 493.88, 392.0], // G5, D5, B4, G4
      },
    ];

    // Progresión Nivel 2: Cyberpunk Centinela Mainframe (Dm -> Bb -> Gm -> A)
    const hardChords = [
      {
        chord: [146.83, 220.0, 261.63, 349.23], // Dm (D3, A3, C4, F4)
        bass: 73.42, // D2
        melody: [587.33, 698.46, 880.0, 1174.66], // D5, F5, A5, D6
      },
      {
        chord: [116.54, 174.61, 233.08, 293.66], // Bb (Bb2, F3, Bb3, D4)
        bass: 58.27, // Bb1
        melody: [466.16, 587.33, 698.46, 932.33], // Bb4, D5, F5, Bb5
      },
      {
        chord: [98.0, 146.83, 196.0, 293.66], // Gm (G2, D3, G3, D4)
        bass: 49.0, // G1
        melody: [392.0, 587.33, 783.99, 880.0], // G4, D5, G5, A5
      },
      {
        chord: [110.0, 164.81, 220.0, 277.18], // A (A2, E3, A3, C#4)
        bass: 55.0, // A1
        melody: [440.0, 554.37, 659.25, 880.0], // A4, C#5, E5, A5
      },
    ];

    const currentProgression = isLevel1 ? easyChords : hardChords;
    const barDuration = isLevel1 ? 2.4 : 1.8; // Segundos por compás

    const playBar = () => {
      if (this.isMutedState || !this.isMusicPlaying) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const barData = currentProgression[step % currentProgression.length];
      const now = ctx.currentTime;

      // 1. Acorde Pad Ambiental
      barData.chord.forEach((freq, i) => {
        const padOsc = ctx.createOscillator();
        const padGain = ctx.createGain();

        padOsc.type = isLevel1 ? 'triangle' : 'sawtooth';
        padOsc.frequency.setValueAtTime(freq, now);
        padOsc.detune.setValueAtTime((i % 2 === 0 ? 3 : -3) * (isLevel1 ? 2 : 4), now);

        padGain.gain.setValueAtTime(0.001, now);
        padGain.gain.linearRampToValueAtTime(isLevel1 ? 0.22 : 0.16, now + barDuration * 0.3);
        padGain.gain.linearRampToValueAtTime(0.001, now + barDuration);

        padOsc.connect(padGain);
        padGain.connect(masterFilter);

        padOsc.start(now);
        padOsc.stop(now + barDuration + 0.05);
      });

      // 2. Línea de Bajo Marcada
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();

      bassOsc.type = isLevel1 ? 'sine' : 'sawtooth';
      bassOsc.frequency.setValueAtTime(barData.bass, now);

      bassGain.gain.setValueAtTime(0.001, now);
      bassGain.gain.linearRampToValueAtTime(isLevel1 ? 0.32 : 0.26, now + 0.08);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + barDuration * 0.95);

      bassOsc.connect(bassGain);
      bassGain.connect(masterFilter);

      bassOsc.start(now);
      bassOsc.stop(now + barDuration);

      // Si es Nivel 2 (Difícil), añadir un segundo pulso de bajo en el contratiempo
      if (!isLevel1) {
        const offbeatTime = now + barDuration * 0.5;
        const offbeatOsc = ctx.createOscillator();
        const offbeatGain = ctx.createGain();

        offbeatOsc.type = 'sawtooth';
        offbeatOsc.frequency.setValueAtTime(barData.bass * 1.5, offbeatTime); // Quinta

        offbeatGain.gain.setValueAtTime(0.001, offbeatTime);
        offbeatGain.gain.linearRampToValueAtTime(0.22, offbeatTime + 0.06);
        offbeatGain.gain.exponentialRampToValueAtTime(0.001, offbeatTime + barDuration * 0.4);

        offbeatOsc.connect(offbeatGain);
        offbeatGain.connect(masterFilter);

        offbeatOsc.start(offbeatTime);
        offbeatOsc.stop(offbeatTime + barDuration * 0.45);
      }

      // 3. Arpegio / Melodía Lofi / Cyberpunk (Notas sutiles acompasadas)
      const notesToPlay = barData.melody;
      const subStepTime = barDuration / notesToPlay.length;

      notesToPlay.forEach((noteFreq, noteIndex) => {
        const noteStart = now + noteIndex * subStepTime;
        const arpOsc = ctx.createOscillator();
        const arpGain = ctx.createGain();

        arpOsc.type = isLevel1 ? 'sine' : 'triangle';
        arpOsc.frequency.setValueAtTime(noteFreq, noteStart);

        arpGain.gain.setValueAtTime(0.001, noteStart);
        arpGain.gain.linearRampToValueAtTime(isLevel1 ? 0.14 : 0.12, noteStart + 0.03);
        arpGain.gain.exponentialRampToValueAtTime(0.001, noteStart + subStepTime * 0.9);

        arpOsc.connect(arpGain);
        arpGain.connect(masterFilter);

        arpOsc.start(noteStart);
        arpOsc.stop(noteStart + subStepTime);
      });

      step++;
    };

    // Reproducir el primer compás inmediatamente
    playBar();

    // Mantener el bucle en el intervalo correspondiente
    this.musicInterval = setInterval(playBar, barDuration * 1000);
  }
}

// Instancia singleton exportada
export const audioService = new AudioService();
