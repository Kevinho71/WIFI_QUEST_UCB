import React, { useState, useEffect } from 'react';
import type { SecurityLevel } from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import { triggerVictoryConfetti } from '@/lib/confetti';
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
  message,
  onAdvanceLevel,
}) => {
  const [copied, setCopied] = useState(false);
  const isLevel1 = level === 1;
  const config = LEVEL_CONFIGS[level];

  // Disparar confeti cuando el modal se abre
  useEffect(() => {
    if (isOpen) {
      triggerVictoryConfetti();
    }
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(realPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('No se pudo copiar automáticamente:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-md border-amber-500/50 bg-card p-6 shadow-[0_0_35px_rgba(245,158,11,0.25)] sm:rounded-xl">
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

        {/* Mensaje de confirmación del servidor */}
        <div className="rounded-lg border border-border/80 bg-background/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>

        {/* Caja de Contraseña Descubierta */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <Wifi className="size-3 text-amber-400" />
              CONTRASEÑA WIFI UNIVERSITARIA:
            </span>
            <span className="text-amber-400 font-bold">100% REVELADA</span>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-amber-500/50 bg-secondary/70 p-2.5 shadow-inner">
            <code className="truncate font-mono text-base sm:text-lg font-bold tracking-wider text-amber-300">
              {realPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={`h-8 font-mono text-xs gap-1.5 transition-all ${
                copied
                  ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold'
                  : 'border-amber-500/40 hover:bg-secondary text-amber-400'
              }`}
            >
              {copied ? (
                <>
                  <Check className="size-3.5" data-icon="inline-start" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" data-icon="inline-start" />
                  <span>Copiar</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
          {isLevel1 ? (
            <Button
              type="button"
              onClick={onAdvanceLevel}
              className="w-full gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.35)]"
            >
              <span>Desafiar Modo Difícil: Firewall Centinela</span>
              <ArrowRight className="size-4" data-icon="inline-end" />
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
