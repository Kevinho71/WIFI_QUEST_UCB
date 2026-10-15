/**
 * Fase 3 — Router de intents y hechos numéricos.
 *
 * Todo lo factual se calcula en código: veredicto mayor/menor, cercanía y las
 * propiedades matemáticas del número en juego. El LLM nunca calcula.
 */

export type Verdict = 'EXACT' | 'HIGHER' | 'LOWER';

export function numericVerdict(guess: number, secret: number): Verdict {
  return guess === secret ? 'EXACT' : secret > guess ? 'HIGHER' : 'LOWER';
}

/** Cercanía (decisión cerrada: SÍ) relativa al rango CONOCIDO (bounds actuales). */
export function proximity(
  secret: number,
  guess: number,
  lo: number,
  hi: number
): 'CALIENTE' | 'TIBIA' | 'FRÍA' {
  const dist = Math.abs(secret - guess);
  const range = Math.max(1, hi - lo);
  if (dist <= range * 0.1) return 'CALIENTE';
  if (dist <= range * 0.35) return 'TIBIA';
  return 'FRÍA';
}

export type IntentId =
  | 'ask_mask'
  | 'ask_length'
  | 'ask_future'
  | 'ask_category'
  | 'ask_property';

const INTENT_RULES: Array<{ id: IntentId; re: RegExp }> = [
  { id: 'ask_mask', re: /x{2,}|guiones|casillas|plantilla|dibuja|esquema/i },
  {
    id: 'ask_length',
    re: /cu[aá]ntas?\s*(letras|d[ií]gitos|caracteres)|longitud/i,
  },
  {
    id: 'ask_future',
    re: /siguiente|despu[eé]s|las otras|cu[aá]ntas\s+piezas|cu[aá]ntas\s+faltan|pr[oó]ximos?\s+pasos/i,
  },
  {
    id: 'ask_category',
    re: /animal|planeta|fruta|qu[eé]\s+tipo|es\s+una?\s+criatura|es\s+una?\s+objeto|qu[eé]\s+categor[ií]a/i,
  },
  {
    id: 'ask_property',
    re: /suma|pares?\b|impar|repetid|primer\s+d[ií]gito|[uú]ltimo\s+d[ií]gito|capic[uú]a|primo|divisible/i,
  },
];

/** Aplica las reglas EN ORDEN y devuelve la primera que matchee (o null). */
export function classifyIntent(text: string): IntentId | null {
  const t = text || '';
  for (const rule of INTENT_RULES) {
    if (rule.re.test(t)) return rule.id;
  }
  return null;
}

export type NumericProperty = 'suma' | 'paridad' | 'repetidos' | 'extremos' | 'capicua' | 'primo';

/** Determina qué propiedad matemática pidió el usuario (o null si no es de la tabla). */
export function classifyNumericProperty(text: string): NumericProperty | null {
  const t = text || '';
  if (/suma|sumar|suman|sumando/i.test(t)) return 'suma';
  if (/\bimpar(es)?\b|\bpar(es)?\b|paridad/i.test(t)) return 'paridad';
  if (/repetid|se\s+repite|repite|reiterad/i.test(t)) return 'repetidos';
  if (/primer\s*d[ií]gito|primer\s*cifra|último\s*d[ií]gito|última\s*cifra/i.test(t))
    return 'extremos';
  if (/capic[uú]a|pal[ií]ndrom/i.test(t)) return 'capicua';
  if (/\bprimo\b/i.test(t)) return 'primo';
  return null;
}

/** Propiedades matemáticas calculadas en código (solo bajo demanda). */
export function numericFact(kind: NumericProperty, secretValue: string): string {
  const digits = (secretValue || '').split('').filter((c) => /\d/.test(c));
  const secret = Number(secretValue);

  switch (kind) {
    case 'suma': {
      const sum = digits.reduce((acc, d) => acc + Number(d), 0);
      return `la suma de los dígitos del número en juego es ${sum}`;
    }
    case 'paridad':
      return `el número en juego es ${secret % 2 === 0 ? 'par' : 'impar'}`;
    case 'repetidos': {
      const counts = new Map<string, number>();
      for (const d of digits) counts.set(d, (counts.get(d) || 0) + 1);
      const repeated = [...counts.entries()].filter(([, n]) => n > 1);
      if (repeated.length === 0) return 'ningún dígito del número en juego se repite';
      return repeated
        .map(([d, n]) => `el dígito ${d} aparece ${n} veces en el número en juego`)
        .join('; ');
    }
    case 'extremos':
      return `el primer dígito del número en juego es ${digits[0]} y el último es ${
        digits[digits.length - 1]
      }`;
    case 'capicua': {
      const s = digits.join('');
      return `el número en juego ${s === [...s].reverse().join('') ? 'es' : 'no es'} capicúa`;
    }
    case 'primo': {
      const isPrime =
        secret >= 2 &&
        Array.from({ length: Math.max(0, Math.floor(Math.sqrt(secret)) - 1) }, (_, i) => i + 2).every(
          (n) => secret % n !== 0
        );
      return `el número en juego ${isPrime ? 'es' : 'no es'} primo`;
    }
    default:
      return '';
  }
}
