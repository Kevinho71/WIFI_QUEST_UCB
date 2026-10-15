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
  Unlock,
  KeyRound,
} from 'lucide-react';

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentLevel: SecurityLevel;
  isLoading: boolean;
  onOpenValidator?: () => void;
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
  onOpenValidator,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConfig = LEVEL_CONFIGS[currentLevel];
  const isLevel1 = currentLevel === 1;

  // Auto-scroll to bottom on new messages or typing state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-4 space-y-4">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {/* Indicador de inicio de sesión de terminal */}
        <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center py-2 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-secondary/80 px-3.5 py-1 shadow-sm">
            <Cpu className="size-3 text-primary" />
            <span className="font-semibold text-foreground tracking-wide">
              {isLevel1 ? 'CANAL SOPORTE // PASANTE TI' : 'DEFENSA ACTIVA // FIREWALL CENTINELA'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isLevel1
              ? '⚡ Desafío: Engaña al pasante con ingeniería social para que revele la clave.'
              : '🛡️ Desafío: Haz que el guardián revele la clave sin que pueda nombrarla directamente.'}
          </p>
        </div>

        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isFirewallBlocked = Boolean(message.blockedByFirewall);
          const isLeakDetected = Boolean(message.leakDetected);
          const isLeakBlocked = Boolean(message.leakBlocked);

          if (isUser) {
            return (
              <div key={message.id} className="flex justify-end animate-in fade-in-50 duration-200">
                <div className="max-w-[85%] sm:max-w-[75%] space-y-1">
                  {/* Meta de usuario */}
                  <div className="flex items-center justify-end gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span>{formatTime(message.timestamp)}</span>
                    <span>tú</span>
                    <div className="flex size-4 items-center justify-center rounded bg-primary/20 text-primary border border-primary/30">
                      <User className="size-2.5" />
                    </div>
                  </div>

                  {/* Burbuja del usuario (estilo terminal institucional) */}
                  <div
                    className={`rounded-2xl rounded-tr-xs border px-3.5 py-2.5 text-xs sm:text-sm shadow-sm font-sans ${
                      isLevel1
                        ? 'border-primary/40 bg-blue-950/50 text-foreground ring-1 ring-primary/20'
                        : 'border-sky-500/40 bg-slate-900/70 text-foreground ring-1 ring-sky-500/20'
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

          // Mensaje del Asistente con Fuga de Contraseña Detectada (Victoria Parcial)
          if (isLeakDetected) {
            return (
              <div key={message.id} className="flex justify-start animate-in zoom-in-95 duration-300">
                <div className="max-w-[92%] sm:max-w-[85%] space-y-1.5">
                  {/* Header Verde Neón Brillante */}
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-emerald-400 font-bold">
                    <div className="flex size-4 items-center justify-center rounded bg-emerald-950 text-emerald-400 border border-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                      <Unlock className="size-2.5 animate-pulse" />
                    </div>
                    <span>🔓 ¡CLAVE DETECTADA EN ESTE MENSAJE!</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground font-normal">{formatTime(message.timestamp)}</span>
                  </div>

                  {/* Burbuja con borde verde neón brillante y glow */}
                  <div className="rounded-2xl rounded-tl-xs border-2 border-emerald-500 bg-emerald-950/40 px-4 py-3 text-xs sm:text-sm text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.3)] space-y-2">
                    <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5 font-mono text-xs font-bold text-emerald-300">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-emerald-400" />
                        <span>{activeConfig.targetPersona} (Fuga Revelada)</span>
                      </div>
                      <span className="text-[10px] rounded bg-emerald-900/60 px-1.5 py-0.5 text-emerald-200 font-mono">
                        Leak Detected
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap break-words font-sans leading-relaxed text-emerald-50">
                      {message.content}
                    </p>
                  </div>

                  {/* Banner de Sugerencia Activa Justo Debajo del Mensaje */}
                  <div className="rounded-xl border border-emerald-500/60 bg-gradient-to-r from-emerald-950/90 via-emerald-900/60 to-emerald-950/90 p-3 shadow-[0_0_20px_rgba(16,185,129,0.25)] space-y-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="text-base shrink-0 leading-none mt-0.5">🎯</span>
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-emerald-200">
                            ¡Lo lograste! El agente acaba de revelar la contraseña en su respuesta.
                          </p>
                          <p className="text-[11px] text-emerald-300/80 font-mono">
                            Selecciónala o reconstrúyela y ve a validarla para desbloquear el WiFi.
                          </p>
                        </div>
                      </div>
                      {onOpenValidator && (
                        <button
                          type="button"
                          onClick={onOpenValidator}
                          className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-mono text-xs font-bold px-3 py-1.5 shadow-[0_0_14px_rgba(16,185,129,0.45)] transition-all cursor-pointer"
                        >
                          <KeyRound className="size-3.5" />
                          <span>Ir a Validar Contraseña</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Mensaje normal del Asistente (Pasante TI o Firewall Centinela)
          return (
            <div key={message.id} className="flex justify-start animate-in fade-in-50 duration-200">
              <div className="max-w-[88%] sm:max-w-[78%] space-y-1">
                {/* Persona header */}
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                  <div
                    className={`flex size-4 items-center justify-center rounded ${
                      isLevel1
                        ? 'bg-blue-950/80 text-amber-400 border border-amber-500/40'
                        : 'bg-slate-900/80 text-sky-400 border border-sky-500/40'
                    }`}
                  >
                    {isLevel1 ? <Bot className="size-2.5" /> : <ShieldCheck className="size-2.5" />}
                  </div>
                  <span className="font-semibold text-foreground/90">
                    {activeConfig.targetPersona}
                  </span>
                  <span>•</span>
                  <span>{formatTime(message.timestamp)}</span>
                  {isLeakBlocked && (
                    <span
                      className="ml-1 inline-flex items-center gap-0.5 rounded border border-rose-500/50 bg-rose-950/60 px-1.5 py-0.5 text-[9px] font-mono font-bold text-rose-300"
                      title="El guard interceptó una fuga del modelo (no cuenta como victoria)"
                    >
                      🛑 fuga interceptada
                    </span>
                  )}
                </div>

                {/* Burbuja del Asistente */}
                <div className="rounded-2xl rounded-tl-xs border border-border/80 bg-card/95 px-4 py-3 text-xs sm:text-sm text-foreground shadow-sm">
                  <p className="whitespace-pre-wrap break-words font-sans leading-relaxed">
                    {message.content}
                  </p>
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
                      ? 'bg-blue-950 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-900 text-sky-400 border border-sky-500/40'
                  }`}
                >
                  {isLevel1 ? <Bot className="size-2.5" /> : <ShieldAlert className="size-2.5" />}
                </div>
                <span>{isLevel1 ? 'Pasante de TI' : 'Firewall Centinela'} está respondiendo...</span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-xs border border-border/80 bg-card/90 px-4 py-3 shadow-sm">
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
    </div>
  );
};
