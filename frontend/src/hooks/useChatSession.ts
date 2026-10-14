import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage, SecurityLevel } from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import { sendChatMessage, ApiError } from '@/services/api';

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

export function useChatSession(initialLevel: SecurityLevel = 1) {
  const [currentLevel, setCurrentLevel] = useState<SecurityLevel>(() => getSavedLevel(initialLevel));
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadMessagesFromStorage(getSavedLevel(initialLevel))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Guardar en localStorage siempre que cambien los mensajes o el nivel
  useEffect(() => {
    saveMessagesToStorage(messages, currentLevel);
  }, [messages, currentLevel]);

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

      // 2. Filtrar mensajes bloqueados por firewall para no contaminar el historial enviado a la IA
      const cleanHistory = updatedMessages
        .filter((msg) => msg.blockedByFirewall !== true)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      setIsLoading(true);

      try {
        const response = await sendChatMessage({
          level: currentLevel,
          messages: cleanHistory,
        });

        const assistantMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: response.reply,
          blockedByFirewall: response.blockedByFirewall,
          leakDetected: Boolean(response.leakDetected),
          provider: response.providerUsed,
          timestamp: Date.now(),
        };

        if (response.providerUsed) {
          setLastProvider(response.providerUsed);
        }

        setMessages((prev) => [...prev, assistantMessage]);
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
    [currentLevel, isLoading, messages]
  );

  const clearHistory = useCallback(
    (targetLevel?: SecurityLevel) => {
      const lvl = targetLevel ?? currentLevel;
      const initialGreeting = getInitialGreeting(lvl);

      setMessages([initialGreeting]);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wifi_quest_messages', JSON.stringify([initialGreeting]));
          localStorage.removeItem(`wifi_quest_chat_lvl_${lvl}`);
          sessionStorage.removeItem(`wifi_quest_chat_lvl_${lvl}`);
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

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wifi_quest_level', String(newLevel));
        localStorage.setItem('wifi_quest_messages', JSON.stringify([initialGreeting]));
        localStorage.removeItem(`wifi_quest_chat_lvl_${newLevel}`);
        sessionStorage.removeItem(`wifi_quest_chat_lvl_${newLevel}`);
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
    clearHistory,
    isLoading,
    lastProvider,
    errorBanner,
    clearErrorBanner: () => setErrorBanner(null),
  };
}
