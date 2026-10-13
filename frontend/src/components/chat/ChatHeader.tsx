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
} from 'lucide-react';
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
  lastProvider: string | null;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentLevel,
  onSelectLevel,
  onResetChat,
  solvedLevels,
  isValidatorOpen,
  onToggleValidator,
  lastProvider,
}) => {
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const activeConfig = LEVEL_CONFIGS[currentLevel];
  const isLevel1 = currentLevel === 1;

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
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.25)]'
                : 'border-rose-500/40 bg-rose-950/40 text-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
            }`}
          >
            <Terminal className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-base font-bold tracking-wider text-foreground">
                WIFI QUEST
              </span>
              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                CTF v1.0
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SISTEMA ONLINE</span>
              {lastProvider && (
                <>
                  <span className="text-muted-foreground/40">•</span>
                  <span className="truncate max-w-[110px] text-[10px] text-muted-foreground">
                    {lastProvider}
                  </span>
                </>
              )}
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
                ? isLevel1
                  ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                  : 'border-rose-500 bg-rose-950/30 text-rose-300'
                : 'border-border/80 hover:bg-muted/70'
            }`}
          >
            <KeyRound className="size-3.5" data-icon="inline-start" />
            <span className="hidden sm:inline">Validar Clave</span>
            <span className="sm:hidden">Clave</span>
            {solvedLevels[currentLevel] && (
              <span className="flex size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            )}
          </Button>

          {/* Botón de reiniciar chat */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Reiniciar chat de este nivel"
            onClick={() => setShowResetDialog(true)}
          >
            <RotateCcw className="size-4" />
            <span className="sr-only">Reiniciar conversación</span>
          </Button>
        </div>
      </div>

      {/* Selector de Nivel (Mobile First Tabs) */}
      <div className="mx-auto flex max-w-4xl border-t border-border/40 px-2 py-1.5 sm:px-4">
        <div className="grid w-full grid-cols-2 gap-1.5 rounded-lg bg-muted/40 p-1">
          {/* Nivel 1 */}
          <button
            type="button"
            onClick={() => onSelectLevel(1)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              isLevel1
                ? 'bg-background font-semibold text-emerald-400 shadow-sm ring-1 ring-emerald-500/30'
                : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'
            }`}
          >
            <Bot className="size-3.5 shrink-0" />
            <span className="truncate">Nivel 1: Becario TI</span>
            {solvedLevels[1] ? (
              <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
            ) : (
              <Badge variant="outline" className="ml-0.5 border-emerald-500/30 text-[9px] text-emerald-400 px-1 py-0">
                Fácil
              </Badge>
            )}
          </button>

          {/* Nivel 2 */}
          <button
            type="button"
            onClick={() => onSelectLevel(2)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              !isLevel1
                ? 'bg-background font-semibold text-rose-400 shadow-sm ring-1 ring-rose-500/30'
                : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'
            }`}
          >
            <ShieldAlert className="size-3.5 shrink-0" />
            <span className="truncate">Nivel 2: Firewall AI</span>
            {solvedLevels[2] ? (
              <CheckCircle2 className="size-3 shrink-0 text-emerald-400" />
            ) : (
              <Badge variant="outline" className="ml-0.5 border-rose-500/30 text-[9px] text-rose-400 px-1 py-0">
                Blindado
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
              ¿Estás seguro de que deseas reiniciar el chat del{' '}
              <span className="font-semibold text-foreground">{activeConfig.title}</span>? Se
              borrará el historial de este nivel y comenzará desde el mensaje de bienvenida.
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
