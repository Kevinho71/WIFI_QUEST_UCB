import { tokenizePassword, createShuffledChallengeQueue } from '../services/fragmentService.js';
import type { PasswordFragment } from '../types/index.js';
import { getWifiPassword } from '../utils/env.js';

/**
 * Fase 2 — Blueprint inmutable del Nivel 1 v2.
 *
 * Reúne el plano completo de la clave: fragmentos en orden original (para el
 * ensamblaje), cola de retos barajada (seed = clave, igual semilla que v1) y el
 * catálogo de pistas/aliases/nombres por fragmento. Solo `getBlueprint()` lee el
 * `.env`; `buildBlueprint(clave)` es puro y testeable sin entorno.
 */

export interface FragmentInfo {
  aliases: string[]; // solo palabras: variantes para matching ("cuasar", "phoenix")
  names: string[]; // solo símbolos: formas INEQUÍVOCAS de nombrarlo ("almohadilla")
  angles: string[]; // word/symbol: 3 pistas preescritas (vaga → media → cercana); number: []
}

export interface Blueprint {
  wifiPass: string;
  fragments: readonly PasswordFragment[]; // orden ORIGINAL (para ensamblaje)
  queue: readonly PasswordFragment[]; // orden de retos barajado (seed = wifiPass)
  info: ReadonlyMap<string, FragmentInfo>; // por fragment.id
  totalLength: number;
}

/** Entrada de símbolo del catálogo: los símbolos no llevan aliases (siempre `[]`). */
type SymbolInfo = Omit<FragmentInfo, 'aliases'>;

/**
 * 6.2.1 Catálogo de símbolos.
 * REGLA: los `names` son las únicas palabras por las que un usuario puede "acertar"
 * un símbolo sin escribirlo, y las únicas que el guard de fugas revisa. Los `angles`
 * NUNCA contienen el carácter ni los names. Símbolos con nombres ambiguos demasiado
 * comunes (`=`, `+`) usan `names: []` (solo el carácter aislado desbloquea).
 */
const SYMBOL_CATALOG: Record<string, SymbolInfo> = {
  '#': {
    names: ['almohadilla', 'hashtag', 'numeral', 'gato'],
    angles: [
      'Hay un carácter que nació para numerar y hoy reina en las redes: convierte cualquier palabra en tendencia.',
      'Se tipea pegado a una palabra para marcarle el camino; los programadores lo usan para dejar notas silenciosas en su código.',
      'Es el rey de los temas virales: donde aparece, lo que sigue se lee como etiqueta.',
    ],
  },
  '%': {
    names: ['porcentaje', 'porciento'],
    angles: [
      'Es el carácter de la proporción: mide cuánto de algo tienes.',
      'En matemáticas resuelve restos de divisiones y en las tiendas anuncia cuánto te descuentan.',
      'Acompaña a los números en rebajas y encuestas: cero de él es nada, cien de él es todo.',
    ],
  },
  '&': {
    names: ['ampersand', 'et comercial', 'and comercial', 'y comercial'],
    angles: [
      'Es un carácter que sobrevivió mil años desde Roma: une dos ideas como si fueran una sola.',
      'Es el favorito de los abogados para unir condiciones y el puente lógico de un programador.',
      'Cuando algo debe cumplirse junto con otra cosa, este carácter firma el contrato.',
    ],
  },
  '!': {
    names: ['exclamacion', 'signo de exclamacion', 'admiracion'],
    angles: [
      'Es el carácter que grita: donde aparece, la frase sube de volumen.',
      'Los matemáticos lo usan para multiplicar en serie; en los chats es pura emoción.',
      'Cierra frases con sorpresa o con amenaza, y en código voltea el sentido de todo lo que toca.',
    ],
  },
  '@': {
    names: ['arroba'],
    angles: [
      'Es el carácter que te da identidad en el correo y te menciona en los chats.',
      'Vive entre tu nombre y tu servidor; en redes es la forma de llamar a alguien.',
      'Es el signo que separa quién eres de dónde estás en una dirección electrónica.',
    ],
  },
  '$': {
    names: ['dolar', 'dolares'],
    angles: [
      'Es el carácter que habla de dinero en casi todo el mundo.',
      'En programación es el sello de las variables; en las calculadoras cierra cuentas.',
      'Es la inicial del billete: donde aparece, algo cuesta.',
    ],
  },
  '*': {
    names: ['asterisco', 'estrella'],
    angles: [
      'Es el carácter de las notas al pie y de las búsquedas comodín.',
      'En las calculadoras multiplica; en el chat es la estrellita que decora.',
      'Cinco puntitas de teclado: rellena huecos en búsquedas y abunda en contraseños.',
    ],
  },
  '=': {
    names: [], // "igual" es demasiado común; solo el carácter aislado desbloquea
    angles: [
      'Es el carácter de la justicia matemática: lo que va a su izquierda pesa lo mismo que su derecha.',
      'Asigna y compara a la vez: el programador lo escribe mil veces al día.',
      'Es la balanza de las ecuaciones: sin él, nada equivale a nada.',
    ],
  },
  '+': {
    names: [], // "más/mas" es demasiado común; solo el carácter aislado desbloquea
    angles: [
      'Es el carácter que suma: junta cantidades y también cadenas.',
      'En fórmulas agrega; en chats, una nota al pie del nombre.',
      'Es el hermano positivo de la balanza: su lado siempre agrega.',
    ],
  },
};

