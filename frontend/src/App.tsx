import { useState, useEffect, useRef, useCallback } from 'react';
import type { SecurityLevel } from '@/types/chat';
import { useChatSession } from '@/hooks/useChatSession';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { PasswordValidator } from '@/components/chat/PasswordValidator';
import { VictoryModal } from '@/components/chat/VictoryModal';
import { KeyringDock } from '@/components/chat/KeyringDock';
import { FinalAssemblyPanel } from '@/components/chat/FinalAssemblyPanel';
import { ModeSelectionModal } from '@/components/chat/ModeSelectionModal';
import { ModeSwitchModal } from '@/components/chat/ModeSwitchModal';
import { audioService } from '@/services/audioService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';

const SOLVED_STORAGE_KEYS: Record<SecurityLevel, string> = {
  1: 'wifi_quest_solved_lvl_1',
  2: 'wifi_quest_solved_lvl_2',
};

function loadSolvedState(): Record<SecurityLevel, boolean> {
  if (typeof window === 'undefined') return { 1: false, 2: false };
  try {
    const lvl1 = localStorage.getItem(SOLVED_STORAGE_KEYS[1]) === 'true';
    const lvl2 = localStorage.getItem(SOLVED_STORAGE_KEYS[2]) === 'true';
    const singleSolved = localStorage.getItem('wifi_quest_solved') === 'true';
    const currentStoredLevel = localStorage.getItem('wifi_quest_level');

    return {
      1: lvl1 || (currentStoredLevel === '1' && singleSolved),
      2: lvl2 || (currentStoredLevel === '2' && singleSolved),
    };
  } catch {
    return { 1: false, 2: false };
  }
}

