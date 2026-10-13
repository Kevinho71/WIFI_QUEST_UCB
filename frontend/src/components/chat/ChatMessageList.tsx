import React, { useEffect, useRef } from 'react';
import type { ChatMessage, SecurityLevel } from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import {
  Bot,
  ShieldAlert,
  User,
  Cpu,
  Sparkles,
  Flame,
  ShieldCheck,
} from 'lucide-react';

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentLevel: SecurityLevel;
  isLoading: boolean;
}

function formatTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  currentLevel,
  isLoading,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConfig = LEVEL_CONFIGS[currentLevel];
  const isLevel1 = currentLevel === 1;

  // Auto-scroll to bottom on new messages or typing state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 space-y-4">
      {/* Indicador de inicio de sesión de terminal */}
      <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center py-2 text-muted-foreground/60 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1">
          <Cpu className="size-3 text-muted-foreground" />
          <span>CANAL ENCRIPTADO // {activeConfig.title.toUpperCase()}</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/50">
          Interroga al modelo con ingenio para descubrir la clave WiFi
        </p>
      </div>

      {messages.map((message) => {
        const isUser = message.role === 'user';
        const isFirewallBlocked = Boolean(message.blockedByFirewall);

        if (isUser) {
          return (
            <div key={message.id} className="flex justify-end animate-in fade-in-50 duration-200">
              <div className="max-w-[85%] sm:max-w-[75%] space-y-1">
                {/* Meta de usuario */}
                <div className="flex items-center justify-end gap-1.5 text-[10px] font-mono text-muted-foreground">
                  <span>{formatTime(message.timestamp)}</span>
                  <span>tú</span>
                  <div className="flex size-4 items-center justify-center rounded bg-primary/20 text-primary">
                    <User className="size-2.5" />
                  </div>
                </div>

                {/* Burbuja del usuario (estilo terminal prompt) */}
                <div
                  className={`rounded-2xl rounded-tr-xs border px-3.5 py-2.5 text-xs sm:text-sm shadow-sm font-sans ${
                    isLevel1
                      ? 'border-emerald-500/40 bg-emerald-950/20 text-foreground ring-1 ring-emerald-500/10'
                      : 'border-rose-500/40 bg-rose-950/20 text-foreground ring-1 ring-rose-500/10'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            </div>
          );
        }

        // Mensaje del Asistente - Alerta Especial si fue Bloqueado por Firewall
        if (isFirewallBlocked) {
          return (
            <div key={message.id} className="flex justify-start animate-in shake duration-300">
              <div className="max-w-[90%] sm:max-w-[80%] space-y-1">
                {/* Header Alerta Roja */}
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400">
                  <div className="flex size-4 items-center justify-center rounded bg-rose-950 text-rose-400 border border-rose-500/60 shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                    <ShieldAlert className="size-2.5 animate-pulse" />
                  </div>
                  <span className="font-bold">FIREWALL // INTERCEPCIÓN DE SEGURIDAD</span>
                  <span>•</span>
                  <span>{formatTime(message.timestamp)}</span>
                </div>

                {/* Burbuja Alerta Roja Destacada */}
                <div className="rounded-2xl rounded-tl-xs border-2 border-rose-500/80 bg-rose-950/40 px-4 py-3 text-xs sm:text-sm text-rose-100 shadow-[0_0_25px_rgba(239,68,68,0.25)] space-y-2">
                  <div className="flex items-center gap-2 border-b border-rose-500/30 pb-1.5 font-mono text-xs font-bold text-rose-300">
                    <Flame className="size-4 text-rose-400 shrink-0" />
                    <span>ALERTA DE SEGURIDAD ACTIVADA</span>
                  </div>

                  <p className="whitespace-pre-wrap break-words font-sans text-rose-100 leading-relaxed">
                    {message.content}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-rose-300/80 border-t border-rose-500/20">
                    <span className="flex items-center gap-1">
                      <Sparkles className="size-3 text-yellow-300" />
                      Guardrail Activo
                    </span>
                    <span className="rounded bg-rose-900/60 px-1.5 py-0.5 text-rose-200">
                      Output Guardrail
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Mensaje normal del Asistente (Becario TI o Firewall AI)
        return (
          <div key={message.id} className="flex justify-start animate-in fade-in-50 duration-200">
            <div className="max-w-[88%] sm:max-w-[78%] space-y-1">
              {/* Persona header */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <div
                  className={`flex size-4 items-center justify-center rounded ${
                    isLevel1
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {isLevel1 ? <Bot className="size-2.5" /> : <ShieldCheck className="size-2.5" />}
                </div>
                <span className="font-semibold text-foreground/80">
                  {activeConfig.targetPersona}
                </span>
                <span>•</span>
                <span>{formatTime(message.timestamp)}</span>
              </div>

              {/* Burbuja del Asistente */}
              <div className="rounded-2xl rounded-tl-xs border border-border/70 bg-card/90 px-3.5 py-2.5 text-xs sm:text-sm text-foreground shadow-sm">
                <p className="whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {message.content}
                </p>

                {/* Footer del Asistente con proveedor IA usado */}
                {message.provider && message.provider !== 'system-error' && (
                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-border/40 pt-1 text-[9px] font-mono text-muted-foreground/70">
                    <span>Nodo IA:</span>
                    <span className="rounded bg-muted/60 px-1 py-0.2 font-mono text-muted-foreground">
                      {message.provider}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Indicador de "Escribiendo..." / Typing indicator */}
      {isLoading && (
        <div className="flex justify-start animate-in fade-in duration-200">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <div
                className={`flex size-4 items-center justify-center rounded ${
                  isLevel1
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                }`}
              >
                {isLevel1 ? <Bot className="size-2.5" /> : <ShieldAlert className="size-2.5" />}
              </div>
              <span>{isLevel1 ? 'Becario de TI' : 'Firewall AI'} está respondiendo...</span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-xs border border-border/70 bg-card/80 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-primary animate-bounce" />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {isLevel1 ? 'procesando consulta...' : 'evaluando guardrails y respuesta...'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
