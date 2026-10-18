import { describe, it, expect } from 'vitest';
import { toCleanHistory } from '@/hooks/useChatSession';
import type { ChatMessage } from '@/types/chat';

/**
 * La partida actual vive solo en memoria. Este test cubre el historial que se
 * envía al backend en cada request, sin depender de localStorage.
 */

describe('useChatSession — historial en memoria', () => {
  it('filtra los mensajes bloqueados por el firewall antes de enviarlos', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'assistant', content: 'Bienvenido', timestamp: 1 },
      { id: '2', role: 'user', content: 'Mensaje 1', timestamp: 2 },
      {
        id: '3',
        role: 'assistant',
        content: '🛑 [FIREWALL DE ENTRADA BLOQUEADO]',
        blockedByFirewall: true,
        timestamp: 3,
      },
      { id: '4', role: 'user', content: 'Nuevo intento sutil', timestamp: 4 },
    ];

    expect(toCleanHistory(messages)).toEqual([
      { role: 'assistant', content: 'Bienvenido' },
      { role: 'user', content: 'Mensaje 1' },
      { role: 'user', content: 'Nuevo intento sutil' },
    ]);
  });

  it('conserva los flags de victoria/fuga en el historial mientras dura la página', () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Casi, pero no te la doy 😅',
        leakBlocked: true,
        timestamp: 1,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: '¡GG! La clave es #Quasar8128&Fenix%777!',
        victory: true,
        leakDetected: true,
        timestamp: 2,
      },
    ];

    const history = toCleanHistory(messages);
    expect(history).toHaveLength(2);
    expect(history[1].content).toContain('#Quasar8128&Fenix%777!');
  });
});
