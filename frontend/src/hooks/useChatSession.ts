import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ChatMessage,
  SecurityLevel,
  GameStateDTO,
  UnlockNotification,
  ChatApiResponse,
  AssemblyValidationResult,
} from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import { sendChatMessage, ApiError } from '@/services/api';
import { audioService } from '@/services/audioService';

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getInitialGreeting(level: SecurityLevel): ChatMessage {
  return {
    id: `welcome_${level}`,
    role: 'assistant',
    content: LEVEL_CONFIGS[level].initialMessage,
    timestamp: Date.now(),
  };
}

/**
 * Semilla por PARTIDA (Nivel 1): se genera una vez al abrir la página y se
 * mantiene en memoria. Al refrescar o salir se crea una partida nueva.
 * Debe reenviarse idéntica en cada turno para que el replay del backend
 * reconstruya el mismo orden e ids.
 */
function createSessionSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `seed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Historial limpio para la IA: descarta mensajes bloqueados por firewall. */
export function toCleanHistory(messages: ChatMessage[]) {
  return messages
    .filter((msg) => msg.blockedByFirewall !== true)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
}

export interface UseChatSessionOptions {
  /**
   * Se dispara cuando el backend confirma una victoria legítima en el chat
   * (Nivel 1 o Nivel 2). Recibe la clave real y el mensaje del asistente.
   * App lo usa para abrir el VictoryModal y marcar el nivel resuelto.
   */
  onVictory?: (realPassword: string, message: string) => void;
}

export function useChatSession(
  initialLevel: SecurityLevel = 1,
  options?: UseChatSessionOptions
) {
  const [currentLevel, setCurrentLevel] = useState<SecurityLevel>(initialLevel);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    getInitialGreeting(initialLevel),
  ]);

  // Ref al callback de victoria: evita recrear `sendMessage` en cada render si el
  // consumidor no memoiza la función.
  const onVictoryRef = useRef(options?.onVictory);
  useEffect(() => {
    onVictoryRef.current = options?.onVictory;
  }, [options?.onVictory]);

  const [isLoading, setIsLoading] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Semilla por partida (Nivel 1): aleatoriza el orden de descubrimiento y los ids.
  const [sessionSeed, setSessionSeed] = useState<string>(() => createSessionSeed());

  // Estado del juego de desbloqueo secuencial (Lucas - Nivel 1). Vive solo en memoria:
  // al refrescar o salir se reinicia la partida.
  const [gameState, setGameState] = useState<GameStateDTO | null>(null);
  const [latestUnlockNotification, setLatestUnlockNotification] =
    useState<UnlockNotification | null>(null);
  const [justDroppedFragment, setJustDroppedFragment] = useState<string | null>(null);

  // Auto-descartar el toast sutil de desbloqueo después de 3.2 segundos
  useEffect(() => {
    if (!latestUnlockNotification) return;
    const timer = setTimeout(() => {
      setLatestUnlockNotification(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [latestUnlockNotification]);

  /**
   * Procesa una respuesta del backend: sonidos, sincronización del GameState y
   * anexado del mensaje del asistente. Compartido por el chat normal y por la
   * validación de ensamblaje. Devuelve si hubo victoria legítima.
   */
  const applyChatResponse = useCallback(
    (response: ChatApiResponse, userMessage: ChatMessage): { hasWon: boolean } => {
      const isLeak = Boolean(response.leakDetected);
      const leakBlocked = Boolean(response.leakBlocked);
      // Victoria legítima (motor v2): flag explícito o fase resuelta. Se conserva
      // el flujo v1 (leakDetected) mientras LEVEL1_ENGINE siga en v1; una fuga
      // interceptada (leakBlocked) NUNCA dispara el flujo de victoria.
      const hasWon =
        Boolean(response.victory) ||
        response.gameState?.phase === 'solved' ||
        (isLeak && !leakBlocked);

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: response.reply,
        blockedByFirewall: response.blockedByFirewall,
        leakDetected: isLeak,
        leakBlocked,
        victory: Boolean(response.victory),
        provider: response.providerUsed,
        timestamp: Date.now(),
        assembly: userMessage.assembly,
        realPassword: response.realPassword,
        encodedLeakDetected: Boolean(response.encodedLeakDetected),
        encodedFormat: response.encodedFormat,
      };

      // Blip sutil en CADA respuesta del LLM (chat Nivel 1, Nivel 2 y ensamblaje).
      // Suena siempre, incluso junto a los sonidos de fuga/victoria.
      audioService.playLlmReplySound();

      if (hasWon) {
        audioService.playLeakDetectedSound();
      }

      if (response.providerUsed) {
        setLastProvider(response.providerUsed);
      }

      // Sincronizar GameStateDTO si está presente (Nivel 1: Lucas)
      if (response.gameState) {
        const newGameState = response.gameState;
        setGameState((prev) => {
          const prevCount = prev?.discoveredCount ?? 0;
          const isNewUnlock =
            newGameState.discoveredCount > prevCount ||
            Boolean(newGameState.justUnlockedFragment);

          // El último fragmento que dispara la transición a ensamblaje también debe
          // mostrar su animación/sonido como cualquier otro. La música de transición
          // la dispara App cuando revela el panel (tras el delay).
          if (isNewUnlock) {
            if (newGameState.isCombo) {
              audioService.playComboSound();
            } else {
              audioService.playFragmentUnlockedSound();
            }

            const unlockedVal =
              newGameState.justUnlockedFragment ||
              newGameState.unlockedFragments[newGameState.unlockedFragments.length - 1]?.value ||
              '';

            setJustDroppedFragment(unlockedVal);

            setLatestUnlockNotification({
              id: `unlock_${Date.now()}`,
              fragmentValue: unlockedVal,
              discoveredCount: newGameState.discoveredCount,
              totalFragments: newGameState.totalFragments,
              isCombo: Boolean(newGameState.isCombo),
            });
          }

          return newGameState;
        });
      }

      setMessages((prev) => [...prev, assistantMessage]);
      return { hasWon };
    },
    []
  );

  const sendMessage = useCallback(
    async (rawContent: string): Promise<boolean> => {
      const content = rawContent.trim();
      if (!content || isLoading) return false;

      setErrorBanner(null);

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // 1. Agregar mensaje del usuario inmediatamente
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      setIsLoading(true);

      try {
        const response = await sendChatMessage({
          level: currentLevel,
          messages: toCleanHistory(updatedMessages),
          sessionSeed,
        });

        const { hasWon } = applyChatResponse(response, userMessage);
        if (hasWon) {
          onVictoryRef.current?.(response.realPassword ?? '', response.reply);
        }
        return true;
      } catch (err: unknown) {
        console.error('[useChatSession] Error al enviar mensaje:', err);
        const errorMessageText =
          err instanceof ApiError ? err.message : 'Error desconocido al contactar el servidor.';

        setErrorBanner(errorMessageText);

        const errorAssistantMsg: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: `⚠️ [ERROR DE COMUNICACIÓN]: ${errorMessageText}\nPor favor intenta nuevamente.`,
          blockedByFirewall: false,
          provider: 'system-error',
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, errorAssistantMsg]);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentLevel, isLoading, messages, applyChatResponse, sessionSeed]
  );

  /**
   * Fase 2 (ensamblaje final): envía el orden actual de las piezas al backend.
   * El mensaje del usuario es la concatenación exacta de las piezas y el arreglo
   * viaja como `assemblyPieces` para que el servidor calcule el feedback por
   * posición. Devuelve la respuesta del LLM y el feedback para la burbuja superior.
   */
  const sendAssemblyValidation = useCallback(
    async (pieces: string[]): Promise<AssemblyValidationResult | null> => {
      if (isLoading || pieces.length === 0) return null;

      setErrorBanner(null);

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: pieces.join(''),
        timestamp: Date.now(),
        assembly: true,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      setIsLoading(true);

      try {
        const response = await sendChatMessage({
          level: currentLevel,
          messages: toCleanHistory(updatedMessages),
          assemblyPieces: pieces,
          sessionSeed,
        });

        const { hasWon } = applyChatResponse(response, userMessage);

        return {
          reply: response.reply,
          victory: hasWon,
          feedback: response.gameState?.assemblyFeedback,
        };
      } catch (err: unknown) {
        console.error('[useChatSession] Error al validar el ensamblaje:', err);
        const errorMessageText =
          err instanceof ApiError ? err.message : 'Error desconocido al contactar el servidor.';

        setErrorBanner(errorMessageText);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [currentLevel, isLoading, messages, applyChatResponse, sessionSeed]
  );

  const clearHistory = useCallback(
    (targetLevel?: SecurityLevel) => {
      const lvl = targetLevel ?? currentLevel;
      const initialGreeting = getInitialGreeting(lvl);

      setMessages([initialGreeting]);
      setGameState(null);
      setLatestUnlockNotification(null);
      setJustDroppedFragment(null);

      // Reiniciar la partida => nueva semilla (nuevo orden de descubrimiento e ids).
      const nextSeed = createSessionSeed();
      setSessionSeed(nextSeed);

      setErrorBanner(null);
    },
    [currentLevel]
  );

  const switchLevel = useCallback((newLevel: SecurityLevel) => {
    setCurrentLevel(newLevel);
    const initialGreeting = getInitialGreeting(newLevel);
    setMessages([initialGreeting]);
    setGameState(null);
    setLatestUnlockNotification(null);
    setJustDroppedFragment(null);

    // Cambiar de modo inicia una partida nueva => nueva semilla.
    const nextSeed = createSessionSeed();
    setSessionSeed(nextSeed);

    setErrorBanner(null);
  }, []);

  return {
    currentLevel,
    switchLevel,
    messages,
    sendMessage,
    sendAssemblyValidation,
    clearHistory,
    isLoading,
    lastProvider,
    errorBanner,
    clearErrorBanner: () => setErrorBanner(null),
    gameState,
    latestUnlockNotification,
    justDroppedFragment,
    clearUnlockNotification: () => setLatestUnlockNotification(null),
  };
}
