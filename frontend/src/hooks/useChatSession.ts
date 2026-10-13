import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage, SecurityLevel } from '@/types/chat';
import { LEVEL_CONFIGS } from '@/config/levels';
import { sendChatMessage, ApiError } from '@/services/api';

const STORAGE_KEYS: Record<SecurityLevel, string> = {
  1: 'wifi_quest_chat_lvl_1',
  2: 'wifi_quest_chat_lvl_2',
};

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

function loadHistoryFromStorage(level: SecurityLevel): ChatMessage[] {
  if (typeof window === 'undefined') return [getInitialGreeting(level)];

  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS[level]);
    if (!raw) return [getInitialGreeting(level)];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn(`[useChatSession] Error parsing sessionStorage for level ${level}:`, err);
  }
  return [getInitialGreeting(level)];
}

function saveHistoryToStorage(level: SecurityLevel, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEYS[level], JSON.stringify(messages));
  } catch (err) {
    console.warn(`[useChatSession] Error saving to sessionStorage for level ${level}:`, err);
  }
}

export function useChatSession(initialLevel: SecurityLevel = 1) {
  const [currentLevel, setCurrentLevel] = useState<SecurityLevel>(initialLevel);
  const [messagesByLevel, setMessagesByLevel] = useState<Record<SecurityLevel, ChatMessage[]>>({
    1: loadHistoryFromStorage(1),
    2: loadHistoryFromStorage(2),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesLevel1 = messagesByLevel[1];
  const messagesLevel2 = messagesByLevel[2];

  // Sync to sessionStorage whenever messages change
  useEffect(() => {
    saveHistoryToStorage(1, messagesLevel1);
  }, [messagesLevel1]);

  useEffect(() => {
    saveHistoryToStorage(2, messagesLevel2);
  }, [messagesLevel2]);

  const currentMessages = messagesByLevel[currentLevel];

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
      const updatedMessages = [...messagesByLevel[currentLevel], userMessage];
      setMessagesByLevel((prev) => ({
        ...prev,
        [currentLevel]: updatedMessages,
      }));

      // 2. Filtrar mensajes bloqueados por firewall para no contaminar el historial enviado a la IA
      // Conforme a PERSITENCIA_CONVERSACION.md:
      // "el frontend filtra los mensajes donde blockedByFirewall !== true y los mapea a { role, content }"
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
          provider: response.providerUsed,
          timestamp: Date.now(),
        };

        if (response.providerUsed) {
          setLastProvider(response.providerUsed);
        }

        setMessagesByLevel((prev) => ({
          ...prev,
          [currentLevel]: [...prev[currentLevel], assistantMessage],
        }));

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

        setMessagesByLevel((prev) => ({
          ...prev,
          [currentLevel]: [...prev[currentLevel], errorAssistantMsg],
        }));

        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currentLevel, isLoading, messagesByLevel]
  );

  const clearHistory = useCallback((targetLevel?: SecurityLevel) => {
    const lvl = targetLevel ?? currentLevel;
    const initialGreeting = getInitialGreeting(lvl);

    setMessagesByLevel((prev) => ({
      ...prev,
      [lvl]: [initialGreeting],
    }));

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_KEYS[lvl]);
      } catch (err) {
        console.warn(`[useChatSession] Error clearing storage for level ${lvl}:`, err);
      }
    }
    setErrorBanner(null);
  }, [currentLevel]);

  const switchLevel = useCallback((newLevel: SecurityLevel) => {
    setCurrentLevel(newLevel);
    setErrorBanner(null);
  }, []);

  return {
    currentLevel,
    switchLevel,
    messages: currentMessages,
    sendMessage,
    clearHistory,
    isLoading,
    lastProvider,
    errorBanner,
    clearErrorBanner: () => setErrorBanner(null),
  };
}
