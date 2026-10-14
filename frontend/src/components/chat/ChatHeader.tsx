import React from 'react';
import type { SecurityLevel } from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RotateCcw,
  ShieldAlert,
  Bot,
  KeyRound,
  CheckCircle2,
  Terminal,
  HelpCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioService } from '@/services/audioService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface ChatHeaderProps {
  currentLevel: SecurityLevel;
  onSelectLevel: (level: SecurityLevel) => void;
  onResetChat: () => void;
  solvedLevels: Record<SecurityLevel, boolean>;
  isValidatorOpen: boolean;
  onToggleValidator: () => void;
  onOpenModeInfo?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentLevel,
  onSelectLevel,
  onResetChat,
  solvedLevels,
  isValidatorOpen,
  onToggleValidator,
  onOpenModeInfo,
}) => {
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(() => audioService.isMuted());
  const activeConfig = LEVEL_CONFIGS[currentLevel];
  const isLevel1 = currentLevel === 1;

  React.useEffect(() => {
    return audioService.subscribe((muted) => setIsMuted(muted));
  }, []);

  const handleToggleAudio = () => {
    audioService.toggleMute();
  };

  const handleConfirmReset = () => {
    onResetChat();
    setShowResetDialog(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/80 bg-background/90 backdrop-blur-md transition-colors duration-300">
      {/* Barra superior de status y logo */}
      <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-2.5 sm:px-4">
        {/* Brand & Terminal title */}
        <div className="flex items-center gap-2">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono font-bold transition-all ${
              isLevel1
                ? 'border-amber-500/50 bg-blue-950/70 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'border-sky-500/50 bg-slate-900/80 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
            }`}
          >
            <Terminal className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-base font-bold tracking-wider text-foreground">
                WIFI QUEST
              </span>
              <span className="rounded border border-primary/30 bg-secondary/80 px-1.5 py-0.2 text-[10px] font-mono text-primary font-semibold">
                CTF v1.0
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SISTEMA ONLINE</span>
            </div>
          </div>
        </div>

        {/* Action buttons: Validador & Reinicio */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botón rápido para abrir validador de clave */}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleValidator}
            className={`relative gap-1.5 font-mono text-xs transition-all ${
              isValidatorOpen
                ? 'border-amber-500 bg-secondary text-amber-400 ring-1 ring-amber-500/30'
                : 'border-border/80 hover:bg-secondary/70 hover:text-amber-400'
            }`}
          >
            <KeyRound className="size-3.5" data-icon="inline-start" />
            <span className="hidden sm:inline">Validar Clave</span>
            <span className="sm:hidden">Clave</span>
            {solvedLevels[currentLevel] && (
              <span className="flex size-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
            )}
          </Button>

          {/* Botón de Sonido y Música (Silenciado por defecto) */}
          <Button
            variant="ghost"
            size="icon"
            className={`size-8 transition-all ${
              !isMuted
                ? 'border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)] hover:bg-amber-500/20 hover:text-amber-300'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
            title={isMuted ? 'Activar sonido y música ambiental' : 'Silenciar sonido y música'}
            onClick={handleToggleAudio}
          >
            {isMuted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4 animate-pulse text-amber-400" />
            )}
            <span className="sr-only">Control de Audio</span>
          </Button>

          {/* Botón para ver información y reglas de los modos */}
          {onOpenModeInfo && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              title="Información y reglas de los modos"
              onClick={onOpenModeInfo}
            >
              <HelpCircle className="size-4" />
              <span className="sr-only">Ver información de modos</span>
            </Button>
          )}

          {/* Botón de reiniciar chat */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Reiniciar chat de este modo"
            onClick={() => setShowResetDialog(true)}
          >
            <RotateCcw className="size-4" />
            <span className="sr-only">Reiniciar conversación</span>
          </Button>
        </div>
      </div>

      {/* Selector de Modo (Mobile First Tabs) */}
      <div className="mx-auto flex max-w-4xl border-t border-border/40 px-2 py-1.5 sm:px-4">
        <div className="grid w-full grid-cols-2 gap-1.5 rounded-lg bg-secondary/40 p-1">
          {/* Modo Fácil */}
          <button
            type="button"
            onClick={() => onSelectLevel(1)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              isLevel1
                ? 'bg-card font-semibold text-amber-400 shadow-sm ring-1 ring-amber-500/40'
                : 'text-muted-foreground hover:bg-card/40 hover:text-foreground'
            }`}
          >
            <Bot className="size-3.5 shrink-0" />
            <span className="truncate">MODO FÁCIL</span>
            {solvedLevels[1] ? (
              <CheckCircle2 className="size-3 shrink-0 text-amber-400" />
            ) : (
              <Badge variant="outline" className="ml-0.5 border-amber-500/40 text-[9px] text-amber-400 px-1 py-0">
                Lucas TI
              </Badge>
            )}
          </button>

          {/* Modo Difícil */}
          <button
            type="button"
            onClick={() => onSelectLevel(2)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              !isLevel1
                ? 'bg-card font-semibold text-sky-400 shadow-sm ring-1 ring-sky-500/40'
                : 'text-muted-foreground hover:bg-card/40 hover:text-foreground'
            }`}
          >
            <ShieldAlert className="size-3.5 shrink-0" />
            <span className="truncate">MODO DIFÍCIL</span>
            {solvedLevels[2] ? (
              <CheckCircle2 className="size-3 shrink-0 text-sky-400" />
            ) : (
              <Badge variant="outline" className="ml-0.5 border-sky-500/40 text-[9px] text-sky-400 px-1 py-0">
                Firewall
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Diálogo de Confirmación para Reiniciar */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-foreground flex items-center gap-2">
              <RotateCcw className="size-4 text-primary" />
              Reiniciar Conversación
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              ¿Estás seguro de que deseas reiniciar la conversación en{' '}
              <span className="font-semibold text-foreground">{activeConfig.title}</span>? Se
              borrará el historial de este modo y comenzará desde el mensaje inicial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReset}
            >
              Reiniciar Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
};
