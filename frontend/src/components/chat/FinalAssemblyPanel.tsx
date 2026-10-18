import React, { useEffect, useRef, useState } from 'react';
import type {
  AssemblyFeedbackDTO,
  AssemblyValidationResult,
  GameStateDTO,
} from '@/types/chat';
import { Button } from '@/components/ui/button';
import { audioService } from '@/services/audioService';
import {
  placePiece,
  removeFromSlot,
  clearSlots,
  isLayoutFull,
  buildCandidate,
  type AssemblyLayout,
} from '@/lib/assembly';
import { useAssemblyTimer } from '@/hooks/useAssemblyTimer';
import { ASSEMBLY_EXPIRED_KEY, ASSEMBLY_DURATION_MS, writeFlag } from '@/lib/assemblyTimer';
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
  const [swapAnim, setSwapAnim] = useState<{ a: number; b: number } | null>(null);
  const [feedback, setFeedback] = useState<AssemblyFeedbackDTO | null>(null);
  const [llmReply, setLlmReply] = useState<string | null>(null);
  // Victoria confirmada: bloquea reenvíos mientras se muestra la animación de acierto.
  const [victoryPending, setVictoryPending] = useState(false);

  // En pantallas táctiles el drag & drop nativo (HTML5) no funciona: priorizamos
  // el patrón "toca la pieza y luego la casilla" y ocultamos la pista de arrastre.
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

  const swapTimerRef = useRef<number | null>(null);

  // Limpia el temporizador de la animación de intercambio al desmontar.
  useEffect(
    () => () => {
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    },
    []
  );

  const { clock, remainingMs, expired, band } = useAssemblyTimer();

  // Persistir el indicador de expiración (sincronización con un sistema externo).
  // La vista NO depende de este flag: se deriva de `expired`, así que el aviso
  // nunca se duplica por renders ni recargas.
  useEffect(() => {
    if (expired) writeFlag(ASSEMBLY_EXPIRED_KEY, true);
  }, [expired]);

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

  // Pieza en curso (arrastrando o seleccionada con tap): guía visual al colocar.
  const isDragging = dragPayload !== null;
  const carried = dragPayload ?? selected;

  const commit = (next: AssemblyLayout) => {
    if (next === layout) return; // no-op: no suena ni re-renderiza
    audioService.playPiecePlaceSound();
    setLayout(next);
    setFeedback(null);
  };

  const handlePlace = (id: string, slotIndex: number) => {
    // Intercambio casilla ↔ casilla: dispara el deslizamiento lateral opuesto.
    const fromSlotIndex = layout.slots.indexOf(id);
    const targetOccupied = layout.slots[slotIndex] !== null;
    if (fromSlotIndex !== -1 && fromSlotIndex !== slotIndex && targetOccupied) {
      const a = Math.min(fromSlotIndex, slotIndex);
      const b = Math.max(fromSlotIndex, slotIndex);
      setSwapAnim({ a, b });
      if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
      swapTimerRef.current = window.setTimeout(() => setSwapAnim(null), 260);
    }
    commit(placePiece(layout, id, slotIndex));
    setSelected(null);
  };

  const handleRemove = (slotIndex: number) => {
    commit(removeFromSlot(layout, slotIndex));
    setSelected(null);
  };

  const handleClear = () => {
    commit(clearSlots(layout));
    setSelected(null);
  };

  const handleTrayClick = (id: string) => {
    setSelected((prev) => (prev?.from === 'tray' && prev.id === id ? null : { from: 'tray', id }));
  };

  const handleSlotClick = (slotIndex: number) => {
    if (selected) {
      handlePlace(selected.id, slotIndex);
      return;
    }
    const currentId = layout.slots[slotIndex];
    if (currentId) setSelected({ from: 'slot', id: currentId, slotIndex });
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
    setDragPayload(payload);
  };

  const handleDropOnSlot = (slotIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
    const payload = dragPayload;
    setDragPayload(null);
    if (!payload) return;
    handlePlace(payload.id, slotIndex);
  };

  const handleDropOnTray = (e: React.DragEvent) => {
    e.preventDefault();
    const payload = dragPayload;
    setDragPayload(null);
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
    setFeedback(result.feedback ?? null);

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
                      onDragEnd={() => setDragPayload(null)}
                      onClick={() => handleTrayClick(id)}
                      aria-pressed={isSelected}
                      title={`Pieza " ${frag} ". ${isTouch ? 'Toca para seleccionar' : 'Arrastra a una casilla o toca para seleccionar'}`}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tracking-wide transition-all ${
                        isTouch ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
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
                      {!isTouch && <GripVertical className="size-3 opacity-50" />}
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

            {/* Guía visual de la pieza en curso (arrastrando o seleccionada) */}
            {carried && (valueById[carried.id] ?? '') !== '' && (
              <div className="mb-1.5 flex items-center gap-2 rounded-md border border-amber-400/60 bg-amber-500/10 px-2 py-1 font-mono text-[11px] text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <span className="text-muted-foreground">
                  {isDragging ? 'Arrastrando:' : 'Seleccionada:'}
                </span>
                <span className="font-bold">[ {valueById[carried.id]} ]</span>
                <span className="text-muted-foreground">→ toca o suelta en una casilla</span>
              </div>
            )}

            {/* Lista vertical numerada: el orden 1..N se lee de arriba hacia abajo */}
            <div className="flex flex-col gap-1.5">
              {layout.slots.map((id, index) => {
                const frag = id && knownId(id) ? valueById[id] : null;
                const isCorrect = Boolean(feedback && frag && feedback.slotCorrect[index]);
                const isWrong = Boolean(feedback && frag && !feedback.slotCorrect[index]);
                const isSelected = selected?.from === 'slot' && selected.slotIndex === index;
                const isDropTarget = dragOverSlot === index;
                const swapClass =
                  swapAnim && swapAnim.a === index
                    ? 'animate-slot-swap-left'
                    : swapAnim && swapAnim.b === index
                      ? 'animate-slot-swap-right'
                      : '';

                return (
                  <div
                    key={index}
                    role="button"
                    tabIndex={0}
                    aria-label={`Casilla ${index + 1}${frag ? `: ${frag}` : ' vacía'}`}
                    draggable={Boolean(frag) && !isTouch}
                    onDragStart={
                      frag && id && !isTouch
                        ? handleDragStart({ from: 'slot', id, slotIndex: index })
                        : undefined
                    }
                    onDragEnd={() => setDragPayload(null)}
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
                    } ${frag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                      isSelected ? 'ring-2 ring-amber-400/70' : ''
                    } ${
                      dragPayload?.from === 'slot' && dragPayload.id === id ? 'opacity-40' : ''
                    } ${swapClass}`}
                  >
                    {/* Número de posición */}
                    <span className="flex size-6 shrink-0 items-center justify-center rounded border border-border/70 bg-secondary/40 text-[11px] font-bold text-muted-foreground">
                      {index + 1}
                    </span>

                    {/* Valor */}
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
    </div>
  );
};
