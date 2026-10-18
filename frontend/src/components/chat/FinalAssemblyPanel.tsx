import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AssemblyValidationResult, GameStateDTO } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { audioService } from '@/services/audioService';
import {
  placePiece,
  removeFromSlot,
  clearSlots,
  isLayoutFull,
  buildCandidate,
  changedSlotIndexes,
  clearSlotMarks,
  computeSlotMoves,
  marksFromFeedback,
  type AssemblyLayout,
  type SlotMarks,
  type SlotMove,
} from '@/lib/assembly';
import { useAssemblyTimer } from '@/hooks/useAssemblyTimer';
import { ASSEMBLY_DURATION_MS } from '@/lib/assemblyTimer';
import { resolveAssemblyBubbleMessage } from '@/lib/assemblyMessages';
import {
  Bot,
  CheckCircle2,
  GripVertical,
  Loader2,
  Puzzle,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

interface FinalAssemblyPanelProps {
  gameState: GameStateDTO | null;
  isSubmitting: boolean;
  onValidate: (pieces: string[]) => Promise<AssemblyValidationResult | null>;
  onSolved?: (realPassword: string, message: string) => void;
}

type DragPayload = { from: 'tray' | 'slot'; id: string; slotIndex?: number };

/** Evita el warning de useLayoutEffect durante el render estático (tests SSR). */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Oculta la imagen de arrastre nativa del navegador: usamos nuestro propio
 * fragmento flotante para que el arrastre se vea igual en desktop y en touch.
 * El elemento se crea una sola vez y queda oculto fuera de pantalla.
 */
let nativeDragImage: HTMLDivElement | null = null;

function suppressNativeDragImage(e: React.DragEvent<HTMLElement>) {
  if (typeof document === 'undefined') return;

  if (!nativeDragImage) {
    nativeDragImage = document.createElement('div');
    nativeDragImage.style.cssText =
      'position:fixed;top:-1000px;left:-1000px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(nativeDragImage);
  }

  try {
    e.dataTransfer.setDragImage(nativeDragImage, 0, 0);
  } catch {
    /* algunos navegadores no permiten personalizar la imagen */
  }
}

const TIMER_STYLES: Record<string, { box: string; text: string; icon: string; fill: string }> = {
  normal: {
    box: 'border-amber-500/40 bg-amber-950/30',
    text: 'text-amber-200',
    icon: 'text-amber-400',
    fill: 'bg-amber-400',
  },
  warning: {
    box: 'border-orange-500/60 bg-orange-950/40 shadow-[0_0_14px_rgba(249,115,22,0.3)]',
    text: 'text-orange-200',
    icon: 'text-orange-400',
    fill: 'bg-orange-400',
  },
  critical: {
    box: 'border-red-500/70 bg-red-950/50 shadow-[0_0_16px_rgba(239,68,68,0.45)] animate-pulse',
    text: 'text-red-200',
    icon: 'text-red-400',
    fill: 'bg-red-500',
  },
  expired: {
    box: 'border-rose-500/50 bg-rose-950/40',
    text: 'text-rose-300',
    icon: 'text-rose-400',
    fill: 'bg-rose-500',
  },
};

export const FinalAssemblyPanel: React.FC<FinalAssemblyPanelProps> = ({
  gameState,
  isSubmitting,
  onValidate,
  onSolved,
}) => {
  const fragments = gameState?.unlockedFragments ?? [];
  const total = gameState?.totalFragments ?? fragments.length;

  const valueById: Record<string, string> = {};
  for (const frag of fragments) valueById[frag.id] = frag.value;

  const [layout, setLayout] = useState<AssemblyLayout>(() => ({
    tray: fragments.map((f) => f.id),
    slots: new Array(total).fill(null),
  }));
  const [selected, setSelected] = useState<DragPayload | null>(null);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  // Fragmento flotante que sigue al dedo/cursor durante el arrastre.
  const [dragPreview, setDragPreview] = useState<{ id: string; value: string } | null>(null);
  // Marcas de validación por casilla. Se conservan hasta que el usuario toca o
  // mueve esa pieza; una nueva validación reemplaza todas.
  const [marks, setMarks] = useState<SlotMarks | null>(null);
  const [llmReply, setLlmReply] = useState<string | null>(null);
  // Victoria confirmada: bloquea reenvíos mientras se muestra la animación de acierto.
  const [victoryPending, setVictoryPending] = useState(false);

  // En pantallas táctiles el drag HTML5 no existe: usamos Pointer Events (más abajo)
  // y mantenemos el patrón "toca la pieza y luego la casilla" como alternativa.
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Refs para la animación FLIP: contenedor de la pieza por casilla y movimiento
  // pendiente de animar tras el commit de React.
  const slotPieceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingFlipRef = useRef<{
    moves: SlotMove[];
    rects: Map<number, DOMRect>;
  } | null>(null);
  const flipTimersRef = useRef<number[]>([]);

  // Drag táctil con Pointer Events (el drag HTML5 no dispara en touch).
  const pointerDragRef = useRef<{
    payload: DragPayload;
    startX: number;
    startY: number;
    active: boolean;
    pointerId: number;
  } | null>(null);
  const suppressTapRef = useRef(false);
  const suppressTapTimerRef = useRef<number | null>(null);

  // Posición y nodo del fragmento flotante. Se actualiza directo en el DOM para
  // que el arrastre no dependa de un re-render por cada movimiento del puntero.
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Limpia los timers de la animación FLIP al desmontar.
  useEffect(
    () => () => {
      for (const timer of flipTimersRef.current) window.clearTimeout(timer);
      flipTimersRef.current = [];
      if (suppressTapTimerRef.current !== null) {
        window.clearTimeout(suppressTapTimerRef.current);
      }
    },
    []
  );


  const { clock, remainingMs, expired, band } = useAssemblyTimer();

  // Solo el último mensaje del LLM es visible; si aún no hubo validación, se
  // muestra el aviso de expiración o la instrucción inicial.
  const bubbleMessage = resolveAssemblyBubbleMessage(llmReply, expired);

  // Fase 4 — música tensa durante el ensamblaje; se restaura al salir de la escena.
  useEffect(() => {
    void audioService.setAssemblyMode(true);
    return () => {
      void audioService.setAssemblyMode(false);
    };
  }, []);

  // La urgencia se ajusta por bandas; el motor la lee en cada compás (sin reiniciar).
  // Al agotarse el contador (que es pura broma), relajamos la música: volvemos a la
  // pista del modo fácil en lugar de escalar a la alarma crítica.
  useEffect(() => {
    if (band === 'expired') {
      void audioService.setAssemblyMode(false);
      return;
    }
    audioService.setAssemblyUrgency(band);
  }, [band]);

  const warnedRef = useRef<boolean>(remainingMs <= 10_000);
  const tickSecondRef = useRef<number | null>(null);
  const prevExpiredRef = useRef<boolean>(expired);

  // Aviso de últimos segundos (una vez) + tics de la cuenta final.
  useEffect(() => {
    if (expired) return;
    const seconds = Math.ceil(remainingMs / 1000);

    if (remainingMs <= 10_000 && !warnedRef.current) {
      warnedRef.current = true;
      audioService.playAssemblyWarningSound();
    }
    if (seconds <= 5 && seconds >= 1 && tickSecondRef.current !== seconds) {
      tickSecondRef.current = seconds;
      audioService.playAssemblyTickSound();
    }
  }, [remainingMs, expired]);

  // Sonido único al expirar (la música sigue: expirar no bloquea nada). Al expirar,
  // la burbuja reemplaza el último mensaje por el aviso de que el reloj era puro teatro.
  useEffect(() => {
    if (expired && !prevExpiredRef.current) {
      audioService.playAssemblyExpiredSound();
      setLlmReply(null);
    }
    prevExpiredRef.current = expired;
  }, [expired]);

  // Animación FLIP: tras el commit, cada pieza que cambió de casilla arranca en
  // la posición de su casilla anterior y se desplaza hasta la nueva. Se anima el
  // contenido (valor + badge + botón), no el número de posición.
  useIsomorphicLayoutEffect(() => {
    const pending = pendingFlipRef.current;
    pendingFlipRef.current = null;
    if (!pending || pending.moves.length === 0) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    for (const move of pending.moves) {
      const fromRect = pending.rects.get(move.from);
      const element = slotPieceRefs.current[move.to];
      if (!fromRect || !element) continue;

      const toRect = element.getBoundingClientRect();
      const dx = fromRect.left - toRect.left;
      const dy = fromRect.top - toRect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      element.style.transition = 'none';
      element.style.transform = `translate(${dx}px, ${dy}px)`;
      element.classList.add('slot-piece-flipping');

      // Fuerza el reflow para que el navegador registre el punto de partida.
      void element.offsetWidth;

      window.requestAnimationFrame(() => {
        element.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
        element.style.transform = 'translate(0, 0)';

        const timer = window.setTimeout(() => {
          element.style.transition = '';
          element.style.transform = '';
          element.classList.remove('slot-piece-flipping');
        }, 340);
        flipTimersRef.current.push(timer);
      });
    }
  }, [layout]);

  // Endurecimiento: ignora ids que no resuelven a un valor conocido (defensa en
  // profundidad ante estados corruptos; no debería ocurrir tras el fix del drag).
  const knownId = (id: string) => valueById[id] !== undefined;
  const trayIds = layout.tray.filter(knownId);
  const placedValidCount = layout.slots.filter(
    (id): id is string => id !== null && knownId(id)
  ).length;

  const full = isLayoutFull(layout) && placedValidCount === layout.slots.length;
  const hasPlaced = placedValidCount > 0;
  const allPlacedCount = placedValidCount;

  const isDragging = dragPayload !== null;

  const updateDragPreviewPosition = (x: number, y: number) => {
    dragPositionRef.current = { x, y };
    const ghost = dragGhostRef.current;
    if (!ghost) return;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  };

  const showDragPreview = (id: string, x: number, y: number) => {
    dragPositionRef.current = { x, y };
    setDragPreview({ id, value: valueById[id] ?? '' });
  };

  const hideDragPreview = () => {
    setDragPreview(null);
  };

  // Al montar el fantasma, lo colocamos en la última posición conocida.
  useIsomorphicLayoutEffect(() => {
    if (!dragPreview) return;
    updateDragPreviewPosition(dragPositionRef.current.x, dragPositionRef.current.y);
  }, [dragPreview]);

  const resetFlipAnimations = () => {
    for (const timer of flipTimersRef.current) window.clearTimeout(timer);
    flipTimersRef.current = [];

    for (const element of slotPieceRefs.current) {
      if (!element) continue;
      element.style.transition = '';
      element.style.transform = '';
      element.classList.remove('slot-piece-flipping');
    }
  };

  const commit = (next: AssemblyLayout) => {
    if (next === layout) return; // no-op: no suena ni re-renderiza

    // Si había una animación en curso, la cerramos en su posición final antes de
    // medir, para que un intercambio rápido no herede transforms a medio camino.
    resetFlipAnimations();

    // Captura las posiciones de origen antes de que React actualice el DOM.
    const moves = computeSlotMoves(layout, next);
    if (moves.length > 0) {
      const rects = new Map<number, DOMRect>();
      for (const move of moves) {
        const element = slotPieceRefs.current[move.from];
        if (element) rects.set(move.from, element.getBoundingClientRect());
      }
      pendingFlipRef.current = { moves, rects };
    } else {
      pendingFlipRef.current = null;
    }

    // Solo se limpian las casillas cuyo contenido cambió; el resto conserva sus
    // marcas verdes/rojas hasta que el usuario las toque.
    const changed = changedSlotIndexes(layout, next);
    setMarks((prev) => clearSlotMarks(prev, changed));

    audioService.playPiecePlaceSound();
    setLayout(next);
  };

  const handlePlace = (id: string, slotIndex: number) => {
    commit(placePiece(layout, id, slotIndex));
    setSelected(null);
  };

  const handleRemove = (slotIndex: number) => {
    commit(removeFromSlot(layout, slotIndex));
    setSelected(null);
  };

  const handleClear = () => {
    const next = clearSlots(layout);
    commit(next);
    setMarks(null);
    setSelected(null);
  };

  const handleTrayClick = (id: string) => {
    if (suppressTapRef.current) return;
    setSelected((prev) => (prev?.from === 'tray' && prev.id === id ? null : { from: 'tray', id }));
  };

  const handleSlotClick = (slotIndex: number) => {
    if (suppressTapRef.current) return;

    if (selected) {
      handlePlace(selected.id, slotIndex);
      return;
    }
    const currentId = layout.slots[slotIndex];
    if (currentId) {
      setSelected({ from: 'slot', id: currentId, slotIndex });
      // Tocar una casilla cuenta como interacción: su marca vuelve a neutral.
      setMarks((prev) => clearSlotMarks(prev, [slotIndex]));
    }
  };

  const handleSlotKeyDown = (slotIndex: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSlotClick(slotIndex);
    }
  };

  const handleDragStart = (payload: DragPayload) => (e: React.DragEvent<HTMLElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', payload.id);
    suppressNativeDragImage(e);
    showDragPreview(payload.id, e.clientX, e.clientY);
    if (payload.from === 'slot' && payload.slotIndex !== undefined) {
      setMarks((prev) => clearSlotMarks(prev, [payload.slotIndex as number]));
    }
    setDragPayload(payload);
  };

  const handleDragMove = (e: React.DragEvent<HTMLElement>) => {
    if (!dragPayload) return;
    updateDragPreviewPosition(e.clientX, e.clientY);
  };

  const handleDragEnd = () => {
    setDragPayload(null);
    setDragOverSlot(null);
    hideDragPreview();
  };

  // ---------------------------------------------------------------------------
  // Drag táctil (Pointer Events). Se mantiene el tap como alternativa.
  // ---------------------------------------------------------------------------
  const handlePointerDown =
    (payload: DragPayload) => (e: React.PointerEvent<HTMLElement>) => {
      if (!isTouch || e.pointerType === 'mouse' || e.button !== 0) return;

      pointerDragRef.current = {
        payload,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        pointerId: e.pointerId,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* algunos navegadores no permiten capturar; el flujo sigue funcionando */
      }
    };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.active) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.active = true;
      suppressTapRef.current = true;
      setDragPayload(drag.payload);
      showDragPreview(drag.payload.id, e.clientX, e.clientY);
      if (drag.payload.from === 'slot' && drag.payload.slotIndex !== undefined) {
        setMarks((prev) => clearSlotMarks(prev, [drag.payload.slotIndex as number]));
      }
    }

    e.preventDefault();
    updateDragPreviewPosition(e.clientX, e.clientY);

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slotElement = target?.closest<HTMLElement>('[data-slot-index]');
    const rawIndex = slotElement?.dataset.slotIndex;
    setDragOverSlot(rawIndex !== undefined ? Number(rawIndex) : null);
  };

  const finishPointerDrag = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    pointerDragRef.current = null;
    const wasActive = drag.active;
    setDragPayload(null);
    setDragOverSlot(null);
    hideDragPreview();

    if (!wasActive) return; // fue un tap: dejar que el click haga su trabajo

    // Evita que el click sintético posterior al arrastre seleccione la pieza.
    suppressTapRef.current = true;
    if (suppressTapTimerRef.current !== null) {
      window.clearTimeout(suppressTapTimerRef.current);
    }
    suppressTapTimerRef.current = window.setTimeout(() => {
      suppressTapRef.current = false;
    }, 250);

    if (cancelled) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);

    const slotElement = target?.closest<HTMLElement>('[data-slot-index]');
    if (slotElement) {
      const slotIndex = Number(slotElement.dataset.slotIndex);
      if (Number.isFinite(slotIndex)) handlePlace(drag.payload.id, slotIndex);
      return;
    }

    if (
      target?.closest('[data-tray-drop]') &&
      drag.payload.from === 'slot' &&
      drag.payload.slotIndex !== undefined
    ) {
      handleRemove(drag.payload.slotIndex);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    finishPointerDrag(e, false);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    finishPointerDrag(e, true);
  };

  const handleDropOnSlot = (slotIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
    const payload = dragPayload;
    setDragPayload(null);
    hideDragPreview();
    if (!payload) return;
    handlePlace(payload.id, slotIndex);
  };

  const handleDropOnTray = (e: React.DragEvent) => {
    e.preventDefault();
    const payload = dragPayload;
    setDragPayload(null);
    setDragOverSlot(null);
    hideDragPreview();
    if (payload?.from === 'slot' && payload.slotIndex !== undefined) {
      handleRemove(payload.slotIndex);
    }
  };

  const handleValidate = async () => {
    if (!full || isSubmitting || victoryPending) return;

    const pieces = layout.slots.map((id) => (id ? valueById[id] ?? '' : ''));
    const candidate = buildCandidate(layout, valueById);

    const result = await onValidate(pieces);
    if (!result) return;

    setLlmReply(result.reply);
    setMarks(result.feedback ? marksFromFeedback(result.feedback.slotCorrect) : null);

    // Refuerzo sonoro: acierto (total o parcial) o fallo.
    if (result.feedback && result.feedback.wellPlaced > 0) {
      audioService.playSlotCorrectSound();
    } else if (!result.victory) {
      audioService.playAssemblyWrongSound();
    }

    // Victoria: el panel permanece montado (App sostiene ~1.5 s la animación de
    // acierto) y recién después se abre el modal de victoria.
    if (result.victory) {
      setVictoryPending(true);
      onSolved?.(candidate, result.reply);
      return;
    }
  };

  const timerStyle = TIMER_STYLES[band] ?? TIMER_STYLES.normal;
  // Relleno de la barra analógica: 100% al inicio, 0% al agotarse el (falso) minuto.
  const timerPct = Math.max(0, Math.min(100, (remainingMs / ASSEMBLY_DURATION_MS) * 100));
  // Se anuncia por bandas (no cada segundo) para no saturar al lector de pantalla.
  const announcement = expired
    ? 'Se agotó el minuto en broma; puedes seguir intentando.'
    : remainingMs <= 10_000
      ? 'Quedan diez segundos, en broma.'
      : remainingMs <= 30_000
        ? 'Quedan treinta segundos, en broma.'
        : '';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Cabecera: contador analógico (franja fina) + burbuja del agente */}
      <div className="border-b border-amber-500/30 bg-gradient-to-b from-amber-950/40 via-card/70 to-background/90 px-3 py-2 sm:px-4">
        {/* Contador analógico: barra de progreso full-width, poco alto */}
        <div
          className={`mb-1.5 flex items-center gap-2 ${timerStyle.text}`}
          title="Contador: al llegar a cero no pasa nada, podés seguir jugando"
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-linear ${timerStyle.fill}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums">
            {clock}
          </span>
          <span className="sr-only" aria-live="polite">
            {announcement}
          </span>
        </div>

        <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 shadow-[0_0_16px_rgba(245,158,11,0.15)]">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-amber-500/50 bg-blue-950/80 text-amber-400">
            <Bot className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] font-bold text-amber-300">
              <span>Lucas (Pasante TI)</span>
              <span className="text-amber-500/60">•</span>
              <span className="font-normal text-muted-foreground">ensamblaje</span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-amber-100 whitespace-pre-wrap break-words">
              {bubbleMessage}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {/* Bandeja de piezas desbloqueadas (se colapsa a una línea cuando está vacía) */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wide text-foreground">
                <Sparkles className="size-3.5 text-amber-400" />
                Piezas desbloqueadas
              </h3>
              <span className="font-mono text-[10px] text-muted-foreground">
                {trayIds.length} en bandeja
              </span>
            </div>
            {trayIds.length === 0 ? (
              <p className="px-1 font-mono text-[11px] text-muted-foreground">
                Todas las piezas están en su casilla. Valida o retira alguna.
              </p>
            ) : (
              <div
                data-tray-drop
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropOnTray}
                className="flex min-h-[56px] flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/70 bg-secondary/15 p-2.5 transition-colors"
              >
                {trayIds.map((id) => {
                  const frag = valueById[id];
                  const isSelected = selected?.from === 'tray' && selected.id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      draggable={!isTouch}
                      onDragStart={isTouch ? undefined : handleDragStart({ from: 'tray', id })}
                      onDrag={isTouch ? undefined : handleDragMove}
                      onDragEnd={isTouch ? undefined : handleDragEnd}
                      onPointerDown={isTouch ? handlePointerDown({ from: 'tray', id }) : undefined}
                      onPointerMove={isTouch ? handlePointerMove : undefined}
                      onPointerUp={isTouch ? handlePointerUp : undefined}
                      onPointerCancel={isTouch ? handlePointerCancel : undefined}
                      onClick={() => handleTrayClick(id)}
                      aria-pressed={isSelected}
                      title={`Pieza " ${frag} ". Arrastra a una casilla o toca para seleccionar`}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tracking-wide transition-all ${
                        isTouch ? 'cursor-pointer touch-none' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        dragPayload?.from === 'tray' && dragPayload.id === id
                          ? 'opacity-40 border-dashed'
                          : ''
                      } ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/25 text-white ring-2 ring-amber-400/70 scale-105'
                          : 'border-amber-500/50 bg-gradient-to-b from-amber-950/70 via-card to-slate-950/80 text-amber-200 hover:border-amber-400 hover:scale-105'
                      }`}
                    >
                      <GripVertical className="size-3 opacity-50" aria-hidden="true" />
                      <span className="max-w-[120px] truncate">{frag}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Casillas del ensamblaje */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wide text-foreground">
                <Puzzle className="size-3.5 text-amber-400" />
                Orden de la clave
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {allPlacedCount} / {total || '?'} colocadas
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!hasPlaced || isSubmitting}
                  className="inline-flex items-center gap-1 rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  title="Retirar todas las piezas a la bandeja"
                >
                  <RotateCcw className="size-3" />
                  Vaciar
                </button>
              </div>
            </div>

            {/* Lista vertical numerada: el orden 1..N se lee de arriba hacia abajo */}
            <div className="flex flex-col gap-1.5">
              {layout.slots.map((id, index) => {
                const frag = id && knownId(id) ? valueById[id] : null;
                const isCorrect = Boolean(frag && marks?.correct[index]);
                const isWrong = Boolean(frag && marks?.wrong[index]);
                const isSelected = selected?.from === 'slot' && selected.slotIndex === index;
                const isDropTarget = dragOverSlot === index;

                return (
                  <div
                    key={index}
                    role="button"
                    tabIndex={0}
                    data-slot-index={index}
                    aria-label={`Casilla ${index + 1}${frag ? `: ${frag}` : ' vacía'}`}
                    draggable={Boolean(frag) && !isTouch}
                    onDragStart={
                      frag && id && !isTouch
                        ? handleDragStart({ from: 'slot', id, slotIndex: index })
                        : undefined
                    }
                    onDrag={isTouch ? undefined : handleDragMove}
                    onDragEnd={isTouch ? undefined : handleDragEnd}
                    onPointerDown={
                      frag && id && isTouch
                        ? handlePointerDown({ from: 'slot', id, slotIndex: index })
                        : undefined
                    }
                    onPointerMove={isTouch ? handlePointerMove : undefined}
                    onPointerUp={isTouch ? handlePointerUp : undefined}
                    onPointerCancel={isTouch ? handlePointerCancel : undefined}
                    onClick={() => handleSlotClick(index)}
                    onKeyDown={handleSlotKeyDown(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverSlot !== index) setDragOverSlot(index);
                    }}
                    onDragLeave={() => setDragOverSlot((prev) => (prev === index ? null : prev))}
                    onDrop={handleDropOnSlot(index)}
                    className={`flex min-h-9 items-center gap-2 rounded-lg border px-2 py-1 font-mono transition-all ${
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                        : isWrong
                          ? 'border-rose-500/70 bg-rose-950/30'
                          : isDropTarget
                            ? 'border-2 border-amber-400 bg-amber-500/25 ring-2 ring-amber-400/60 shadow-[0_0_18px_rgba(245,158,11,0.5)] scale-[1.01]'
                            : frag
                              ? 'border-amber-500/50 bg-gradient-to-r from-amber-950/60 via-card to-slate-950/70'
                              : 'border-dashed border-border/60 bg-secondary/10'
                    } ${
                      frag
                        ? `cursor-grab active:cursor-grabbing ${isTouch ? 'touch-none' : ''}`
                        : 'cursor-pointer'
                    } ${isSelected ? 'ring-2 ring-amber-400/70' : ''} ${
                      dragPayload?.from === 'slot' && dragPayload.id === id ? 'opacity-40' : ''
                    }`}
                  >
                    {/* Número de posición */}
                    <span className="flex size-6 shrink-0 items-center justify-center rounded border border-border/70 bg-secondary/40 text-[11px] font-bold text-muted-foreground">
                      {index + 1}
                    </span>

                    {/* Contenido de la pieza: es lo que se anima con FLIP */}
                    <div
                      ref={(element) => {
                        slotPieceRefs.current[index] = element;
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2"
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-sm font-bold tracking-wider ${
                          isCorrect
                            ? 'text-emerald-200'
                            : isWrong
                              ? 'text-rose-200'
                              : frag
                                ? 'text-amber-200'
                                : 'text-muted-foreground/50'
                        }`}
                      >
                        {frag ?? (selected || isDragging || isDropTarget ? 'Soltar aquí' : 'Vacía')}
                      </span>

                      {/* Estado de validación (solo tras validar) */}
                      {isCorrect && (
                        <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          bien
                          <span className="sr-only">posición correcta</span>
                        </span>
                      )}
                      {isWrong && (
                        <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase text-rose-400">
                          <X className="size-3.5" />
                          revisar
                          <span className="sr-only">posición incorrecta</span>
                        </span>
                      )}

                      {/* Retirar pieza */}
                      {frag && (
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(index);
                          }}
                          className="flex size-6 shrink-0 items-center justify-center rounded border border-border/70 text-muted-foreground transition-colors hover:border-rose-500/60 hover:text-rose-300"
                          title="Retirar pieza a la bandeja"
                        >
                          <X className="size-3.5" />
                          <span className="sr-only">Retirar pieza</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Acción de validar (el agente comunica cuántas piezas están bien) */}
          <section className="space-y-2">
            <Button
              type="button"
              onClick={handleValidate}
              disabled={!full || isSubmitting || victoryPending}
              className="h-10 w-full rounded-xl bg-amber-500 font-mono text-sm font-bold text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.35)] transition-all hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  <span>Validando con Lucas...</span>
                </>
              ) : (
                <>
                  <Puzzle className="size-4" data-icon="inline-start" />
                  <span>Validar ensamblaje</span>
                </>
              )}
            </Button>

            {!full && (
              <p className="text-center font-mono text-[10px] text-muted-foreground">
                Coloca todas las piezas para poder validar.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Fragmento flotante durante el arrastre. Va en un portal para que ningún
          ancestro con transform/overflow lo recorte o desplace. */}
      {dragPreview &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dragGhostRef}
            data-drag-preview
            aria-hidden="true"
            className="pointer-events-none fixed z-[100] max-w-[180px] rounded-lg border-2 border-amber-300 bg-gradient-to-b from-amber-400 to-amber-600 px-3 py-2 font-mono text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(0,0,0,0.55)] ring-4 ring-amber-500/25"
            style={{
              left: 0,
              top: 0,
              transform: 'translate(-50%, -130%) rotate(-2deg)',
            }}
          >
            <span className="flex items-center gap-1.5">
              <GripVertical className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span className="min-w-0 truncate">{dragPreview.value}</span>
            </span>
          </div>,
          document.body
        )}
    </div>
  );
};
