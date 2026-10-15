import { useState, useEffect, useCallback } from 'react';
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
import { clearAssemblyTimerStorage } from '@/lib/assemblyTimer';

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

function getSavedLevel(defaultLevel: SecurityLevel = 1): SecurityLevel {
  if (typeof window === 'undefined') return defaultLevel;
  try {
    const val = localStorage.getItem('wifi_quest_level');
    if (val === '2') return 2;
    if (val === '1') return 1;
  } catch (err) {
    console.warn('[useChatSession] Error reading wifi_quest_level:', err);
  }
  return defaultLevel;
}

function loadMessagesFromStorage(level: SecurityLevel): ChatMessage[] {
  if (typeof window === 'undefined') return [getInitialGreeting(level)];

  try {
    // 1. Clave principal requerida por Fase 2: wifi_quest_messages
    const raw = localStorage.getItem('wifi_quest_messages');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // 2. Fallback de compatibilidad con claves anteriores
    const legacyRaw =
      sessionStorage.getItem(`wifi_quest_chat_lvl_${level}`) ||
      localStorage.getItem(`wifi_quest_chat_lvl_${level}`);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[useChatSession] Error parsing storage for level ${level}:`, err);
  }
  return [getInitialGreeting(level)];
}

function saveMessagesToStorage(messages: ChatMessage[], level: SecurityLevel): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(messages);
    localStorage.setItem('wifi_quest_messages', serialized);
    localStorage.setItem('wifi_quest_level', String(level));
    // Sincronización secundaria para compatibilidad
    sessionStorage.setItem(`wifi_quest_chat_lvl_${level}`, serialized);
  } catch (err) {
    console.warn(`[useChatSession] Error saving storage for level ${level}:`, err);
  }
}

function loadGameStateFromStorage(level: SecurityLevel): GameStateDTO | null {
  if (typeof window === 'undefined' || level !== 1) return null;
  try {
    const raw = localStorage.getItem('wifi_quest_game_state_lvl_1');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[useChatSession] Error parsing game state from storage:', err);
  }
  return null;
}

/** Historial limpio para la IA: descarta mensajes bloqueados por firewall. */
function toCleanHistory(messages: ChatMessage[]) {
  return messages
    .filter((msg) => msg.blockedByFirewall !== true)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
}

export function useChatSession(initialLevel: SecurityLevel = 1) {
  const [currentLevel, setCurrentLevel] = useState<SecurityLevel>(() => getSavedLevel(initialLevel));
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessagesFromStorage(getSavedLevel(initialLevel))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Estado del juego de desbloqueo secuencial (Lucas - Nivel 1)
  const [gameState, setGameState] = useState<GameStateDTO | null>(() =>
    loadGameStateFromStorage(getSavedLevel(initialLevel))
  );
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

  // Guardar en localStorage siempre que cambien los mensajes o el nivel
  useEffect(() => {
    saveMessagesToStorage(messages, currentLevel);
  }, [messages, currentLevel]);

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
          const prevPhase = prev?.phase;
          const isTransitionToAssembly =
            prevPhase !== 'assembly' && newGameState.phase === 'assembly';
          const isNewUnlock =
            newGameState.discoveredCount > prevCount ||
            Boolean(newGameState.justUnlockedFragment);

          if (isTransitionToAssembly) {
            audioService.playAssemblyPhaseSound();
          } else if (isNewUnlock) {
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

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                'wifi_quest_game_state_lvl_1',
                JSON.stringify(newGameState)
              );
            } catch (storageErr) {
              console.warn('[useChatSession] Error saving game state:', storageErr);
            }
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
        });

        applyChatResponse(response, userMessage);
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
    [currentLevel, isLoading, messages, applyChatResponse]
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
    [currentLevel, isLoading, messages, applyChatResponse]
  );

  const clearHistory = useCallback(
    (targetLevel?: SecurityLevel) => {
      const lvl = targetLevel ?? currentLevel;
      const initialGreeting = getInitialGreeting(lvl);

      setMessages([initialGreeting]);
      setGameState(null);
      setLatestUnlockNotification(null);
      setJustDroppedFragment(null);
      clearAssemblyTimerStorage();

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wifi_quest_messages', JSON.stringify([initialGreeting]));
          localStorage.removeItem(`wifi_quest_chat_lvl_${lvl}`);
          sessionStorage.removeItem(`wifi_quest_chat_lvl_${lvl}`);
          localStorage.removeItem('wifi_quest_game_state_lvl_1');
        } catch (err) {
          console.warn(`[useChatSession] Error clearing storage for level ${lvl}:`, err);
        }
      }
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
    clearAssemblyTimerStorage();

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wifi_quest_level', String(newLevel));
        localStorage.setItem('wifi_quest_messages', JSON.stringify([initialGreeting]));
        localStorage.removeItem(`wifi_quest_chat_lvl_${newLevel}`);
        sessionStorage.removeItem(`wifi_quest_chat_lvl_${newLevel}`);
        localStorage.removeItem('wifi_quest_game_state_lvl_1');
      } catch (err) {
        console.warn(`[useChatSession] Error updating storage on switch to level ${newLevel}:`, err);
      }
    }
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