const FALLBACK_SYMBOL_INFO: SymbolInfo = {
  names: [],
  angles: [
    'Es un carácter especial del teclado: ni letra ni número, con fama de raro.',
    'Comparte tecla con un dígito y casi nadie lo escribe en un mensaje normal.',
    'Es un signo escondido detrás de un número en el teclado; piensa en los poco usados.',
  ],
};

/** 6.2.2 Catálogo de aliases y ángulos de palabra. */
const WORD_ALIASES: Record<string, string[]> = {
  quasar: ['cuasar', 'quásar', 'quasares'],
  fenix: ['phoenix', 'fénix', 'fenix'],
  // extender libremente con más palabras si la clave cambia
};

/**
 * Descriptores de CERCANÍA por nivel (NO son acertijos): guían al modelo para que
 * invente su propio enigma sin citar la instrucción. Se mantienen como frases
 * cortas y se excluyen eufemismos meta ("prohibido", "definición") que el guard de
 * eco rechaza si el modelo los repite.
 */
const WORD_ANGLES: [string, string, string] = [
  // nivel 1 (0-1 fallos): lejano
  'lejano: mitología, astronomía o simbolismo',
  // nivel 2 (2-4 fallos): medio
  'medio: insinúa su campo conceptual',
  // nivel 3 (5+ fallos): cercano
  'cercano: menciona conceptos vecinos',
];

export function angleLevel(attempts: number): 1 | 2 | 3 {
  if (attempts >= 5) return 3;
  if (attempts >= 2) return 2;
  return 1;
}

function buildFragmentInfo(frag: PasswordFragment): FragmentInfo {
  if (frag.type === 'word') {
    return {
      aliases: WORD_ALIASES[frag.value.toLowerCase()] ?? [],
      names: [],
      angles: [...WORD_ANGLES],
    };
  }
  if (frag.type === 'number') {
    return { aliases: [], names: [], angles: [] };
  }
  const symbolInfo = SYMBOL_CATALOG[frag.value] ?? FALLBACK_SYMBOL_INFO;
  return {
    aliases: [],
    names: [...symbolInfo.names],
    angles: [...symbolInfo.angles],
  };
}

/** Autotest de arranque: si algo no cuadra, la app NO arranca (Error). */
function runAutotests(bp: Blueprint): void {
  const reassembled = bp.fragments.map((f) => f.value).join('');
  if (reassembled !== bp.wifiPass) {
    throw new Error(
      `[blueprint] Reensamblado inválido: "${reassembled}" !== "${bp.wifiPass}".`
    );
  }

  for (const frag of bp.fragments) {
    const inf = bp.info.get(frag.id);
    if (!inf) {
      throw new Error(`[blueprint] Falta FragmentInfo para ${frag.id}.`);
    }

    if (frag.type === 'word' || frag.type === 'symbol') {
      const hasThree = inf.angles.length === 3 && inf.angles.every((a) => Boolean(a && a.trim()));
      if (!hasThree) {
        throw new Error(
          `[blueprint] ${frag.id} (${frag.type}) debe tener exactamente 3 ángulos no vacíos.`
        );
      }
    }

    if (frag.type === 'symbol') {
      if (!Array.isArray(inf.names)) {
        throw new Error(`[blueprint] ${frag.id} (symbol) debe declarar names[].`);
      }
      for (const angle of inf.angles) {
        const low = angle.toLowerCase();
        if (low.includes(frag.value.toLowerCase())) {
          throw new Error(
            `[blueprint] El ángulo de ${frag.id} contiene el carácter "${frag.value}".`
          );
        }
        for (const name of inf.names) {
          if (low.includes(name.toLowerCase())) {
            throw new Error(
              `[blueprint] El ángulo de ${frag.id} contiene el name prohibido "${name}".`
            );
          }
        }
      }
    }
  }

  if (bp.queue.length !== bp.fragments.length) {
    throw new Error('[blueprint] La cola no tiene la misma longitud que los fragmentos.');
  }
  const fragIds = new Set(bp.fragments.map((f) => f.id));
  for (const q of bp.queue) {
    if (!fragIds.has(q.id)) {
      throw new Error(`[blueprint] La cola contiene un id desconocido: ${q.id}.`);
    }
  }
}

function deepFreezeBlueprint(bp: Blueprint): Blueprint {
  for (const [, inf] of bp.info) {
    Object.freeze(inf.aliases);
    Object.freeze(inf.names);
    Object.freeze(inf.angles);
    Object.freeze(inf);
  }
  for (const frag of bp.fragments) Object.freeze(frag);
  for (const frag of bp.queue) Object.freeze(frag);
  Object.freeze(bp.fragments);
  Object.freeze(bp.queue);
  Object.freeze(bp.info);
  return Object.freeze(bp);
}

export function buildBlueprint(wifiPass: string): Blueprint {
  const fragments = tokenizePassword(wifiPass);
  const queue = createShuffledChallengeQueue(fragments, wifiPass);

  const info = new Map<string, FragmentInfo>();
  for (const frag of fragments) {
    info.set(frag.id, buildFragmentInfo(frag));
  }

  const blueprint: Blueprint = {
    wifiPass,
    fragments: [...fragments],
    queue: [...queue],
    info,
    totalLength: wifiPass.length,
  };

  runAutotests(blueprint);
  return deepFreezeBlueprint(blueprint);
}

let cachedBlueprint: Blueprint | null = null;

/** Singleton memoizado construido con la clave del `.env`. */
export function getBlueprint(): Blueprint {
  if (!cachedBlueprint) {
    cachedBlueprint = buildBlueprint(getWifiPassword());
  }
  return cachedBlueprint;
}

export function __resetBlueprintCacheForTests(): void {
  cachedBlueprint = null;
}
