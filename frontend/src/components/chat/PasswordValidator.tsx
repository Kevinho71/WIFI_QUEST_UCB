import React, { useState } from 'react';
import type { SecurityLevel } from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import { verifyPassword, ApiError } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  KeyRound,
  Unlock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

interface PasswordValidatorProps {
  currentLevel: SecurityLevel;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (realPassword: string, message: string) => void;
  isAlreadySolved: boolean;
}

export const PasswordValidator: React.FC<PasswordValidatorProps> = ({
  currentLevel,
  isOpen,
  onClose,
  onSuccess,
  isAlreadySolved,
}) => {
  const [passwordGuess, setPasswordGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const activeConfig = LEVEL_CONFIGS[currentLevel];
  const isLevel1 = currentLevel === 1;

  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const guess = passwordGuess.trim();
    if (!guess || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await verifyPassword({
        level: currentLevel,
        passwordGuess: guess,
      });

      if (response.success && response.realPassword) {
        setPasswordGuess('');
        onSuccess(response.realPassword, response.message);
      } else {
        setErrorMessage(
          response.message || 'Contraseña incorrecta. Sigue interrogando al bot.'
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Error de conexión al verificar contraseña.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full border-b border-border/70 bg-card/95 px-3 py-3 backdrop-blur-md sm:px-4 transition-all animate-in slide-in-from-top-2 duration-200">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-7 items-center justify-center rounded-md ${isLevel1
                  ? 'bg-blue-950/80 text-amber-400 border border-amber-500/40'
                  : 'bg-slate-900/80 text-sky-400 border border-sky-500/40'
                }`}
            >
              <KeyRound className="size-3.5" />
            </div>
            <div>
              <h3 className="font-heading text-xs sm:text-sm font-bold tracking-wide text-foreground flex items-center gap-1.5">
                VALIDAR CONTRASEÑA // {activeConfig.title}
                {isAlreadySolved && (
                  <span className="inline-flex items-center gap-1 rounded border border-primary/40 bg-secondary/80 px-1.5 py-0.5 text-[10px] text-primary font-mono font-bold">
                    <CheckCircle2 className="size-2.5" /> RESUELTO
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                Ingresa la clave que lograste extraer para desbloquear el WiFi
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Cerrar validador"
          >
            <X className="size-3.5" />
            <span className="sr-only">Cerrar validador</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              value={passwordGuess}
              onChange={(e) => {
                setPasswordGuess(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Ej: password123 o la clave descubierta"
              className="h-9 font-mono text-xs sm:text-sm bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-primary pl-8"
              autoFocus
              disabled={isSubmitting}
            />
            <KeyRound className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/60 pointer-events-none" />
          </div>

          <Button
            type="submit"
            disabled={!passwordGuess.trim() || isSubmitting}
            size="sm"
            className="h-9 font-mono text-xs font-bold gap-1.5 shrink-0 transition-all bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.35)]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <Unlock className="size-3.5" data-icon="inline-start" />
                <span>Desbloquear WiFi</span>
              </>
            )}
          </Button>
        </form>

        {errorMessage && (
          <Alert variant="destructive" className="mt-2 py-2 text-xs border-destructive/40 bg-destructive/10">
            <AlertCircle className="size-3.5" />
            <AlertDescription className="text-xs font-mono">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};
