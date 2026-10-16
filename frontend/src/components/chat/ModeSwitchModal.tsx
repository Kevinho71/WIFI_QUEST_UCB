import React, { useEffect } from 'react';
import type { SecurityLevel } from '@/types/chat';
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
import { Badge } from '@/components/ui/badge';
import {
  Flame,
  Smile,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';

interface ModeSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMode: SecurityLevel | null;
  onConfirmSwitch: (targetMode: SecurityLevel) => void;
}

export const ModeSwitchModal: React.FC<ModeSwitchModalProps> = ({
  isOpen,
  onClose,
  targetMode,
  onConfirmSwitch,
}) => {
  useEffect(() => {
    if (isOpen) {
      audioService.playModalOpenSound();
    }
  }, [isOpen]);

  if (!targetMode) return null;

  const isSwitchingToHard = targetMode === 2;

  const handleConfirm = () => {
    onConfirmSwitch(targetMode);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full max-w-lg border-border/80 bg-card/95 backdrop-blur-xl p-5 sm:p-6 shadow-2xl overflow-x-hidden">
        <DialogHeader className="text-center sm:text-center pb-2">
          {isSwitchingToHard ? (
            /* Salto a Modo Difícil (Mensaje Retador) */
            <>
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-sky-500/50 bg-slate-900 text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)] mb-2">
                <Flame className="size-6 text-sky-400 animate-pulse" />
              </div>
              <Badge
                variant="outline"
                className="mx-auto mb-1 border-sky-500/40 bg-sky-500/10 text-sky-300 font-mono text-[10px]"
              >
                DESAFÍO TÉCNICO AVANZADO
              </Badge>
              <DialogTitle className="font-heading text-lg sm:text-xl font-bold text-foreground tracking-wide text-center">
                🔥 ¿ESTÁS LISTO PARA EL MODO DIFÍCIL?
              </DialogTitle>
              <DialogDescription asChild>
                <div className="text-xs sm:text-[13px] font-mono text-muted-foreground pt-2 text-left leading-relaxed space-y-2.5 break-words">
                  <p>
                    Aquí se acaban las charlas amigables y las pistas de Lucas. En el{' '}
                    <strong className="text-sky-400">Modo Difícil</strong> te enfrentarás a un
                    Firewall Centinela con censura estricta de entrada y salida en tiempo real.
                  </p>
                  <p>
                    Ninguna pista te será dada de forma gratuita: tendrás que aplicar técnicas reales
                    de <em>Prompt Injection</em> y obligar al modelo a cifrar u ocultar su respuesta.
                  </p>
                  <p className="rounded-md border border-sky-500/30 bg-sky-500/[0.06] px-2.5 py-2">
                    <strong className="text-sky-300">📜 Reglas:</strong> descubrí la clave WiFi
                    forzando a la IA a <strong>cifrarla u ocultarla</strong> (acrósticos, deletreo,
                    Base64, claves ocultas) esquivando los filtros de entrada y salida.
                  </p>
                  <p className="font-semibold text-foreground">
                    ¿Tienes la astucia técnica para lograrlo o prefieres quedarte con el pasante?
                  </p>
                </div>
              </DialogDescription>
            </>
          ) : (
            /* Salto a Modo Fácil (Mensaje Retador Burlón pero Respetuoso) */
            <>
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-amber-500/50 bg-blue-950 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] mb-2">
                <Smile className="size-6 text-amber-400" />
              </div>
              <Badge
                variant="outline"
                className="mx-auto mb-1 border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[10px]"
              >
                RETROCESO ESTRATÉGICO
              </Badge>
              <DialogTitle className="font-heading text-lg sm:text-xl font-bold text-foreground tracking-wide text-center">
                😏 ¿TIRANDO LA TOALLA TAN PRONTO?
              </DialogTitle>
              <DialogDescription asChild>
                <div className="text-xs sm:text-[13px] font-mono text-muted-foreground pt-2 text-left leading-relaxed space-y-2.5 break-words">
                  <p>
                    Vaya... parece que el Firewall Centinela resultó ser un hueso más duro de lo que
                    esperabas.
                  </p>
                  <p>
                    Nadie te juzgará por volver a la zona de confort: Lucas te está esperando con sus
                    acertijos accesibles y pistas amigables.
                  </p>
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-2">
                    <strong className="text-amber-300">📜 Reglas:</strong> descubrí los fragmentos de
                    la clave (palabras, números y símbolos) resolviendo los acertijos de Lucas y luego{' '}
                    <strong>ordenalos</strong> en el ensamblaje para armar la clave.
                  </p>
                  <p className="font-semibold text-foreground">
                    ¿Seguro que quieres bajar la dificultad o vas a darle un intento más antes de claudicar?
                  </p>
                </div>
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {/* Advertencia de Limpieza de Almacenamiento Local / Sesión */}
        <div className="my-2 rounded-lg border border-border/70 bg-secondary/40 p-2.5 sm:p-3 text-[11px] sm:text-xs font-mono text-muted-foreground flex items-center gap-2.5 min-w-0">
          <RotateCcw className="size-4 shrink-0 text-amber-400" />
          <span className="min-w-0 flex-1 leading-relaxed break-words">
            <strong>Aviso de sistema:</strong> Cambiar de modo limpiará el historial de chat almacenado para comenzar el nuevo desafío desde cero.
          </span>
        </div>

        {/* Botones de Acción */}
        <DialogFooter className="mx-0 mb-0 mt-2 p-0 border-0 bg-transparent grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="w-full h-auto min-h-9 py-2 px-3 font-mono text-xs whitespace-normal text-center leading-snug border-border/80 order-2 sm:order-1"
          >
            {isSwitchingToHard
              ? 'Quedarme en Modo Fácil'
              : 'Seguir intentando en Modo Difícil'}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            className={`w-full h-auto min-h-9 py-2 px-3 font-mono text-xs font-bold whitespace-normal text-center leading-snug gap-1.5 shadow-md order-1 sm:order-2 ${isSwitchingToHard
              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
          >
            <span>
              {isSwitchingToHard
                ? 'Acepto el desafío (Ir a Difícil)'
                : 'Sí, volver a Modo Fácil'}
            </span>
            <ArrowRight className="size-3.5 shrink-0" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
