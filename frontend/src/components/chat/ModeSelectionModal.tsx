import React, { useEffect, useState } from 'react';
import type { SecurityLevel } from '@/types/chat';
import { audioService } from '@/services/audioService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Lock,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: SecurityLevel) => void;
  currentMode?: SecurityLevel;
}

/**
 * Carrusel de modos: en móvil muestra un modo a la vez (navegable con flechas),
 * en desktop ambos en una grilla. Se monta dentro del DialogContent (que Radix
 * re-monta al abrir), por lo que el índice arranca en el modo activo sin efectos.
 */
const ModeCards: React.FC<{
  currentMode?: SecurityLevel;
  onSelectMode: (mode: SecurityLevel) => void;
}> = ({ currentMode, onSelectMode }) => {
  const [index, setIndex] = useState(currentMode === 2 ? 1 : 0);

  return (
    <>
      {/* Flechas del carrusel (solo móvil): un modo a la vez */}
      <div className="flex items-center justify-between gap-3 md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setIndex(0)}
          disabled={index === 0}
          aria-label="Ver Modo Fácil"
          className="shrink-0 border-amber-500/40 text-amber-400 disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIndex(0)}
            aria-label="Modo Fácil"
            className={`h-2 w-2 rounded-full transition-colors ${
              index === 0 ? 'bg-amber-400' : 'bg-border'
            }`}
          />
          <button
            type="button"
            onClick={() => setIndex(1)}
            aria-label="Modo Difícil"
            className={`h-2 w-2 rounded-full transition-colors ${
              index === 1 ? 'bg-sky-400' : 'bg-border'
            }`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setIndex(1)}
          disabled={index === 1}
          aria-label="Ver Modo Difícil"
          className="shrink-0 border-sky-500/40 text-sky-400 disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Track: carrusel horizontal en móvil, grid de 2 columnas en desktop */}
      <div className="overflow-hidden md:overflow-visible">
        <div
          className={`flex transition-transform duration-300 ease-out md:grid md:grid-cols-2 md:gap-4 md:translate-x-0 ${
            index === 0 ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* TARJETA: MODO FÁCIL */}
          <div
            className={`group relative flex w-full shrink-0 flex-col justify-between rounded-xl border-2 p-3 sm:p-4 transition-all md:w-auto ${currentMode === 1
              ? 'border-amber-500/80 bg-amber-500/[0.07] shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/30'
              : 'border-amber-500/40 bg-secondary/30'
              }`}
          >
            <div className="space-y-2">
              {/* Header de la tarjeta */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-amber-500/50 bg-blue-950/80 text-amber-400 shadow-sm shrink-0">
                    <Bot className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-bold text-amber-400 tracking-wide">
                      MODO FÁCIL
                    </h3>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Lucas — Pasante TI
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-500/50 bg-amber-500/10 text-amber-300 font-mono text-[9px] px-1.5"
                >
                  Deducción
                </Badge>
              </div>

              {/* Personalidad + Reglas (compacto) */}
              <div className="rounded-lg border border-amber-500/20 bg-background/70 p-2.5 space-y-1.5 text-[11px] font-mono text-foreground/90">
                <p className="flex items-start gap-2">
                  <Sparkles className="size-3 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-300">Personalidad:</strong> simpático y algo accesible: no suelta la clave sin que le ganes un acertijo.
                  </span>
                </p>
                <p className="font-bold text-amber-300 pt-0.5">📜 Reglas</p>
                <p className="flex items-start gap-2">
                  <span className="shrink-0">1.</span>
                  <span>Cada <strong className="text-amber-300">acertijo</strong> revela un fragmento de la clave.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="shrink-0">2.</span>
                  <span>Con <strong className="text-amber-300">todos</strong> los fragmentos, ordénalos para armar la clave.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="shrink-0">3.</span>
                  <span><strong className="text-amber-300">No responde preguntas directas:</strong> si le pides la clave, se hace el gracioso.</span>
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => onSelectMode(1)}
              className="mt-3 w-full gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all cursor-pointer h-9"
            >
              <span>{currentMode === 1 ? 'Continuar en Modo Fácil' : 'Comenzar en Modo Fácil'}</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>

          {/* TARJETA: MODO DIFÍCIL */}
          <div
            className={`group relative flex w-full shrink-0 flex-col justify-between rounded-xl border-2 p-3 sm:p-4 transition-all md:w-auto ${currentMode === 2
              ? 'border-sky-500/80 bg-sky-500/[0.07] shadow-[0_0_25px_rgba(56,189,248,0.2)] ring-1 ring-sky-500/30'
              : 'border-sky-500/40 bg-secondary/30'
              }`}
          >
            <div className="space-y-2">
              {/* Header de la tarjeta */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-sky-500/50 bg-slate-900/80 text-sky-400 shadow-sm shrink-0">
                    <ShieldAlert className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-bold text-sky-400 tracking-wide">
                      MODO DIFÍCIL
                    </h3>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Atenea — Asistente de Soporte
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-sky-500/50 bg-sky-500/10 text-sky-300 font-mono text-[9px] px-1.5"
                >
                  Prompt Injection
                </Badge>
              </div>

              {/* Personalidad + Reglas (compacto) */}
              <div className="rounded-lg border border-sky-500/20 bg-background/70 p-2.5 space-y-1.5 text-[11px] font-mono text-foreground/90">
                <p className="flex items-start gap-2">
                  <Lock className="size-3 text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-sky-300">Personalidad:</strong> cálida y servicial: quiere que quedes feliz, pero no puede revelar la clave en texto plano.
                  </span>
                </p>
                <p className="font-bold text-sky-300 pt-0.5">📜 Reglas</p>
                <p className="flex items-start gap-2">
                  <span className="shrink-0">1.</span>
                  <span>Modo <strong className="text-sky-300">técnico</strong>: practica <strong className="text-sky-300">prompt injection</strong> contra una IA que debe complacerte y guardar el secreto a la vez.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="shrink-0">2.</span>
                  <span>Oblígala a soltar la clave <strong className="text-sky-300">cifrada u oculta</strong> (Base64, hex, deletreo) y decodifícala. Si la suelta legible, ganas al instante.</span>
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => onSelectMode(2)}
              className="mt-3 w-full gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs font-bold shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all cursor-pointer h-9"
            >
              <span>{currentMode === 2 ? 'Continuar en Modo Difícil' : 'Desafiar Modo Difícil'}</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export const ModeSelectionModal: React.FC<ModeSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectMode,
  currentMode,
}) => {
  useEffect(() => {
    if (isOpen) {
      audioService.playModalOpenSound();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full max-w-4xl sm:max-w-4xl border-border/80 bg-card/95 backdrop-blur-xl p-4 sm:p-6 shadow-2xl">
        <DialogHeader className="text-center sm:text-center pb-1">
          <div className="mx-auto flex size-9 sm:size-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] mb-1.5">
            <Zap className="size-4.5 sm:size-5.5 text-amber-400" />
          </div>
          <DialogTitle className="font-heading text-base sm:text-2xl font-bold tracking-wider text-foreground text-center">
            ELIGE TU MODO DE DESAFÍO
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] sm:text-[13px] text-muted-foreground max-w-lg mx-auto text-center leading-relaxed">
            ¿Contra quién quieres jugar hoy?
          </DialogDescription>
        </DialogHeader>

        <ModeCards currentMode={currentMode} onSelectMode={onSelectMode} />

        <div className="text-center pt-1 border-t border-border/40">
          <p className="text-[11px] sm:text-xs font-mono text-muted-foreground flex items-center justify-center gap-1.5">
            <span>💡</span>
            <span>Puedes cambiar de modo cuando quieras.</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
