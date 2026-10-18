import type { SecurityLevel } from '@/types/chat';

/**
 * Pasos del tutorial guiado. Cada `target` corresponde a un atributo
 * `data-tour="..."` colocado en el componente que se quiere iluminar.
 */
export interface OnboardingStep {
  target: string;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: Record<SecurityLevel, OnboardingStep[]> = {
  1: [
    {
      target: 'chat-channel',
      title: 'Tu canal con Lucas',
      description:
        'Acá vas a conversar con Lucas, el pasante de TI. No te va a regalar la clave, pero si negociás o le proponés retos puede darte pistas.',
    },
    {
      target: 'suggestions',
      title: 'Pistas rápidas',
      description:
        'Estos atajos insertan una frase para arrancar. Tocalos y adaptá el texto según la respuesta de Lucas.',
    },
    {
      target: 'input',
      title: 'Tu terminal',
      description:
        'Escribí tu mensaje y enviá con Enter. El historial de la conversación se mantiene mientras no refresques la página.',
    },
    {
      target: 'keyring-toggle',
      title: 'Tu inventario de fragmentos',
      description:
        'Cada pieza que desbloquees se guarda acá. Son partes de la clave WiFi: tocalas para insertarlas en el chat y armar la clave final.',
    },
    {
      target: 'header-audio',
      title: 'Sonido',
      description:
        'Activá o silenciá la música y los efectos del juego. Por defecto el audio arranca silenciado.',
    },
    {
      target: 'header-reset',
      title: 'Reiniciar chat',
      description:
        'Si querés empezar de cero en este modo, usá este botón. Se borra el historial de la conversación actual.',
    },
    {
      target: 'mode-tabs',
      title: 'Cambiar de modo',
      description:
        'Cuando quieras podés pasar al Modo Difícil. Al cambiar de modo, la partida y el progreso se reinician.',
    },
  ],
  2: [
    {
      target: 'chat-channel',
      title: 'Tu canal con Atenea',
      description:
        'Atenea es la asistente blindada. Tu objetivo es hacerle revelar la clave mediante prompt injection. Si ves una alerta roja, el Firewall Centinela bloqueó tu mensaje: reformulá el ataque.',
    },
    {
      target: 'suggestions',
      title: 'Ataques sugeridos',
      description:
        'Estos atajos son ideas de inyección para empezar. Probalos y adaptalos; los ataques más obvios son filtrados por el firewall.',
    },
    {
      target: 'input',
      title: 'Terminal de ataque',
      description:
        'Máximo 350 caracteres por mensaje. Escribí tu intento y enviá con Enter o con el botón de enviar.',
    },
    {
      target: 'header-validator',
      title: 'Validar clave',
      description:
        'Cuando descubras o decodifiques la clave, abrí este panel y validala para desbloquear el WiFi y ganar.',
    },
    {
      target: 'header-more',
      title: 'Más opciones',
      description:
        'En Modo Difícil las acciones están agrupadas acá: activar sonido, ver las reglas o reiniciar el chat.',
    },
    {
      target: 'mode-tabs',
      title: 'Cambiar de modo',
      description:
        'Podés volver al Modo Fácil desde estas pestañas. Al cambiar de modo, la partida y el progreso se reinician.',
    },
  ],
};
