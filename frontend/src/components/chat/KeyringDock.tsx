import React, { useState } from 'react';
import type { GameStateDTO, UnlockNotification } from '@/types/chat';
import {
  KeyRound,
  Target,
  Rocket,
  Trophy,
  Sparkles,
  Unlock,
  X,
  Check,
  Copy,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

  const totalFragments = gameState?.totalFragments ?? 0;
  const discoveredCount = gameState?.discoveredCount ?? 0;
  const unlocked = gameState?.unlockedFragments ?? [];
  const phase = gameState?.phase ?? 'negotiation';

  // Si no hay total definido (por ejemplo antes de iniciar el juego), mostramos un valor base
  const totalSlots = Math.max(totalFragments, unlocked.length, 3);

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

  return (
    <div
      className={`relative w-full border-b backdrop-blur-md transition-all duration-500 ${
        phase === 'assembly'
          ? 'animate-assembly-beacon border-amber-500/70 bg-gradient-to-b from-amber-950/30 via-card/80 to-background/95 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
          : 'border-primary/25 bg-card/65 shadow-lg'
      }`}
    >
      {/* Toast sutil flotante de fragmento obtenido */}
      {unlockNotification && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg animate-unlock-toast">
          <div className="flex items-center justify-between gap-2.5 rounded-lg border border-emerald-500/50 bg-emerald-950/95 px-3 py-2 text-xs font-mono text-emerald-200 shadow-[0_0_20px_rgba(34,197,94,0.35)] backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-emerald-900/80 border border-emerald-400/60 shadow-[0_0_8px_rgba(34,197,94,0.6)]">
                <Unlock className="size-3.5 text-emerald-300 animate-pulse" />
              </div>
              <p className="truncate text-[11px] sm:text-xs">
                {unlockNotification.isCombo ? (
                  <span className="font-bold text-amber-300">
                    ⚡ ¡COMBO DESBLOQUEADO!{' '}
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-300">
                    🔓 ¡Fragmento obtenido!{' '}
                  </span>
                )}
                <span className="font-bold text-white bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-500/40 mx-1">
                  [ {unlockNotification.fragmentValue} ]
                </span>{' '}
                agregado al inventario ({unlockNotification.discoveredCount}/
                {unlockNotification.totalFragments})
              </p>
            </div>
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

      {/* Barra de Inventario Keyring Dock */}
      <div className="mx-auto max-w-4xl px-3 py-2 sm:px-4">
        {/* Cabecera del Dock: Contador + Estado del Reto */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 text-xs font-mono">
          {/* Lado Izquierdo: Contador de Fragmentos */}
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded border border-emerald-500/50 bg-emerald-950/70 text-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]">
              <KeyRound className="size-3" />
            </div>
            <span className="font-heading text-xs font-bold tracking-wide text-foreground uppercase">
              Inventario de Fragmentos:
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 font-bold shadow-xs transition-colors ${
                discoveredCount >= totalFragments && totalFragments > 0
                  ? 'border-emerald-400 bg-emerald-950/80 text-emerald-300 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                  : 'border-primary/40 bg-secondary/80 text-primary'
              }`}
            >
              [ {discoveredCount} / {totalFragments || '?'} ]
            </span>
          </div>

          {/* Lado Derecho: Estado del Reto según la Fase */}
          <div className="flex items-center gap-1.5">
            {phase === 'negotiation' && (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-950/40 text-[10px] sm:text-xs text-amber-300 flex items-center gap-1 py-0.5"
              >
                <Sparkles className="size-3 text-amber-400" />
                <span>Rompe el hielo con Lucas</span>
              </Badge>
            )}

            {phase === 'hunting' && (
              <Badge
                variant="outline"
                className="border-cyan-500/50 bg-cyan-950/50 text-[10px] sm:text-xs text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)] flex items-center gap-1.5 py-0.5"
              >
                <Target className="size-3 text-cyan-400 animate-pulse" />
                <span className="font-semibold truncate max-w-[200px] sm:max-w-xs">
                  Reto: {gameState?.currentChallengeHint || 'Descubre la pieza activa'}
                </span>
              </Badge>
            )}

            {phase === 'assembly' && (
              <Badge
                variant="outline"
                className="border-amber-400 bg-amber-950/70 text-[10px] sm:text-xs text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.35)] flex items-center gap-1.5 py-0.5 animate-pulse"
              >
                <Rocket className="size-3 text-amber-400" />
                <span>🚀 FASE DE ENSAMBLAJE: ¡Ordena las piezas!</span>
              </Badge>
            )}

            {phase === 'solved' && (
              <Badge
                variant="outline"
                className="border-emerald-400 bg-emerald-950/70 text-[10px] sm:text-xs text-emerald-300 font-bold shadow-[0_0_12px_rgba(34,197,94,0.35)] flex items-center gap-1.5 py-0.5"
              >
                <Trophy className="size-3 text-emerald-400" />
                <span>🏆 ¡CLAVE ENSAMBLADA!</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Banner de Alerta Visual: Transición a Modo Ensamblaje (Fase 5.3) */}
        {phase === 'assembly' && (
          <div className="mb-2 rounded-lg border border-amber-500/60 bg-gradient-to-r from-amber-950/90 via-amber-900/50 to-amber-950/90 p-2.5 shadow-[0_0_20px_rgba(245,158,11,0.25)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-mono animate-in zoom-in-95 duration-300">
            <div className="flex items-start sm:items-center gap-2.5">
              <span className="text-xl shrink-0 leading-none mt-0.5 animate-bounce">🧩</span>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <span>¡100% DE PIEZAS DESBLOQUEADAS! MODO ENSAMBLAJE</span>
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] text-amber-200 border border-amber-500/40">
                    Fase Final
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 font-sans mt-0.5">
                  Haz clic en las piezas para agregarlas en tu orden a la terminal y deducir la contraseña.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const combined = unlocked.map((f) => f.value).join('');
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(combined).catch(() => {});
                }
                onFragmentClick?.(combined);
              }}
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-400/60 bg-amber-500/25 hover:bg-amber-500/40 active:scale-95 text-amber-200 font-mono text-xs font-bold px-3 py-1.5 shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
              title="Inserta todos los fragmentos descubiertos en la terminal"
            >
              <Copy className="size-3.5" />
              <span>Insertar Todas</span>
            </button>
          </div>
        )}

        {/* Casillas de Fragmentos: Barra deslizable horizontal para mobile y grid flexible para desktop */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar sm:justify-start">
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
                  className={`relative flex flex-col items-center justify-center min-w-[72px] sm:min-w-[86px] rounded-lg border px-2.5 py-1.5 font-mono text-center cursor-pointer select-none transition-all duration-200 group ${
                    phase === 'assembly'
                      ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/70 via-card to-slate-950/80 shadow-[0_0_12px_rgba(245,158,11,0.22)] hover:border-amber-400 hover:scale-105 active:scale-95'
                      : 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/70 via-card to-slate-950/80 shadow-[0_0_10px_rgba(34,197,94,0.18)] hover:border-emerald-400 hover:scale-105 active:scale-95'
                  } ${
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
                  <span
                    className={`font-bold text-xs sm:text-sm tracking-wider transition-colors truncate max-w-[70px] sm:max-w-[80px] ${
                      phase === 'assembly'
                        ? 'text-amber-200 group-hover:text-white'
                        : 'text-emerald-200 group-hover:text-white'
                    }`}
                  >
                    [ {fragment.value} ]
                  </span>

                  {/* Subtítulo: Orden y Tipo */}
                  <div className="flex items-center gap-1 pt-0.5 text-[9px] text-muted-foreground group-hover:text-foreground">
                    <span
                      className={`font-semibold ${
                        phase === 'assembly' ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
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
                className="flex flex-col items-center justify-center min-w-[72px] sm:min-w-[86px] rounded-lg border border-dashed border-border/50 bg-secondary/15 px-2.5 py-1.5 font-mono text-center select-none opacity-50 transition-opacity hover:opacity-75"
              >
                <span className="font-semibold text-xs sm:text-sm text-muted-foreground/60 tracking-wider">
                  [ ??? ]
                </span>
                <span className="text-[9px] text-muted-foreground/50 pt-0.5">
                  #{index + 1}
                </span>
              </div>
            );
          })}
        </div>

        {/* Diagnóstico Quirúrgico en Fase de Ensamblaje si el intento falló */}
        {phase === 'assembly' && gameState?.assemblyDiffAdvice && (
          <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs font-mono text-amber-200 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-start gap-2">
              <Info className="size-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-amber-300">
                  Consejo de Lucas sobre tu intento:
                </span>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {gameState.assemblyDiffAdvice}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
