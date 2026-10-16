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

/**
 * Semilla por PARTIDA (Nivel 1): se genera una vez al iniciar y se persiste para
 * reenviarla idéntica en cada turno (el replay del backend debe reconstruir el mismo
 * orden e ids). Solo se regenera al reiniciar la conversación o cambiar de modo.
 */
const SESSION_SEED_KEY = 'wifi_quest_session_seed_lvl_1';

function createSessionSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `seed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadSessionSeed(): string {
  if (typeof window === 'undefined') return createSessionSeed();
  try {
    const existing = localStorage.getItem(SESSION_SEED_KEY);
    if (existing) return existing;
  } catch (err) {
    console.warn('[useChatSession] Error reading session seed:', err);
  }
  const seed = createSessionSeed();
  try {
    localStorage.setItem(SESSION_SEED_KEY, seed);
  } catch (err) {
    console.warn('[useChatSession] Error saving session seed:', err);
  }
  return seed;
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
  const [currentLevel, setCurrentLevel] = useState<SecurityLevel>(() => getSavedLevel(initialLevel));
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessagesFromStorage(getSavedLevel(initialLevel))
  );

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
  const [sessionSeed, setSessionSeed] = useState<string>(() => loadSessionSeed());

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
      clearAssemblyTimerStorage();

      // Reiniciar la partida => nueva semilla (nuevo orden de descubrimiento e ids).
      const nextSeed = createSessionSeed();
      setSessionSeed(nextSeed);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(SESSION_SEED_KEY, nextSeed);
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

    // Cambiar de modo inicia una partida nueva => nueva semilla.
    const nextSeed = createSessionSeed();
    setSessionSeed(nextSeed);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SESSION_SEED_KEY, nextSeed);
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
