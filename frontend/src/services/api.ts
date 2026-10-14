import type {
  ChatApiResponse,
  ChatRequest,
  VerifyApiResponse,
  VerifyRequest,
} from '@/types/chat';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatApiResponse> {
  const url = `${API_BASE_URL}/api/chat`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 429) {
        throw new ApiError(
          data?.message || 'Límite de velocidad excedido (máx 15 req/min). Por favor espera unos segundos.',
          429,
          'RATE_LIMIT'
        );
      }
      throw new ApiError(
        data?.message || `Error del servidor (${response.status})`,
        response.status,
        data?.error
      );
    }

    return {
      reply: data.reply || 'Sin respuesta del sistema.',
      blockedByFirewall: Boolean(data.blockedByFirewall),
      leakDetected: Boolean(data.leakDetected),
      providerUsed: data.providerUsed || data.provider || 'unknown',
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido de red';
    throw new ApiError(`Error de conexión con el backend: ${message}`, 0, 'NETWORK_ERROR');
  }
}

export async function verifyPassword(request: VerifyRequest): Promise<VerifyApiResponse> {
  const url = `${API_BASE_URL}/api/verify`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        data?.message || `Error del servidor al verificar (${response.status})`,
        response.status,
        data?.error
      );
    }

    return {
      success: Boolean(data?.success),
      realPassword: data?.realPassword,
      message: data?.message || (data?.success ? '¡Acceso Concedido!' : 'Contraseña incorrecta.'),
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido de red';
    throw new ApiError(`Error de conexión al verificar: ${message}`, 0, 'NETWORK_ERROR');
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
