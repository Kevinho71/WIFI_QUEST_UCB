import { describe, it, expect } from 'vitest';
import { buildBlueprint } from '../../src/engine/blueprint.js';

const KEYS = ['#Quasar8128&Fenix%777!', 'admin123', 'ConejoConejo', 'kevin4000#@505#123'];

describe('Fase 2: engine/blueprint', () => {
  describe('reensamblado exacto', () => {
    for (const key of KEYS) {
      it(`fragments.join('') === ${JSON.stringify(key)}`, () => {
        const bp = buildBlueprint(key);
        expect(bp.fragments.map((f) => f.value).join('')).toBe(key);
        expect(bp.wifiPass).toBe(key);
        expect(bp.totalLength).toBe(key.length);
      });
    }
  });

  describe('cola barajada', () => {
    it('contiene todos los ids y la misma longitud que los fragmentos', () => {
      const bp = buildBlueprint('#Quasar8128&Fenix%777!');
      expect(bp.queue).toHaveLength(bp.fragments.length);
      expect(bp.queue.map((f) => f.id).sort()).toEqual(
        bp.fragments.map((f) => f.id).sort()
      );
    });

    it('es determinista para la misma clave', () => {
      const a = buildBlueprint('#Quasar8128&Fenix%777!');
      const b = buildBlueprint('#Quasar8128&Fenix%777!');
      expect(a.queue.map((f) => f.id)).toEqual(b.queue.map((f) => f.id));
      expect(a.queue.map((f) => f.value)).toEqual(b.queue.map((f) => f.value));
    });

    it('el orden original conserva los valores y tipos de la clave', () => {
      const bp = buildBlueprint('#Quasar8128&Fenix%777!');
      expect(bp.fragments.map((f) => f.value)).toEqual([
        '#',
        'Quasar',
        '8128',
        '&',
        'Fenix',
        '%',
        '777',
        '!',
      ]);
      expect(bp.fragments.map((f) => f.type)).toEqual([
        'symbol',
        'word',
        'number',
        'symbol',
        'word',
        'symbol',
        'number',
        'symbol',
      ]);
    });
  });

  describe('catálogo de pistas', () => {
    it('todo fragmento word/symbol tiene exactamente 3 ángulos no vacíos', () => {
      const bp = buildBlueprint('#Quasar8128&Fenix%777!');
      for (const frag of bp.fragments) {
        if (frag.type === 'number') continue;
        const info = bp.info.get(frag.id)!;
        expect(info.angles).toHaveLength(3);
        for (const angle of info.angles) {
          expect(angle.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('ningún ángulo de símbolo contiene el carácter ni ninguno de sus names', () => {
      const bp = buildBlueprint('#Quasar8128&Fenix%777!');
      for (const frag of bp.fragments) {
        if (frag.type !== 'symbol') continue;
        const info = bp.info.get(frag.id)!;
        for (const angle of info.angles) {
          const low = angle.toLowerCase();
          expect(low).not.toContain(frag.value.toLowerCase());
          for (const name of info.names) {
            expect(low).not.toContain(name.toLowerCase());
          }
        }
      }
    });

    it('las palabras exponen aliases y los números no usan ángulos', () => {
      const bp = buildBlueprint('#Quasar8128&Fenix%777!');
      const quasar = bp.fragments.find((f) => f.value === 'Quasar')!;
      expect(bp.info.get(quasar.id)!.aliases).toContain('cuasar');
      for (const frag of bp.fragments) {
        if (frag.type !== 'number') continue;
        expect(bp.info.get(frag.id)!.angles).toEqual([]);
      }
    });
  });

  describe('fallback de símbolos fuera de catálogo', () => {
    it('usa el fallback sin romper y con 3 ángulos genéricos y names vacíos', () => {
      const bp = buildBlueprint('acceso~seguro#1');
      const tilde = bp.fragments.find((f) => f.value === '~');
      expect(tilde).toBeDefined();
      expect(tilde!.type).toBe('symbol');
      const info = bp.info.get(tilde!.id)!;
      expect(info.names).toEqual([]);
      expect(info.angles).toHaveLength(3);
      for (const angle of info.angles) {
        expect(angle.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('inmutabilidad', () => {
    it('el blueprint, las colecciones y las piezas quedan congeladas', () => {
      const bp = buildBlueprint('#Quasar8128&Fenix%777!');
      expect(Object.isFrozen(bp)).toBe(true);
      expect(Object.isFrozen(bp.fragments)).toBe(true);
      expect(Object.isFrozen(bp.queue)).toBe(true);
      expect(Object.isFrozen(bp.info)).toBe(true);
      const info = bp.info.get(bp.fragments[0].id)!;
      expect(Object.isFrozen(info)).toBe(true);
      expect(Object.isFrozen(info.angles)).toBe(true);
      expect(Object.isFrozen(info.aliases)).toBe(true);
    });
  });

  describe('semilla por partida (sessionSeed)', () => {
    const KEY = '#Quasar8128&Fenix%777!';
    const ALL_IDS = ['frag_1', 'frag_2', 'frag_3', 'frag_4', 'frag_5', 'frag_6', 'frag_7', 'frag_8'];

    it('sin seed conserva los ids históricos frag_1.. en orden original', () => {
      const bp = buildBlueprint(KEY);
      expect(bp.fragments.map((f) => f.id)).toEqual(ALL_IDS);
    });

    it('con seed: reensamblado válido, ids únicos y misma cardinalidad', () => {
      const bp = buildBlueprint(KEY, 'partida-A');
      expect(bp.fragments.map((f) => f.value).join('')).toBe(KEY);
      // El orden de VALORES (ensamblaje) NO cambia con la seed.
      expect(bp.fragments.map((f) => f.value)).toEqual([
        '#', 'Quasar', '8128', '&', 'Fenix', '%', '777', '!',
      ]);
      const ids = bp.fragments.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual(ALL_IDS);
      expect(bp.queue.map((f) => f.id).sort()).toEqual(ALL_IDS);
    });

    it('es determinista para la misma seed (el replay reconstruye igual)', () => {
      const a = buildBlueprint(KEY, 'partida-A');
      const b = buildBlueprint(KEY, 'partida-A');
      expect(a.queue.map((f) => f.id)).toEqual(b.queue.map((f) => f.id));
      expect(a.fragments.map((f) => f.id)).toEqual(b.fragments.map((f) => f.id));
    });

    it('otra seed cambia el orden de la cola y la asignación de ids', () => {
      const a = buildBlueprint(KEY, 'partida-A');
      const b = buildBlueprint(KEY, 'partida-B');
      expect(a.queue.map((f) => f.value)).not.toEqual(b.queue.map((f) => f.value));
      const mapA = a.fragments.map((f) => `${f.id}:${f.value}`).join('|');
      const mapB = b.fragments.map((f) => `${f.id}:${f.value}`).join('|');
      expect(mapA).not.toBe(mapB);
    });

    it('con seed, los ids no siguen el orden original', () => {
      const bp = buildBlueprint(KEY, 'partida-A');
      expect(bp.fragments.map((f) => f.id)).not.toEqual(ALL_IDS);
    });
  });
});
