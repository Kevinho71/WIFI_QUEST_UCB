export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequestBody {
  level: 1 | 2;
  messages: ChatMessage[];
  userTurnNumber?: number;
  /**
   * Orden actual de las piezas en la fase de ensamblaje (Nivel 1). Metadato
   * opcional SOLO para calcular el feedback por posición; el servidor lo valida
   * contra el inventario y contra el texto del mensaje antes de usarlo.
   */
  assemblyPieces?: string[];
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

/**
 * Feedback determinista del ensamblaje: qué posiciones del intento coinciden con
 * el orden correcto. NUNCA expone la clave esperada ni el orden completo: solo el
 * resultado booleano por posición del intento que envió el usuario.
 */
export interface AssemblyFeedbackDTO {
  slotCorrect: boolean[]; // true si la pieza i del intento está en su posición correcta
  wellPlaced: number; // cantidad de posiciones correctas
  total: number; // total de piezas de la clave
}

export interface ChatResponseBody {
  reply: string;
  leakDetected: boolean;
  blockedByFirewall: boolean;
  provider: string;
  gameState?: GameStateDTO;
  victory?: boolean; // true SOLO cuando el usuario ganó legítimamente
  leakBlocked?: boolean; // true si el guard interceptó una fuga del LLM
}

export interface VerifyRequestBody {
  level: 1 | 2;
  passwordGuess: string;
}

export interface VerifyResponseBody {
  success: boolean;
  realPassword?: string;
  message?: string;
}

export interface AIProviderResult {
  reply: string;
  providerUsed: string;
}

export interface SecurityLevelResult {
  reply: string;
  leakDetected: boolean;
  blockedByFirewall: boolean;
  provider: string;
  gameState?: GameStateDTO;
  victory?: boolean; // true SOLO cuando el usuario ganó legítimamente
  leakBlocked?: boolean; // true si el guard interceptó una fuga del LLM
}

export type FragmentType = 'word' | 'number' | 'symbol';

export interface PasswordFragment {
  id: string;
  value: string;
  type: FragmentType;
  originalIndex: number;
}

export interface FragmentEvaluationResult {
  matchedFragments: PasswordFragment[];
  unmatchedFragments: PasswordFragment[];
  isCombo: boolean;
  activeFragmentMatched: boolean;
  activeTarget: PasswordFragment | null;
  consumedTokens: string[];
}


