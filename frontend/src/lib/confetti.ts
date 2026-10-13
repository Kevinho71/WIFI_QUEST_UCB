import confetti from 'canvas-confetti';

export function triggerVictoryConfetti(): void {
  // Disparo central de confeti
  const count = 220;
  const defaults = {
    origin: { y: 0.65 },
    zIndex: 99999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, {
    spread: 30,
    startVelocity: 60,
    colors: ['#E5A812', '#F59E0B', '#1E3A8A', '#FFFFFF', '#3B82F6'],
  });

  fire(0.2, {
    spread: 65,
    colors: ['#E5A812', '#FBBF24', '#0E2A47', '#93C5FD', '#FFFFFF'],
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.9,
    colors: ['#D97706', '#E5A812', '#1E3A8A', '#FFFFFF'],
  });

  fire(0.1, {
    spread: 130,
    startVelocity: 30,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#F59E0B', '#1E3A8A', '#FFFFFF'],
  });

  fire(0.1, {
    spread: 140,
    startVelocity: 50,
    colors: ['#E5A812', '#3B82F6', '#FFFFFF'],
  });

  // Salvas laterales adicionales
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      zIndex: 99999,
      colors: ['#E5A812', '#1E3A8A', '#FFFFFF'],
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      zIndex: 99999,
      colors: ['#F59E0B', '#3B82F6', '#FFFFFF'],
    });
  }, 250);
}