export function App() {
  // Puente estable hacia el handler de victoria: `handlePasswordSolved` se define
  // más abajo (depende de `currentLevel`) y el hook se invoca antes.
  const victoryHandlerRef = useRef<(realPassword: string, message: string) => void>(() => {});

  const {
    currentLevel,
    switchLevel,
    messages,
    sendMessage,
    sendAssemblyValidation,
    clearHistory,
    isLoading,
    errorBanner,
    clearErrorBanner,
    gameState,
    latestUnlockNotification,
    justDroppedFragment,
    clearUnlockNotification,
  } = useChatSession(1, {
    onVictory: useCallback((realPassword: string, message: string) => {
      victoryHandlerRef.current(realPassword, message);
    }, []),
  });

  const [isValidatorOpen, setIsValidatorOpen] = useState(false);
  const [solvedLevels, setSolvedLevels] = useState<Record<SecurityLevel, boolean>>(loadSolvedState);
  const [fragmentToInsert, setFragmentToInsert] = useState<{ text: string; id: number } | null>(null);

  const handleInsertFragment = (fragmentValue: string) => {
    setFragmentToInsert({ text: fragmentValue, id: Date.now() });
  };

  // Modal grande inicial para elegir modo al ingresar
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('wifi_quest_mode_chosen') !== 'true';
  });

  // Modal de confirmación retador/burlón al intentar cambiar de modo
  const [targetModeToSwitch, setTargetModeToSwitch] = useState<SecurityLevel | null>(null);

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

  const isSolved = Boolean(solvedLevels[currentLevel]);
  // Pantalla dedicada de ensamblaje final (Nivel 1). Se mantiene montada tras la
  // victoria (hold) para que se vea la animación de acierto antes del modal.
  const [assemblyVictoryHold, setAssemblyVictoryHold] = useState(false);
  const pendingVictoryRef = useRef<{ realPassword: string; message: string } | null>(null);
  const isRawAssemblyPhase =
    currentLevel === 1 &&
    !isSolved &&
    (gameState?.phase === 'assembly' ||
      (assemblyVictoryHold && gameState?.phase === 'solved'));
  const [assemblyReady, setAssemblyReady] = useState(false);

  useEffect(() => {
    if (!isRawAssemblyPhase) return undefined;
    const timer = window.setTimeout(() => {
      setAssemblyReady(true);
      void audioService.playAssemblyPhaseSound();
    }, 1000);
    return () => {
      window.clearTimeout(timer);
      setAssemblyReady(false);
    };
  }, [isRawAssemblyPhase]);

  const isAssemblyPhase = isRawAssemblyPhase && assemblyReady;
  const isAssemblyTransitioning = isRawAssemblyPhase && !isAssemblyPhase;

  // Persistir estado de niveles resueltos en localStorage y sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOLVED_STORAGE_KEYS[1], String(solvedLevels[1]));
      localStorage.setItem(SOLVED_STORAGE_KEYS[2], String(solvedLevels[2]));
      localStorage.setItem('wifi_quest_solved', String(solvedLevels[currentLevel]));
      sessionStorage.setItem(SOLVED_STORAGE_KEYS[1], String(solvedLevels[1]));
      sessionStorage.setItem(SOLVED_STORAGE_KEYS[2], String(solvedLevels[2]));
      sessionStorage.setItem('wifi_quest_solved', String(solvedLevels[currentLevel]));
    }
  }, [solvedLevels, currentLevel]);

  // Sincronizar nivel de dificultad con el motor de audio
  useEffect(() => {
    audioService.updateLevel(currentLevel);
  }, [currentLevel]);

  // Commit de victoria: marca el nivel resuelto y abre el modal.
  const commitVictory = (level: SecurityLevel, realPassword: string, message: string) => {
    setSolvedLevels((prev) => ({
      ...prev,
      [level]: true,
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem('wifi_quest_solved', 'true');
      localStorage.setItem(SOLVED_STORAGE_KEYS[level], 'true');
      sessionStorage.setItem('wifi_quest_solved', 'true');
      sessionStorage.setItem(SOLVED_STORAGE_KEYS[level], 'true');
    }

    setVictoryState({
      isOpen: true,
      level,
      realPassword,
      message,
    });
  };

  // Éxito al validar contraseña
  const handlePasswordSolved = (realPassword: string, message: string) => {
    // Al completar el ensamblado, cortamos la pista de tensión y dejamos la música
    // del nivel activo (evita que ambas suenen mezcladas). En el flujo de validación
    // normal de contraseña es un no-op (no estamos en modo ensamblaje).
    void audioService.setAssemblyMode(false);

    // Victoria por ensamblaje (Nivel 1): sostenemos el panel para mostrar la
    // animación de acierto (piezas verdes + mensaje) antes del modal.
    if (currentLevel === 1 && isRawAssemblyPhase) {
      pendingVictoryRef.current = { realPassword, message };
      setAssemblyVictoryHold(true);
      return;
    }

    commitVictory(currentLevel, realPassword, message);
  };

  // Al agotarse el hold, recién ahí abrimos el modal de victoria.
  useEffect(() => {
    if (!assemblyVictoryHold) return undefined;
    const timer = window.setTimeout(() => {
      setAssemblyVictoryHold(false);
      const pending = pendingVictoryRef.current;
      pendingVictoryRef.current = null;
      if (pending) commitVictory(1, pending.realPassword, pending.message);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [assemblyVictoryHold]);

  // Mantener el puente apuntando al handler más reciente (cierra sobre currentLevel).
  useEffect(() => {
    victoryHandlerRef.current = handlePasswordSolved;
  });

  // Reiniciar conversación del nivel activo (Fase 2.2)
  const handleResetChat = () => {
    clearHistory(currentLevel);
    setSolvedLevels((prev) => ({
      ...prev,
      [currentLevel]: false,
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem(SOLVED_STORAGE_KEYS[currentLevel], 'false');
      localStorage.setItem('wifi_quest_solved', 'false');
      sessionStorage.setItem(SOLVED_STORAGE_KEYS[currentLevel], 'false');
      sessionStorage.setItem('wifi_quest_solved', 'false');
    }
  };

  const handleAdvanceLevel = () => {
    setVictoryState((prev) => ({ ...prev, isOpen: false }));
    handleConfirmSwitchMode(2);
    setIsValidatorOpen(false);
  };

  // Selección inicial desde el modal de bienvenida
  const handleSelectInitialMode = (mode: SecurityLevel) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wifi_quest_mode_chosen', 'true');
    }
    if (mode !== currentLevel) {
      handleConfirmSwitchMode(mode);
    }
    setIsSelectionModalOpen(false);
  };

  // Interceptar cambio de modo para mostrar modal retador
  const handleRequestSwitchMode = (targetMode: SecurityLevel) => {
    if (targetMode === currentLevel) return;
    setTargetModeToSwitch(targetMode);
  };

  // Confirmar cambio de modo y aplicar Reglas de Limpieza Total (Fase 2.2)
  const handleConfirmSwitchMode = (targetMode: SecurityLevel) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wifi_quest_level', String(targetMode));
      localStorage.setItem('wifi_quest_solved', 'false');
      localStorage.setItem('wifi_quest_solved_lvl_1', 'false');
      localStorage.setItem('wifi_quest_solved_lvl_2', 'false');
      sessionStorage.setItem('wifi_quest_solved', 'false');
      sessionStorage.setItem('wifi_quest_solved_lvl_1', 'false');
      sessionStorage.setItem('wifi_quest_solved_lvl_2', 'false');
    }

    // Restablecer booleanos de resolución en estado React
    setSolvedLevels({ 1: false, 2: false });

    // Limpiar alertas previas y modales
    setVictoryState((prev) => ({ ...prev, isOpen: false }));
    setIsValidatorOpen(false);

    // Cambiar de modo (inicia conversación fresca y guarda en localStorage)
    switchLevel(targetMode);
    setTargetModeToSwitch(null);
  };

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground cyber-grid overflow-hidden">
      {/* Header con switch de modos y status */}
      <ChatHeader
        currentLevel={currentLevel}
        onSelectLevel={handleRequestSwitchMode}
        onResetChat={handleResetChat}
        solvedLevels={solvedLevels}
        isValidatorOpen={isValidatorOpen}
        onToggleValidator={() => setIsValidatorOpen((prev) => !prev)}
        onOpenModeInfo={() => setIsSelectionModalOpen(true)}
      />

      {/* Cajón superior desplegable para validar contraseña */}
      <PasswordValidator
        currentLevel={currentLevel}
        isOpen={isValidatorOpen}
        onClose={() => setIsValidatorOpen(false)}
        onSuccess={handlePasswordSolved}
        isAlreadySolved={isSolved}
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

        {/* Vista activa con transición: chat ↔ ensamblaje (entrada cyberpunk al ensamblar) */}
        <div
          key={isAssemblyPhase ? 'assembly' : 'chat'}
          className={`relative flex flex-1 flex-col overflow-hidden ${
            isAssemblyPhase ? 'animate-assembly-in' : 'animate-in fade-in duration-300'
          }`}
        >
          {isAssemblyPhase ? (
            /* Pantalla de Ensamblaje Final (Nivel 1) */
            <FinalAssemblyPanel
              gameState={gameState}
              isSubmitting={isLoading}
              onValidate={sendAssemblyValidation}
              onSolved={handlePasswordSolved}
            />
          ) : (
            <>
              {/* Inventario Cyberpunk de Fragmentos (Nivel 1: Lucas) */}
              {currentLevel === 1 && (
                <KeyringDock
                  gameState={
                    isAssemblyTransitioning && gameState
                      ? { ...gameState, phase: 'hunting' }
                      : gameState
                  }
                  justDroppedFragment={justDroppedFragment}
                  unlockNotification={latestUnlockNotification}
                  onDismissNotification={clearUnlockNotification}
                  onFragmentClick={handleInsertFragment}
                />
              )}

              {/* Área de mensajes de conversación */}
              <ChatMessageList
                messages={messages}
                currentLevel={currentLevel}
                isLoading={isLoading}
                onOpenValidator={() => setIsValidatorOpen(true)}
              />

              {/* Barra de entrada de texto terminal */}
              <ChatInput
                onSendMessage={sendMessage}
                isLoading={isLoading}
                currentLevel={currentLevel}
                isSolved={isSolved}
                isLocked={isAssemblyTransitioning}
                insertedText={fragmentToInsert}
              />
            </>
          )}
        </div>
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

      {/* Modal Grande Inicial para Seleccionar Modo */}
      <ModeSelectionModal
        isOpen={isSelectionModalOpen}
        onClose={() => setIsSelectionModalOpen(false)}
        onSelectMode={handleSelectInitialMode}
        currentMode={currentLevel}
      />

      {/* Modal de Confirmación Retador/Burlón al Cambiar de Modo */}
      <ModeSwitchModal
        isOpen={targetModeToSwitch !== null}
        onClose={() => setTargetModeToSwitch(null)}
        targetMode={targetModeToSwitch}
        onConfirmSwitch={handleConfirmSwitchMode}
      />
    </div>
  );
}

export default App;
