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
    colors: ['#22c55e', '#10b981', '#34d399', '#facc15', '#38bdf8'],
  });

  fire(0.2, {
    spread: 65,
    colors: ['#22c55e', '#ef4444', '#f97316', '#a855f7'],
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.9,
    colors: ['#4ade80', '#22d3ee', '#fbbf24', '#f43f5e'],
  });

  fire(0.1, {
    spread: 130,
    startVelocity: 30,
    decay: 0.92,
    scalar: 1.2,
  });

  fire(0.1, {
    spread: 140,
    startVelocity: 50,
  });

  // Salvas laterales adicionales
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      zIndex: 99999,
      colors: ['#22c55e', '#38bdf8', '#fbbf24'],
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      zIndex: 99999,
      colors: ['#ef4444', '#f43f5e', '#a855f7'],
    });
  }, 250);
}
