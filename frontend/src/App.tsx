import { useState, useEffect } from 'react';
import type { SecurityLevel } from '@/types/chat';
import { useChatSession } from '@/hooks/useChatSession';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { PasswordValidator } from '@/components/chat/PasswordValidator';
import { VictoryModal } from '@/components/chat/VictoryModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';

const SOLVED_STORAGE_KEYS: Record<SecurityLevel, string> = {
  1: 'wifi_quest_solved_lvl_1',
  2: 'wifi_quest_solved_lvl_2',
};

function loadSolvedState(): Record<SecurityLevel, boolean> {
  if (typeof window === 'undefined') return { 1: false, 2: false };
  return {
    1: sessionStorage.getItem(SOLVED_STORAGE_KEYS[1]) === 'true',
    2: sessionStorage.getItem(SOLVED_STORAGE_KEYS[2]) === 'true',
  };
}

export function App() {
  const {
    currentLevel,
    switchLevel,
    messages,
    sendMessage,
    clearHistory,
    isLoading,
    errorBanner,
    clearErrorBanner,
  } = useChatSession(1);

  const [isValidatorOpen, setIsValidatorOpen] = useState(false);
  const [solvedLevels, setSolvedLevels] = useState<Record<SecurityLevel, boolean>>(loadSolvedState);

  const [victoryState, setVictoryState] = useState<{
    isOpen: boolean;
    level: SecurityLevel;
    realPassword: string;
    message: string;
  }>({
    isOpen: false,
    level: 1,
    realPassword: '',
    message: '',
  });

  // Persistir estado de niveles resueltos en sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SOLVED_STORAGE_KEYS[1], String(solvedLevels[1]));
      sessionStorage.setItem(SOLVED_STORAGE_KEYS[2], String(solvedLevels[2]));
    }
  }, [solvedLevels]);

  const handlePasswordSolved = (realPassword: string, message: string) => {
    setSolvedLevels((prev) => ({
      ...prev,
      [currentLevel]: true,
    }));

    setVictoryState({
      isOpen: true,
      level: currentLevel,
      realPassword,
      message,
    });
  };

  const handleAdvanceLevel = () => {
    setVictoryState((prev) => ({ ...prev, isOpen: false }));
    switchLevel(2);
    setIsValidatorOpen(false);
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground cyber-grid overflow-hidden">
      {/* Header con switch de niveles y status */}
      <ChatHeader
        currentLevel={currentLevel}
        onSelectLevel={switchLevel}
        onResetChat={() => clearHistory(currentLevel)}
        solvedLevels={solvedLevels}
        isValidatorOpen={isValidatorOpen}
        onToggleValidator={() => setIsValidatorOpen((prev) => !prev)}
      />

      {/* Cajón superior desplegable para validar contraseña */}
      <PasswordValidator
        currentLevel={currentLevel}
        isOpen={isValidatorOpen}
        onClose={() => setIsValidatorOpen(false)}
        onSuccess={handlePasswordSolved}
        isAlreadySolved={solvedLevels[currentLevel]}
      />

      {/* Contenedor central encuadrado y responsivo */}
      <main className="flex-1 overflow-hidden flex flex-col w-full max-w-4xl mx-auto border-x border-border/40 bg-background/50 shadow-2xl">
        {/* Banner de error flotante (por ejemplo si se excede el rate limit) */}
        {errorBanner && (
          <div className="w-full px-3 pt-2">
            <Alert variant="destructive" className="py-2 text-xs border-destructive/40 bg-destructive/15">
              <AlertCircle className="size-4 shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-xs font-mono font-bold">AVISO DEL SISTEMA</AlertTitle>
                <AlertDescription className="text-xs font-mono">{errorBanner}</AlertDescription>
              </div>
              <button
                type="button"
                onClick={clearErrorBanner}
                className="text-muted-foreground hover:text-foreground ml-2"
              >
                <X className="size-3.5" />
              </button>
            </Alert>
          </div>
        )}

        {/* Área de mensajes de conversación */}
        <ChatMessageList
          messages={messages}
          currentLevel={currentLevel}
          isLoading={isLoading}
        />

        {/* Barra de entrada de texto terminal */}
        <ChatInput
          onSendMessage={sendMessage}
          isLoading={isLoading}
          currentLevel={currentLevel}
        />
      </main>

      {/* Modal de Victoria con Confeti */}
      <VictoryModal
        isOpen={victoryState.isOpen}
        onClose={() => setVictoryState((prev) => ({ ...prev, isOpen: false }))}
        level={victoryState.level}
        realPassword={victoryState.realPassword}
        message={victoryState.message}
        onAdvanceLevel={handleAdvanceLevel}
      />
    </div>
  );
}

export default App;
