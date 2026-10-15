export type SecurityLevel = 1 | 2;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blockedByFirewall?: boolean;
  leakDetected?: boolean;
  leakBlocked?: boolean;
  victory?: boolean;
  provider?: string;
  timestamp: number;
  assembly?: boolean; // Marca mensajes de la validación de ensamblaje (Nivel 1)
}

export interface ChatHistoryPayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  level: SecurityLevel;
  messages: ChatHistoryPayload[];
  userTurnNumber?: number;
  assemblyPieces?: string[]; // Orden actual de las piezas en la fase de ensamblaje
}

export interface DiscoveredFragmentDTO {
  id: string; // 'frag_1', 'frag_2', etc.
  orderDiscovered: number; // 1, 2, 3... (orden cronológico de descubrimiento)
  value: string; // Solo viaja si ya fue descubierto
  type: 'word' | 'number' | 'symbol';
}

export interface GameStateDTO {
  phase: 'negotiation' | 'hunting' | 'assembly' | 'solved';
  totalFragments: number; // ej. 7
  discoveredCount: number; // ej. 3
  currentChallengeHint: string; // Pista descriptiva del reto en curso
  unlockedFragments: DiscoveredFragmentDTO[]; // Lista en orden cronológico
  justUnlockedFragment?: string; // Para disparar la animación de caída en el front
  isCombo?: boolean; // Para disparar sonido especial de combo
  assemblyDiffAdvice?: string; // Diagnóstico quirúrgico si falló el ensamblaje
  assemblyFeedback?: AssemblyFeedbackDTO; // Feedback por posición del último intento
}

export interface AssemblyFeedbackDTO {
  slotCorrect: boolean[]; // true si la pieza i del intento está en su posición correcta
  wellPlaced: number; // cantidad de posiciones correctas
  total: number; // total de piezas de la clave
}

export interface AssemblyValidationResult {
  reply: string;
  victory: boolean;
  feedback?: AssemblyFeedbackDTO;
}

export interface UnlockNotification {
  id: string;
  fragmentValue: string;
  discoveredCount: number;
  totalFragments: number;
  isCombo?: boolean;
}

export interface ChatApiResponse {
  reply: string;
  blockedByFirewall: boolean;
  leakDetected?: boolean;
  victory?: boolean;
  leakBlocked?: boolean;
  providerUsed?: string;
  provider?: string;
  error?: string;
  message?: string;
  gameState?: GameStateDTO;
}

export interface VerifyRequest {
  level: SecurityLevel;
  passwordGuess: string;
}

export interface VerifyApiResponse {
  success: boolean;
  realPassword?: string;
  message: string;
  error?: string;
}

export interface LevelConfig {
  level: SecurityLevel;
  title: string;
  subtitle: string;
  targetPersona: string;
  difficulty: 'Fácil' | 'Difícil';
  accentColor: string;
  initialMessage: string;
  description: string;
}
