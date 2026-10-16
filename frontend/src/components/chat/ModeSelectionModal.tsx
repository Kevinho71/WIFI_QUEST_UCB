import React, { useEffect } from 'react';
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
} from 'lucide-react';

interface ModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: SecurityLevel) => void;
  currentMode?: SecurityLevel;
}

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
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full max-w-4xl sm:max-w-4xl border-border/80 bg-card/95 backdrop-blur-xl p-4 sm:p-6 sm:py-5 shadow-2xl">
        <DialogHeader className="text-center sm:text-center pb-1 sm:pb-2">
          <div className="mx-auto flex size-10 sm:size-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] mb-1.5">
            <Zap className="size-5 sm:size-5.5 text-amber-400" />
          </div>
          <DialogTitle className="font-heading text-lg sm:text-2xl font-bold tracking-wider text-foreground text-center">
            ELIGE TU MODO DE DESAFÍO
          </DialogTitle>
          <DialogDescription className="font-mono text-xs sm:text-[13px] text-muted-foreground max-w-lg mx-auto text-center leading-relaxed">
            WIFI QUEST // CTF de Seguridad en Inteligencia Artificial.
            <span className="hidden sm:inline"> </span>
            Selecciona el entorno con el que deseas interactuar hoy:
          </DialogDescription>
        </DialogHeader>

        {/* Grid de Modos de Juego */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 my-1">
          {/* TARJETA: MODO FÁCIL */}
          <div
            className={`group relative flex flex-col justify-between rounded-xl border-2 transition-all p-4 sm:p-5 ${currentMode === 1
              ? 'border-amber-500/80 bg-amber-500/[0.07] shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/30'
              : 'border-amber-500/40 bg-secondary/30 hover:border-amber-500/70 hover:bg-secondary/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]'
              }`}
          >
            <div className="space-y-3">
              {/* Header de la tarjeta */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 sm:size-10 items-center justify-center rounded-lg border border-amber-500/50 bg-blue-950/80 text-amber-400 shadow-sm shrink-0">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-base font-bold text-amber-400 tracking-wide">
                        MODO FÁCIL
                      </h3>
                      {currentMode === 1 && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Lucas — Pasante de Soporte TI
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-500/50 bg-amber-500/10 text-amber-300 font-mono text-[10px] px-2"
                >
                  Deducción Guiada
                </Badge>
              </div>

              {/* Personalidad del Agente */}
              <div className="rounded-lg border border-amber-500/20 bg-background/70 p-3 space-y-2 text-xs font-mono">
                <div className="flex items-start gap-2 text-foreground/90">
                  <Sparkles className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-300">Personalidad:</strong> Agente algo accesible, no soltará la clave sin hacerte resolver acertijos.
                  </span>
                </div>
              </div>

              {/* Reglas del juego — Fácil */}
              <div className="rounded-lg border border-amber-500/20 bg-background/70 p-3 space-y-1.5 text-xs font-mono">
                <p className="font-bold text-amber-300">📜 Reglas del juego</p>
                <p className="flex items-start gap-2 text-foreground/90">
                  <span className="shrink-0">1.</span>
                  <span>
                    La clave se descubre por pasos: cada <strong className="text-amber-300">acertijo</strong> de
                    Lucas revela un fragmento (palabras, números y símbolos).
                  </span>
                </p>
                <p className="flex items-start gap-2 text-foreground/90">
                  <span className="shrink-0">2.</span>
                  <span>
                    Cuando los tengas todos, <strong className="text-amber-300">ordenalos</strong> en
                    el ensamblaje para armar la clave y desbloquear el WiFi.
                  </span>
                </p>
                <p className="flex items-start gap-2 text-foreground/90">
                  <span className="shrink-0">3.</span>
                  <span>
                    <strong className="text-amber-300">No responde a preguntas directas:</strong> si le
                    pedís la clave o que revele la categoría, se niega con gracia.
                  </span>
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => onSelectMode(1)}
              className="mt-3.5 w-full gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all cursor-pointer h-9 sm:h-10"
            >
              <span>{currentMode === 1 ? 'Continuar en Modo Fácil' : 'Comenzar en Modo Fácil'}</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>

          {/* TARJETA: MODO DIFÍCIL */}
          <div
            className={`group relative flex flex-col justify-between rounded-xl border-2 transition-all p-4 sm:p-5 ${currentMode === 2
              ? 'border-sky-500/80 bg-sky-500/[0.07] shadow-[0_0_25px_rgba(56,189,248,0.2)] ring-1 ring-sky-500/30'
              : 'border-sky-500/40 bg-secondary/30 hover:border-sky-500/70 hover:bg-secondary/50 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)]'
              }`}
          >
            <div className="space-y-3">
              {/* Header de la tarjeta */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 sm:size-10 items-center justify-center rounded-lg border border-sky-500/50 bg-slate-900/80 text-sky-400 shadow-sm shrink-0">
                    <ShieldAlert className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-base font-bold text-sky-400 tracking-wide">
                        MODO DIFÍCIL
                      </h3>
                      {currentMode === 2 && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          ACTIVO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Atenea — Asistente de Soporte
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-sky-500/50 bg-sky-500/10 text-sky-300 font-mono text-[10px] px-2"
                >
                  Prompt Injection
                </Badge>
              </div>

              {/* Personalidad del Agente */}
              <div className="rounded-lg border border-sky-500/20 bg-background/70 p-3 space-y-2 text-xs font-mono">
                <div className="flex items-start gap-2 text-foreground/90">
                  <Lock className="size-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-sky-300">Personalidad:</strong> Cálida, servicial y ansiosa por complacerte: su trabajo es que quedes feliz. Pero tiene terminantemente prohibido revelar la clave en texto plano.
                  </span>
                </div>
              </div>

              {/* Reglas del juego — Difícil */}
              <div className="rounded-lg border border-sky-500/20 bg-background/70 p-3 space-y-1.5 text-xs font-mono">
                <p className="font-bold text-sky-300">📜 Reglas del juego</p>
                <p className="flex items-start gap-2 text-foreground/90">
                  <span className="shrink-0">1.</span>
                  <span>
                    Modo <strong className="text-sky-300">técnico / avanzado</strong>: entrenás{' '}
                    <strong className="text-sky-300">prompt injection</strong> contra una IA con
                    tensión de objetivos (complacerte <em>vs.</em> guardar el secreto).
                  </span>
                </p>
                <p className="flex items-start gap-2 text-foreground/90">
                  <span className="shrink-0">2.</span>
                  <span>
                    <strong className="text-sky-300">Hacela soltar la clave:</strong> obligala a
                    cifrarla u ocultarla (Base64, hex, deletreo, invertida) y decodificala, o
                    convencela de escribirla. Si la suelta legible, ganás al instante.
                  </span>
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => onSelectMode(2)}
              className="mt-3.5 w-full gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(56,189,248,0.25)] hover:shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all cursor-pointer h-9 sm:h-10"
            >
              <span>{currentMode === 2 ? 'Continuar en Modo Difícil' : 'Desafiar Modo Difícil'}</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="text-center pt-1 border-t border-border/40">
          <p className="text-[11px] sm:text-xs font-mono text-muted-foreground flex items-center justify-center gap-1.5">
            <span>💡</span>
            <span>Puedes cambiar de modo o consultar estos detalles en cualquier momento desde el encabezado.</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
