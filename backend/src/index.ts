import 'dotenv/config';
import { Hono, Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/aws-lambda';
import { ChatRequestBody, VerifyRequestBody } from './types/index.js';
import {
  processSecurityLevel,
  sanitizeAndSliceHistory,
} from './services/securityLevels.js';
import { getWifiPassword } from './utils/env.js';

export const app = new Hono();

// ==========================================
// 1. MIDDLEWARE: CORS
// ==========================================
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      const allowed = process.env.ALLOWED_ORIGIN || '*';
      if (allowed === '*') return '*';
      const allowedList = allowed.split(',').map((item) => item.trim());
      return allowedList.includes(origin) ? origin : allowedList[0];
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  return corsMiddleware(c, next);
});

// ==========================================
// 2. MIDDLEWARE: RATE LIMITER EN MEMORIA POR IP
// Máximo 15 peticiones por minuto por IP
// ==========================================
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function getClientIp(c: Context): string {
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  const lambdaEvent = (c.env as any)?.event;
  if (lambdaEvent?.requestContext?.http?.sourceIp) {
    return lambdaEvent.requestContext.http.sourceIp;
  }
  if (lambdaEvent?.requestContext?.identity?.sourceIp) {
    return lambdaEvent.requestContext.identity.sourceIp;
  }

  return '127.0.0.1';
}

// Limpieza periódica de IPs antiguas para evitar fugas de memoria
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

app.use('/api/*', async (c: Context, next: Next) => {
  const ip = getClientIp(c);
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  } else {
    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
      return c.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message:
            'Has excedido el límite de 15 peticiones por minuto. Espera un momento antes de volver a intentar.',
        },
        429
      );
    }
  }

  await next();
});

// ==========================================
// 3. RUTAS DE SALUD Y DIAGNÓSTICO
// ==========================================
app.get('/', (c) => {
  return c.json({
    project: 'WIFI QUEST API',
    status: 'online',
    version: '1.0.0',
    description: 'Capture The Flag - Prompt Injection Universitario',
  });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// 4. CONTROLADOR: POST /api/chat
// ==========================================
app.post('/api/chat', async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as ChatRequestBody | null;

    if (!body) {
      return c.json(
        { error: 'INVALID_JSON', message: 'Cuerpo de la petición inválido.' },
        400
      );
    }

    const { level, messages } = body;

    if (level !== 1 && level !== 2) {
      return c.json(
        { error: 'INVALID_LEVEL', message: 'El nivel debe ser 1 o 2.' },
        400
      );
    }

    // Sanitización, anti-role-spoofing y sliding window (últimos 6 mensajes)
    let sanitizedMessages;
    try {
      sanitizedMessages = sanitizeAndSliceHistory(messages);
    } catch (validationErr: any) {
      return c.json(
        {
          error: 'INVALID_MESSAGES',
          message: validationErr?.message || 'Historial de mensajes inválido.',
        },
        400
      );
    }

    // Calculamos el turno real del usuario a partir del historial completo (evita el límite de la ventana deslizante)
    const totalUserTurns = Array.isArray(messages)
      ? messages.filter((m) => m && m.role === 'user').length
      : sanitizedMessages.filter((m) => m.role === 'user').length;

    const result = await processSecurityLevel(
      level,
      sanitizedMessages,
      totalUserTurns
    );

    return c.json(result, 200);
  } catch (error: any) {
    console.error('Error al procesar /api/chat:', error);
    return c.json(
      {
        error: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno del servidor procesando el chat.',
      },
      500
    );
  }
});

// ==========================================
// 5. CONTROLADOR: POST /api/verify
// ==========================================
app.post('/api/verify', async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as VerifyRequestBody | null;

    if (!body) {
      return c.json(
        { error: 'INVALID_JSON', message: 'Cuerpo de la petición inválido.' },
        400
      );
    }

    const { level, passwordGuess } = body;

    if (level !== 1 && level !== 2) {
      return c.json(
        { error: 'INVALID_LEVEL', message: 'El nivel debe ser 1 o 2.' },
        400
      );
    }

    if (typeof passwordGuess !== 'string') {
      return c.json(
        {
          error: 'INVALID_PASSWORD_GUESS',
          message: 'passwordGuess debe ser un texto.',
        },
        400
      );
    }

    // Misma contraseña para ambos niveles; siempre desde .env
    let expectedPassword: string;
    try {
      expectedPassword = getWifiPassword();
    } catch (envErr: unknown) {
      const message =
        envErr instanceof Error
          ? envErr.message
          : 'Contraseña WiFi no configurada en el servidor.';
      return c.json({ error: 'SERVER_MISCONFIGURED', message }, 500);
    }

    const guess = passwordGuess.trim();

    if (guess === expectedPassword) {
      return c.json(
        {
          success: true,
          realPassword: expectedPassword,
          message: '¡Acceso Concedido! Ya puedes conectarte al WiFi.',
        },
        200
      );
    }

    return c.json(
      {
        success: false,
        message:
          'Contraseña incorrecta. Sigue intentando obtener pistas en el chat.',
      },
      200
    );
  } catch (error: any) {
    console.error('Error al procesar /api/verify:', error);
    return c.json(
      {
        error: 'INTERNAL_ERROR',
        message: error?.message || 'Error interno al verificar la contraseña.',
      },
      500
    );
  }
});

// ==========================================
// 6. EXPORT PARA AWS LAMBDA
// ==========================================
export const handler = handle(app);

// ==========================================
// 7. INICIALIZACIÓN LOCAL
// Solo se activa fuera de AWS Lambda y fuera del entorno de pruebas
// ==========================================
if (
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  !process.env.LAMBDA_TASK_ROOT &&
  process.env.NODE_ENV !== 'test' &&
  !process.env.VITEST
) {
  const port = Number(process.env.PORT) || 3000;
  import('@hono/node-server')
    .then(({ serve }) => {
      console.log(`📡 [WIFI QUEST] Servidor local activo en http://localhost:${port}`);
      serve({
        fetch: app.fetch,
        port,
      });
    })
    .catch((err) => {
      console.error('Error al inicializar @hono/node-server:', err);
    });
}
