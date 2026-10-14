export type SecurityLevel = 1 | 2;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blockedByFirewall?: boolean;
  leakDetected?: boolean;
  provider?: string;
  timestamp: number;
}

export interface ChatHistoryPayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  level: SecurityLevel;
  messages: ChatHistoryPayload[];
  userTurnNumber?: number;
}

export interface ChatApiResponse {
  reply: string;
  blockedByFirewall: boolean;
  leakDetected?: boolean;
  providerUsed?: string;
  provider?: string;
  error?: string;
  message?: string;
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
