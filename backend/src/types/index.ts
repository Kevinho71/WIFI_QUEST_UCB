export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequestBody {
  level: 1 | 2;
  messages: ChatMessage[];
  userTurnNumber?: number;
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


