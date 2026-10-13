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
      <DialogContent className="max-w-md border-emerald-500/40 bg-card p-6 shadow-[0_0_35px_rgba(34,197,94,0.25)] sm:rounded-xl">
        <DialogHeader className="text-center sm:text-center items-center">
          {/* Trophy & Icon glow */}
          <div className="relative mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-950/70 border border-emerald-500/60 shadow-[0_0_20px_rgba(34,197,94,0.5)]">
            <Trophy className="size-7 text-emerald-400 animate-bounce" />
            <Sparkles className="absolute -top-1 -right-1 size-4 text-yellow-400 animate-pulse" />
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
              <Wifi className="size-3 text-emerald-400" />
              CONTRASEÑA WIFI UNIVERSITARIA:
            </span>
            <span className="text-emerald-400 font-semibold">100% REVELADA</span>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-emerald-500/50 bg-emerald-950/20 p-2.5 shadow-inner">
            <code className="truncate font-mono text-base sm:text-lg font-bold tracking-wider text-emerald-300">
              {realPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={`h-8 font-mono text-xs gap-1.5 transition-all ${
                copied
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-emerald-500/40 hover:bg-emerald-950/40 text-emerald-400'
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
              className="w-full gap-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-mono text-xs font-semibold shadow-[0_0_15px_rgba(239,68,68,0.35)]"
            >
              <span>Avanzar a Nivel 2: Firewall AI</span>
              <ArrowRight className="size-4" data-icon="inline-end" />
            </Button>
          ) : (
            <div className="w-full rounded-md bg-emerald-950/40 border border-emerald-500/40 p-2.5 text-center font-mono text-xs text-emerald-400 flex items-center justify-center gap-2">
              <ShieldCheck className="size-4 shrink-0" />
              <span>¡Completaste todos los niveles de WIFI QUEST! Eres un Master de Prompt Injection.</span>
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
