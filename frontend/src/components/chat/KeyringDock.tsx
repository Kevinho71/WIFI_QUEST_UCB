import React, { useState, useEffect, useRef } from 'react';
import type { GameStateDTO, UnlockNotification } from '@/types/chat';
import {
  KeyRound,
  Target,
  Trophy,
  X,
  Check,
  Copy,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';

interface KeyringDockProps {
  gameState: GameStateDTO | null;
  justDroppedFragment?: string | null;
  unlockNotification?: UnlockNotification | null;
  onDismissNotification?: () => void;
  onFragmentClick?: (value: string) => void;
}

export const KeyringDock: React.FC<KeyringDockProps> = ({
  gameState,
  justDroppedFragment,
  unlockNotification,
  onDismissNotification,
  onFragmentClick,
}) => {
  const [copiedFragmentId, setCopiedFragmentId] = useState<string | null>(null);
  // Barra colapsada por defecto mientras se chatea; se despliega al tocar o al
  // desbloquear un fragmento nuevo (auto-cierre a los 3 s).
  const [isOpen, setIsOpen] = useState(false);

  const totalFragments = gameState?.totalFragments ?? 0;
  const discoveredCount = gameState?.discoveredCount ?? 0;
  const unlocked = gameState?.unlockedFragments ?? [];
  const phase = gameState?.phase ?? 'negotiation';

  // Si no hay total definido (por ejemplo antes de iniciar el juego), mostramos un valor base
  const totalSlots = Math.max(totalFragments, unlocked.length, 3);
  const isComplete = totalFragments > 0 && discoveredCount >= totalFragments;

  // Auto-expand por 3 s cuando llega un fragmento nuevo (no al rehidratar).
  const prevCountRef = useRef(discoveredCount);
  const collapseTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (discoveredCount > prevCountRef.current) {
      setIsOpen(true);
      if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = window.setTimeout(() => setIsOpen(false), 3000);
    }
    prevCountRef.current = discoveredCount;
  }, [discoveredCount]);
  useEffect(
    () => () => {
      if (collapseTimerRef.current !== null) window.clearTimeout(collapseTimerRef.current);
    },
    []
  );

  const handleCopyFragment = (fragId: string, value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopiedFragmentId(fragId);
    setTimeout(() => {
      setCopiedFragmentId(null);
    }, 1800);

    onFragmentClick?.(value);
  };

  // Etiqueta central del reto según la fase
  let statusIcon = <MessageSquare className="size-3 shrink-0 text-muted-foreground" />;
  let statusText = 'Habla con Lucas';
  if (phase === 'hunting') {
    statusIcon = <Target className="size-3 shrink-0 text-cyan-400" />;
    statusText = gameState?.currentChallengeHint || 'Descubre la pieza activa';
  } else if (phase === 'solved') {
    statusIcon = <Trophy className="size-3 shrink-0 text-emerald-400" />;
    statusText = '¡Clave ensamblada!';
  }

  return (
    <div className="relative w-full border-b border-primary/25 bg-card/65 shadow-lg backdrop-blur-md">
      {/* Toast sutil flotante de fragmento obtenido */}
      {unlockNotification && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg animate-unlock-toast">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/50 bg-emerald-950/95 px-3 py-1.5 text-[11px] font-mono text-emerald-200 shadow-[0_0_20px_rgba(34,197,94,0.35)] backdrop-blur-md">
            <p className="min-w-0 truncate">
              <span
                className={`font-semibold ${
                  unlockNotification.isCombo ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {unlockNotification.isCombo ? '¡Combo!' : 'Fragmento obtenido'}
              </span>{' '}
              <span className="font-bold text-white bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-500/40">
                [ {unlockNotification.fragmentValue} ]
              </span>
            </p>
            {onDismissNotification && (
              <button
                type="button"
                onClick={onDismissNotification}
                className="shrink-0 text-emerald-400/70 hover:text-emerald-200 p-0.5 rounded transition-colors"
                title="Cerrar notificación"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-3 py-1.5 sm:px-4">
        {/* Barra compacta (siempre una sola fila): contador · reto · ver piezas */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/60 active:scale-[0.995]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                isComplete
                  ? 'border-emerald-400 bg-emerald-950/80 text-emerald-300 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                  : 'border-emerald-500/50 bg-emerald-950/70 text-emerald-400'
              }`}
            >
              <KeyRound className="size-3" />
            </span>
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
                isComplete
                  ? 'border-emerald-400 bg-emerald-950/80 text-emerald-300 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                  : 'border-primary/40 bg-secondary/80 text-primary'
              }`}
            >
              [ {discoveredCount} / {totalFragments || '?'} ]
            </span>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span className="hidden text-muted-foreground/40 sm:inline">|</span>
              {statusIcon}
              <span className="truncate">{statusText}</span>
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold text-muted-foreground">
            <span className="hidden sm:inline">{isOpen ? 'Ocultar' : 'Ver piezas'}</span>
            <ChevronDown
              className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {/* Piezas: cuadrícula de 3 columnas al desplegar (cada tarjeta ancha y legible) */}
        {isOpen && (
          <div className="grid grid-cols-3 gap-2 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
            {Array.from({ length: totalSlots }).map((_, index) => {
              const isDiscovered = index < unlocked.length;
              const fragment = isDiscovered ? unlocked[index] : null;
              const isJustDropped = Boolean(
                fragment && justDroppedFragment && fragment.value === justDroppedFragment
              );
              const isCopied = fragment && copiedFragmentId === fragment.id;

              if (isDiscovered && fragment) {
                return (
                  <div
                    key={fragment.id || `unlocked_${index}`}
                    onClick={(e) => handleCopyFragment(fragment.id, fragment.value, e)}
                    title={`Fragmento #${fragment.orderDiscovered}: "${fragment.value}". Clic para insertar en el chat y copiar`}
                    className={`relative flex flex-col items-center justify-center rounded-lg border border-emerald-500/50 bg-gradient-to-b from-emerald-950/70 via-card to-slate-950/80 px-2 py-2 font-mono text-center cursor-pointer select-none shadow-[0_0_10px_rgba(34,197,94,0.18)] transition-all duration-200 group hover:border-emerald-400 active:scale-95 ${
                      isJustDropped ? 'animate-piece-drop ring-2 ring-emerald-400/80' : ''
                    }`}
                  >
                    {/* Etiqueta flotante de Copiado / Insertado */}
                    {isCopied && (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-amber-400 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 shadow-md flex items-center gap-1 z-30 whitespace-nowrap animate-in fade-in zoom-in-95">
                        <Check className="size-2.5" />
                        ¡Insertado!
                      </span>
                    )}

                    {/* Valor del fragmento desbloqueado */}
                    <span className="font-bold text-xs leading-tight break-words text-emerald-200 transition-colors group-hover:text-white">
                      [ {fragment.value} ]
                    </span>

                    {/* Subtítulo: Orden y Tipo */}
                    <div className="flex items-center gap-1 pt-0.5 text-[9px] text-muted-foreground group-hover:text-foreground">
                      <span className="font-semibold text-emerald-400">
                        #{fragment.orderDiscovered}
                      </span>
                      <span className="opacity-70">•</span>
                      <span className="uppercase text-[8px]">
                        {fragment.type === 'word'
                          ? 'texto'
                          : fragment.type === 'number'
                          ? 'núm'
                          : 'símb'}
                      </span>
                      <Copy className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                    </div>
                  </div>
                );
              }

              // Casilla pendiente / oculta [ ??? ]
              return (
                <div
                  key={`locked_${index}`}
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-secondary/15 px-2 py-2 font-mono text-center select-none opacity-50 transition-opacity hover:opacity-75"
                >
                  <span className="font-semibold text-xs text-muted-foreground/60 tracking-wider">
                    [ ??? ]
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 pt-0.5">#{index + 1}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
