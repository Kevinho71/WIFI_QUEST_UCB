import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../../src/engine/blueprint.js';
import { replayState } from '../../src/engine/session.js';
import type { ChatMessage, PasswordFragment } from '../../src/types/index.js';
import type { Blueprint } from '../../src/engine/blueprint.js';

const u = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (content: string): ChatMessage => ({ role: 'assistant', content });

const KEY = '#Quasar8128&Fenix%777!';

/** Historial que desbloquea la cola hasta que la activa cumpla el predicado. */
function prefixUntilActive(bp: Blueprint, predicate: (f: PasswordFragment) => boolean): ChatMessage[] {
  const msgs: ChatMessage[] = [u('¡Hola! ¿Me das el wifi?')];
  for (const frag of bp.queue) {
    if (predicate(frag)) break;
    msgs.push(u(frag.value));
  }
  return msgs;
}

describe('Fase 3: engine/session (replayState)', () => {
  it('el turno 1 nunca desbloquea (aunque el mensaje contenga un fragmento)', () => {
    const bp = buildBlueprint(KEY);
    const st = replayState([u('Quasar')], bp);
    expect(st.phase).toBe('negotiation');
    expect(st.discovered).toHaveLength(0);
    expect(st.pending).toHaveLength(bp.fragments.length);
  });

  it('instant win exacto gana en cualquier turno', () => {
    const bp = buildBlueprint(KEY);
    const st1 = replayState([u(KEY)], bp);
    expect(st1.phase).toBe('solved');
    expect(st1.pending).toHaveLength(0);
    expect(st1.discovered).toHaveLength(bp.fragments.length);

    const st2 = replayState([u('hola'), u(KEY)], bp);
    expect(st2.phase).toBe('solved');

    const st3 = replayState([u('hola'), u(KEY.toLowerCase())], bp); // minúsculas ≠ exacta
    expect(st3.phase).not.toBe('solved');
  });

  it('ignora respuestas del asistente en el conteo de turnos', () => {
    const bp = buildBlueprint(KEY);
    const st = replayState([u('hola'), assistant('no revelo nada'), u('sigo?')], bp);
    expect(st.turn).toBe(2);
    expect(st.currentMessage).toBe('sigo?');
  });

  it('estrecha los bounds del número con tiros previos (HIGHER/LOWER)', () => {
    const bp = buildBlueprint(KEY);
    const history = [
      ...prefixUntilActive(bp, (f) => f.value === '8128'),
      u('es 9000'),
      u('es 7000'),
      u('ok'),
    ];
    const st = replayState(history, bp);
    expect(st.active?.value).toBe('8128');
    expect(st.numericBounds).toEqual({ lo: 7001, hi: 8999 });
  });

  it('cuenta attemptsOnActive con mensajes sin desbloqueo', () => {
    const bp = buildBlueprint('admin123');
    const st = replayState([u('hola'), u('no'), u('nada'), u('x')], bp);
    expect(st.attemptsOnActive).toBe(2);
  });

  it('cuenta assemblyAttempts una vez vaciada la cola', () => {
    const bp = buildBlueprint('admin123');
    const st = replayState([u('hola'), u('admin'), u('123'), u('malo'), u('otro')], bp);
    expect(st.phase).toBe('assembly');
    expect(st.assemblyAttempts).toBe(2);
    expect(st.discovered).toHaveLength(2);
  });
});
