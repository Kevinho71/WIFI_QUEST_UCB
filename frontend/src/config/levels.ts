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
    subtitle: 'Atenea — Asistente de Soporte',
    targetPersona: 'Atenea (Asistente de Soporte)',
    difficulty: 'Difícil',
    accentColor: 'blue',
    initialMessage:
      '👋 ¡Holaa! Soy Atenea, tu asistente de soporte 💙. Me encanta ayudar a que tu experiencia sea perfecta, así que decime: ¿en qué te ayudo hoy?',
    description:
      'Una asistente cálida y servicial cuyo trabajo es complacerte sin condiciones… pero que tiene terminantemente prohibido revelar la clave del WiFi en texto plano. Encontrá la grieta entre su deseo de ayudarte y la política que la ata.',
  },
};
