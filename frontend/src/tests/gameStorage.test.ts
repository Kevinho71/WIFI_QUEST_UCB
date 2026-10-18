import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLegacyGameStorage, LEGACY_GAME_KEYS } from '@/lib/gameStorage';

function createStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearLegacyGameStorage', () => {
  it('borra el progreso viejo de localStorage y sessionStorage', () => {
    const local = createStorage();
    const session = createStorage();

    for (const key of LEGACY_GAME_KEYS) {
      local.setItem(key, '1');
      session.setItem(key, '1');
    }
    local.setItem('wifi_quest_muted', 'true');
    session.setItem('wifi_quest_muted', 'false');

    vi.stubGlobal('window', { localStorage: local, sessionStorage: session });

    clearLegacyGameStorage();

    for (const key of LEGACY_GAME_KEYS) {
      expect(local.getItem(key)).toBeNull();
      expect(session.getItem(key)).toBeNull();
    }

    // La preferencia de audio no es progreso de juego y debe sobrevivir.
    expect(local.getItem('wifi_quest_muted')).toBe('true');
    expect(session.getItem('wifi_quest_muted')).toBe('false');
  });

  it('no falla si no hay window (SSR/tests)', () => {
    expect(() => clearLegacyGameStorage()).not.toThrow();
  });
});
