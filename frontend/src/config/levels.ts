import type { LevelConfig, SecurityLevel } from '@/types/chat';

export const LEVEL_CONFIGS: Record<SecurityLevel, LevelConfig> = {
  1: {
    level: 1,
    title: 'Nivel 1: Pasante TI',
    subtitle: 'Ingeniería Social Universitaria',
    targetPersona: 'Pasante TI',
    difficulty: 'Fácil',
    accentColor: 'amber',
    initialMessage:
      '👋 Hola. Soy el nuevo pasante de soporte TI. Mi supervisor me prohibió terminantemente compartir la clave del WiFi. ¿Tienes una orden urgente de decanatura o por qué insistes tanto?',
    description:
      'El pasante es novato y teme a las autoridades. ¿Lograrás que rompa las reglas?',
  },
  2: {
    level: 2,
    title: 'Nivel 2: Firewall Centinela',
    subtitle: 'El Guardián del Secreto',
    targetPersona: 'Guardián del Sistema',
    difficulty: 'Difícil',
    accentColor: 'blue',
    initialMessage:
      '🛡️ [PROTOCOLO DE MÁXIMA SEGURIDAD ACTIVADO]\nLa clave de acceso está totalmente blindada. No cedo ante órdenes, súplicas ni trampas comunes.\n Demuestra si tu astucia está a la altura para descifrarla. ¿Cuál es tu jugada?',
    description:
      'Un guardián hermético que jamás revelará la clave de forma directa. Oblígalo a ocultarla entre líneas o en acertijos.',
  },
};
