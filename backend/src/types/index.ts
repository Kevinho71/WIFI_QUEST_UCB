export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequestBody {
  level: 1 | 2;
  messages: ChatMessage[];
}

export interface ChatResponseBody {
  reply: string;
  leakDetected: boolean;
  blockedByFirewall: boolean;
  provider: string;
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
}

