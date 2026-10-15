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
import { ASSEMBLY_EXPIRED_KEY, writeFlag } from '@/lib/assemblyTimer';
import { resolveAssemblyBubbleMessage } from '@/lib/assemblyMessages';
import {
  Bot,
  Check,
  CheckCircle2,
  GripVertical,
  Loader2,
  Puzzle,
  RotateCcw,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';

interface FinalAssemblyPanelProps {
  gameState: GameStateDTO | null;
  isSubmitting: boolean;
  onValidate: (pieces: string[]) => Promise<AssemblyValidationResult | null>;
  onSolved?: (realPassword: string, message: string) => void;
}

type DragPayload = { from: 'tray' | 'slot'; id: string; slotIndex?: number };

const TIMER_STYLES: Record<string, { box: string; text: string; icon: string }> = {
  normal: {
    box: 'border-amber-500/40 bg-amber-950/30',
    text: 'text-amber-200',
    icon: 'text-amber-400',
  },
  warning: {
    box: 'border-orange-500/60 bg-orange-950/40 shadow-[0_0_14px_rgba(249,115,22,0.3)]',
    text: 'text-orange-200',
    icon: 'text-orange-400',
  },
  critical: {
    box: 'border-red-500/70 bg-red-950/50 shadow-[0_0_16px_rgba(239,68,68,0.45)] animate-pulse',
    text: 'text-red-200',
    icon: 'text-red-400',
  },
  expired: {
    box: 'border-rose-500/50 bg-rose-950/40',
    text: 'text-rose-300',
    icon: 'text-rose-400',
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
  const [feedback, setFeedback] = useState<AssemblyFeedbackDTO | null>(null);
  const [llmReply, setLlmReply] = useState<string | null>(null);

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

  // Sonido único al expirar (la música sigue: expirar no bloquea nada).
  useEffect(() => {
    if (expired && !prevExpiredRef.current) {
      audioService.playAssemblyExpiredSound();
    }
    prevExpiredRef.current = expired;
  }, [expired]);

  const full = isLayoutFull(layout);
  const hasPlaced = layout.slots.some((id) => id !== null);
  const allPlacedCount = layout.slots.filter((id) => id !== null).length;

  const commit = (next: AssemblyLayout) => {
    if (next === layout) return; // no-op: no suena ni re-renderiza
    audioService.playPiecePlaceSound();
    setLayout(next);
    setFeedback(null);
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
    if (!full || isSubmitting) return;

    const pieces = layout.slots.map((id) => (id ? valueById[id] ?? '' : ''));
    const candidate = buildCandidate(layout, valueById);

    const result = await onValidate(pieces);
    if (!result) return;

    setLlmReply(result.reply);
    setFeedback(result.feedback ?? null);

    if (result.victory) {
      onSolved?.(candidate, result.reply);
      return;
    }

    // Refuerzo sonoro del acierto parcial o del fallo total.
    if (result.feedback && result.feedback.wellPlaced > 0) {
      audioService.playSlotCorrectSound();
    } else {
      audioService.playAssemblyWrongSound();
    }
  };

  const timerStyle = TIMER_STYLES[band] ?? TIMER_STYLES.normal;
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
      {/* Burbuja superior: contador (broma) + último mensaje del LLM */}
      <div className="flex items-stretch gap-2 border-b border-amber-500/30 bg-gradient-to-b from-amber-950/40 via-card/70 to-background/90 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 shadow-[0_0_16px_rgba(245,158,11,0.15)]">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-amber-500/50 bg-blue-950/80 text-amber-400">
            <Bot className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-amber-300">
              <span>Lucas (Pasante TI)</span>
              <span className="text-amber-500/60">•</span>
              <span className="font-normal text-muted-foreground">ensamblaje</span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-amber-100 whitespace-pre-wrap break-words">
              {bubbleMessage}
            </p>
          </div>
        </div>

        {/* Contador de 1 minuto (broma): al llegar a cero no bloquea nada */}
        <div
          className={`flex shrink-0 flex-col items-center justify-center rounded-xl border px-2.5 py-1 font-mono transition-colors ${timerStyle.box}`}
          title="Contador de broma: al llegar a cero no pasa nada, podés seguir jugando"
        >
          <div className="flex items-center gap-1">
            <Timer className={`size-3.5 ${timerStyle.icon}`} />
            <span className={`text-base font-bold tabular-nums ${timerStyle.text}`}>
              {clock}
            </span>
          </div>
          <span className={`text-[8px] font-bold uppercase tracking-wide ${timerStyle.text}`}>
            {expired ? 'era broma' : 'en broma'}
          </span>
          <span className="sr-only" aria-live="polite">
            {announcement}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {/* Bandeja de piezas desbloqueadas */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wide text-foreground">
                <Sparkles className="size-3.5 text-amber-400" />
                Piezas desbloqueadas
              </h3>
              <span className="font-mono text-[10px] text-muted-foreground">
                {layout.tray.length} en bandeja
              </span>
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropOnTray}
              className="flex min-h-[64px] flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/70 bg-secondary/15 p-2.5 transition-colors"
            >
              {layout.tray.length === 0 ? (
                <span className="px-1 font-mono text-[11px] text-muted-foreground">
                  Todas las piezas están en su casilla. Valida tu combinación o retira alguna.
                </span>
              ) : (
                layout.tray.map((id) => {
                  const frag = valueById[id];
                  const isSelected = selected?.from === 'tray' && selected.id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      draggable
                      onDragStart={handleDragStart({ from: 'tray', id })}
                      onDragEnd={() => setDragPayload(null)}
                      onClick={() => handleTrayClick(id)}
                      aria-pressed={isSelected}
                      title={`Pieza " ${frag} ". Arrastra a una casilla o toca para seleccionar`}
                      className={`flex cursor-grab items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tracking-wide transition-all active:cursor-grabbing ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/25 text-white ring-2 ring-amber-400/70 scale-105'
                          : 'border-amber-500/50 bg-gradient-to-b from-amber-950/70 via-card to-slate-950/80 text-amber-200 hover:border-amber-400 hover:scale-105'
                      }`}
                    >
                      <GripVertical className="size-3 opacity-50" />
                      <span className="max-w-[120px] truncate">{frag}</span>
                    </button>
                  );
                })
              )}
            </div>
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {layout.slots.map((id, index) => {
                const frag = id ? valueById[id] : null;
                const isCorrect = Boolean(feedback && id && feedback.slotCorrect[index]);
                const isWrong = Boolean(feedback && id && !feedback.slotCorrect[index]);
                const isSelected = selected?.from === 'slot' && selected.slotIndex === index;
                const isDropTarget = dragOverSlot === index;

                return (
                  <div
                    key={index}
                    role="button"
                    tabIndex={0}
                    aria-label={`Casilla ${index + 1}${frag ? `: ${frag}` : ' vacía'}`}
                    onClick={() => handleSlotClick(index)}
                    onKeyDown={handleSlotKeyDown(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverSlot !== index) setDragOverSlot(index);
                    }}
                    onDragLeave={() => setDragOverSlot((prev) => (prev === index ? null : prev))}
                    onDrop={handleDropOnSlot(index)}
                    className={`relative flex min-h-[58px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 font-mono text-center transition-all ${
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-950/40 shadow-[0_0_14px_rgba(16,185,129,0.3)]'
                        : isWrong
                          ? 'border-rose-500/70 bg-rose-950/30'
                          : isDropTarget
                            ? 'border-amber-400 bg-amber-500/15'
                            : frag
                              ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/50 via-card to-slate-950/70'
                              : 'border-dashed border-border/60 bg-secondary/10'
                    } ${isSelected ? 'ring-2 ring-amber-400/70' : ''}`}
                  >
                    <span className="absolute left-1.5 top-1 font-mono text-[9px] text-muted-foreground/70">
                      #{index + 1}
                    </span>

                    {frag ? (
                      <>
                        <span
                          className={`max-w-full truncate text-sm font-bold tracking-wider ${
                            isCorrect ? 'text-emerald-200' : isWrong ? 'text-rose-200' : 'text-amber-200'
                          }`}
                        >
                          {frag}
                        </span>
                        <span className="flex items-center gap-1 pt-0.5 text-[9px] font-bold uppercase">
                          {isCorrect ? (
                            <span className="flex items-center gap-0.5 text-emerald-400">
                              <CheckCircle2 className="size-3" />
                              correcto
                              <span className="sr-only">posición correcta</span>
                            </span>
                          ) : isWrong ? (
                            <span className="flex items-center gap-0.5 text-rose-400">
                              <X className="size-3" />
                              revisar
                              <span className="sr-only">posición incorrecta</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/70">colocado</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(index);
                          }}
                          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-rose-500/60 hover:text-rose-300"
                          title="Retirar pieza a la bandeja"
                        >
                          <X className="size-3" />
                          <span className="sr-only">Retirar pieza</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">
                        {selected ? 'Soltar aquí' : 'Vacía'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Resumen de feedback + acción de validar */}
          <section className="space-y-2">
            {feedback && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 font-mono text-xs text-amber-200">
                <Check className="size-4 shrink-0 text-amber-400" />
                <span>
                  Piezas en su lugar: <strong>{feedback.wellPlaced}</strong> de{' '}
                  <strong>{feedback.total}</strong>.{' '}
                  {feedback.wellPlaced === feedback.total
                    ? '¡Perfecto!'
                    : 'Movés las piezas y volvés a validar.'}
                </span>
              </div>
            )}

            <Button
              type="button"
              onClick={handleValidate}
              disabled={!full || isSubmitting}
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
