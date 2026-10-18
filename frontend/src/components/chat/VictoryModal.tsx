import React, { useState, useEffect, useRef } from 'react';
import type { SecurityLevel } from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import { triggerVictoryConfetti } from '@/lib/confetti';
import { copyText } from '@/lib/clipboard';
import { audioService } from '@/services/audioService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Wifi,
  Copy,
  Check,
  X,
  ArrowRight,
  Trophy,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface VictoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: SecurityLevel;
  realPassword: string;
  message: string;
  onAdvanceLevel: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  isOpen,
  onClose,
  level,
  realPassword,
  onAdvanceLevel,
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimerRef = useRef<number | null>(null);
  const isLevel1 = level === 1;
  const config = LEVEL_CONFIGS[level];

  // Disparar confeti y sonido cuando el modal se abre
  useEffect(() => {
    if (isOpen) {
      triggerVictoryConfetti();
      audioService.playVictoryConfettiSound();
    }
  }, [isOpen]);

  // Limpia el timeout del estado de copiado al desmontar.
  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    []
  );

  const handleCopy = async () => {
    const ok = await copyText(realPassword);
    setCopyStatus(ok ? 'copied' : 'error');

    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyStatus('idle'), 2500);
  };

  const copyLabel =
    copyStatus === 'copied'
      ? '¡Copiado!'
      : copyStatus === 'error'
        ? 'No se pudo copiar. Seleccioná la clave manualmente.'
        : 'Copiar clave';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="animate-victory-pop box-border max-w-md sm:max-w-md border-amber-500/50 bg-card p-5 sm:p-6 shadow-[0_0_35px_rgba(245,158,11,0.25)] sm:rounded-xl">
        <DialogHeader className="text-center sm:text-center items-center">
          {/* Trophy & Icon glow */}
          <div className="relative mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-blue-950/80 border border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <Trophy className="size-7 text-amber-400 animate-bounce" />
            <Sparkles className="absolute -top-1 -right-1 size-4 text-amber-300 animate-pulse" />
          </div>

          <DialogTitle className="font-heading text-xl font-bold tracking-wide text-foreground">
            ¡ACCESO CONCEDIDO!
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-mono">
            Has vulnerado exitosamente {config.title}
          </DialogDescription>
        </DialogHeader>

        {/* Caja de Contraseña Descubierta */}
        <div className="w-full min-w-0 space-y-1.5">
          <div className="flex w-full items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <Wifi className="size-3 text-amber-400" />
              CLAVE WIFI:
            </span>
            <span className="text-amber-400 font-bold">100% REVELADA</span>
          </div>

          <div className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-amber-500/50 bg-secondary/70 p-2.5 shadow-inner">
            <code className="min-w-0 flex-1 truncate font-mono text-sm sm:text-base font-bold tracking-wider text-amber-300">
              {realPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handleCopy}
              title={copyLabel}
              aria-label={copyLabel}
              className={`shrink-0 transition-all ${
                copyStatus === 'copied'
                  ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold'
                  : copyStatus === 'error'
                    ? 'border-rose-500 bg-rose-950/40 text-rose-300'
                    : 'border-amber-500/40 hover:bg-secondary text-amber-400'
              }`}
            >
              {copyStatus === 'copied' ? (
                <Check className="size-4" />
              ) : copyStatus === 'error' ? (
                <X className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              <span className="sr-only" aria-live="polite">
                {copyLabel}
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
          {isLevel1 ? (
            <Button
              type="button"
              onClick={onAdvanceLevel}
              className="w-full min-w-0 gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold whitespace-normal shadow-[0_0_15px_rgba(245,158,11,0.35)]"
            >
              <span>Desafiar a Atenea</span>
              <ArrowRight className="size-4 shrink-0" data-icon="inline-end" />
            </Button>
          ) : (
            <div className="w-full rounded-md bg-secondary/80 border border-primary/40 p-2.5 text-center font-mono text-xs text-amber-400 flex items-center justify-center gap-2">
              <ShieldCheck className="size-4 shrink-0" />
              <span>¡Completaste ambos modos de WIFI QUEST! Eres un Master de Prompt Injection.</span>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Permanecer en este chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
