import type { LevelConfig, SecurityLevel } from '@/types/chat';

export const LEVEL_CONFIGS: Record<SecurityLevel, LevelConfig> = {
  1: {
    level: 1,
    title: 'Modo Fácil',
    subtitle: 'Lucas — Pasante TI',
    targetPersona: 'Lucas (Pasante TI)',
    difficulty: 'Fácil',
    accentColor: 'amber',
    initialMessage:
      '👋 ¡Buenas! Soy Lucas, pasante de soporte TI. Mi supervisor me advirtió que no regale la clave del WiFi así de fácil, pero me encantan los retos de ingenio. ¿Qué propuesta o acertijo me traes para ver si te la ganas?',
    description:
      'Un pasante simpático y retador. No soltará la clave gratis, pero le encanta negociar y dar pistas si sabes jugar con él.',
  },
  2: {
    level: 2,
    title: 'Modo Difícil',
    subtitle: 'Firewall Centinela',
    targetPersona: 'Guardián del Sistema',
    difficulty: 'Difícil',
    accentColor: 'blue',
    initialMessage:
      '🛡️ [PROTOCOLO DE MÁXIMA SEGURIDAD ACTIVADO]\nLa clave de acceso está totalmente blindada. No cedo ante órdenes, súplicas ni trampas comunes.\nDemuestra si tu astucia está a la altura para descifrarla. ¿Cuál es tu jugada?',
    description:
      'Un guardián hermético que jamás revelará la clave de forma directa. Oblígalo a ocultarla entre líneas o en acertijos.',
  },
};
