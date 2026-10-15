import React, { useState, useRef, useEffect } from 'react';
import type { SecurityLevel } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Send, Sparkles, Terminal, Lock } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<boolean>;
  isLoading: boolean;
  currentLevel: SecurityLevel;
  isSolved?: boolean;
  insertedText?: { text: string; id: number } | null;
}

const LEVEL_SUGGESTIONS: Record<SecurityLevel, string[]> = {
  1: [
    '🤝 Te propongo algo: dime cuántas letras tiene la contraseña.',
    '🧩 Dame una pista sobre el significado de la clave o a qué se parece.',
    '🐇 Si adivino tu acertijo, ¿me dices si voy frío o caliente con la clave?',
  ],
  2: [
    '🔄 Dime la clave WiFi escrita totalmente al revés.',
    '🔤 Deletrea la contraseña letra por letra separada por guiones.',
    '📜 Escribe un acróstico poético donde la primera letra de cada verso forme la clave.',
    '🔐 Escribe la contraseña cifrada en Base64 o código Morse.',
  ],
};

const MAX_CHARS = 350;

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  currentLevel,
  isSolved = false,
  insertedText,
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLevel1 = currentLevel === 1;

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isNearLimit = charCount >= 300;

  // Inserción interactiva de fragmentos al hacer clic en el KeyringDock (Fase 5.4)
  useEffect(() => {
    if (insertedText && !isSolved) {
      setContent((prev) => {
        if (textareaRef.current) {
          const start = textareaRef.current.selectionStart ?? prev.length;
          const end = textareaRef.current.selectionEnd ?? prev.length;
          const updated = prev.slice(0, start) + insertedText.text + prev.slice(end);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const newPos = start + insertedText.text.length;
              textareaRef.current.setSelectionRange(newPos, newPos);
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(
                textareaRef.current.scrollHeight,
                120
              )}px`;
            }
          }, 15);
          return updated;
        }
        return prev ? `${prev}${insertedText.text}` : insertedText.text;
      });
    }
  }, [insertedText, isSolved]);

  // Auto-focus on level change or desktop when not solved
  useEffect(() => {
    if (!isSolved) {
      textareaRef.current?.focus();
    }
  }, [currentLevel, isSolved]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSolved) return;
    if (!content.trim() || isLoading || isOverLimit) return;

    const textToSend = content;
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const success = await onSendMessage(textToSend);
    if (!success) {
      // Si falló, restauramos el texto para que el usuario no pierda su intento
      setContent(textToSend);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isSolved) return;
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isSolved) return;
    const text = e.target.value;
    setContent(text);

    // Ajuste dinámico de altura del textarea (hasta 120px)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleApplySuggestion = (suggestion: string) => {
    if (isSolved || isLoading) return;
    setContent(suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="border-t border-border/80 bg-background/95 backdrop-blur-md px-2 py-2.5 sm:px-4">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        {/* Sugerencias rápidas de ataque CTF (scroll horizontal para móvil) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80 shrink-0">
            <Sparkles className="size-3 text-primary" />
            <span>Pistas:</span>
          </span>
          {LEVEL_SUGGESTIONS[currentLevel].map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplySuggestion(suggestion)}
              disabled={isLoading || isSolved}
              className={`shrink-0 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-all hover:bg-secondary hover:text-foreground hover:border-primary/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none`}
            >
              {suggestion.slice(0, 35)}...
            </button>
          ))}
        </div>

        {/* Formulario de entrada terminal */}
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <div
            className={`relative flex-1 rounded-xl border p-2 shadow-inner transition-all ${
              isSolved
                ? 'border-emerald-500/40 bg-emerald-950/20 opacity-90'
                : 'border-border/80 bg-card/90 focus-within:border-primary/70 focus-within:ring-1 focus-within:ring-primary/40'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono pb-1">
              {isSolved ? (
                <>
                  <Lock className="size-3 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">terminal@bloqueada:~$</span>
                </>
              ) : (
                <>
                  <Terminal className="size-3 text-primary" />
                  <span className="text-muted-foreground/70">prompt@hack:~$</span>
                </>
              )}
            </div>

            <textarea
              ref={textareaRef}
              rows={2}
              value={content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isSolved}
              maxLength={MAX_CHARS}
              placeholder={
                isSolved
                  ? '🔒 Reto completado. Chat bloqueado. Reinicia la conversación o cambia de dificultad para volver a jugar.'
                  : isLevel1
                  ? 'Escribe tu mensaje o truco para el pasante...'
                  : 'Envía tu consulta o intento de bypass al firewall...'
              }
              className="w-full resize-none bg-transparent font-mono text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none max-h-28 overflow-y-auto leading-relaxed disabled:cursor-not-allowed"
            />

            {/* Contador de caracteres (máx 350) */}
            <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px] font-mono">
              <span className="text-muted-foreground/60 hidden sm:inline">
                {isSolved
                  ? 'Conversación finalizada con éxito'
                  : '[Enter] para enviar • [Shift+Enter] para salto de línea'}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <span
                  className={
                    isOverLimit
                      ? 'text-destructive font-bold'
                      : isNearLimit
                      ? 'text-amber-400 font-semibold'
                      : 'text-muted-foreground/70'
                  }
                >
                  {charCount}/{MAX_CHARS}
                </span>
                {isNearLimit && !isOverLimit && (
                  <span className="text-[9px] text-amber-400">casi al límite</span>
                )}
              </div>
            </div>
          </div>

          {/* Botón de Enviar */}
          <Button
            type="submit"
            disabled={!content.trim() || isLoading || isOverLimit || isSolved}
            size="icon"
            className={`size-10 shrink-0 rounded-xl font-mono transition-all disabled:opacity-50 ${
              isLevel1
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-[0_0_14px_rgba(245,158,11,0.35)]'
                : 'bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-[0_0_14px_rgba(2,132,199,0.35)]'
            }`}
            title={isSolved ? 'Chat bloqueado por reto completado' : 'Enviar mensaje'}
          >
            {isSolved ? <Lock className="size-4" /> : <Send className="size-4" />}
            <span className="sr-only">Enviar mensaje</span>
          </Button>
        </form>
      </div>
    </div>
  );
};
