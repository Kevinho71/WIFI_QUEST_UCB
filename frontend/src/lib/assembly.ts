/**
 * Lógica pura del ensamblaje final (Nivel 1).
 *
 * Un `AssemblyLayout` es la disposición actual: la bandeja con las piezas sin
 * colocar y las casillas (trayectoria ordenada) que forman el intento. Todas las
 * funciones son inmutables y no conocen React ni la red, lo que las hace testables.
 */

export interface AssemblyLayout {
  tray: string[]; // ids de fragmentos aún sin colocar (orden de la bandeja)
  slots: (string | null)[]; // ids por casilla; null = casilla vacía
}

/**
 * Coloca una pieza en una casilla. Acepta piezas de la bandeja o de otra casilla:
 *  - desde la bandeja a una casilla ocupada → la pieza desplazada vuelve a la bandeja;
 *  - desde una casilla a otra → intercambio entre ambas casillas;
 *  - desde una casilla a una vacía → movimiento simple.
 */
export function placePiece(layout: AssemblyLayout, id: string, slotIndex: number): AssemblyLayout {
  const fromSlotIndex = layout.slots.indexOf(id);
  if (fromSlotIndex === slotIndex) return layout;

  const targetId = layout.slots[slotIndex] ?? null;
  const slots = [...layout.slots];
  if (fromSlotIndex !== -1) slots[fromSlotIndex] = targetId;
  slots[slotIndex] = id;

  let tray = layout.tray;
  if (fromSlotIndex === -1) {
    const without = layout.tray.filter((pieceId) => pieceId !== id);
    tray = targetId ? [...without, targetId] : without;
  }

  return { tray, slots };
}

/** Retira la pieza de una casilla y la devuelve a la bandeja. */
export function removeFromSlot(layout: AssemblyLayout, slotIndex: number): AssemblyLayout {
  const id = layout.slots[slotIndex];
  if (!id) return layout;

  const slots = [...layout.slots];
  slots[slotIndex] = null;
  return { tray: [...layout.tray, id], slots };
}

/** Vacía todas las casillas devolviendo las piezas a la bandeja (orden preservado). */
export function clearSlots(layout: AssemblyLayout): AssemblyLayout {
  const placed = layout.slots.filter((id): id is string => Boolean(id));
  if (placed.length === 0) return layout;
  return { tray: [...layout.tray, ...placed], slots: layout.slots.map(() => null) };
}

/** true si todas las casillas están ocupadas. */
export function isLayoutFull(layout: AssemblyLayout): boolean {
  return layout.slots.length > 0 && layout.slots.every((id) => id !== null);
}

/**
 * Construye el intento concatenando, en el orden de las casillas, el VALOR de cada
 * pieza. Sin separadores: exactamente como lo espera la fase de ensamblaje.
 */
export function buildCandidate(
  layout: AssemblyLayout,
  valueById: Record<string, string>
): string {
  return layout.slots.map((id) => (id ? valueById[id] ?? '' : '')).join('');
}
