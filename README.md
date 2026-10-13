# 🎯 WIFI QUEST — Capture The Flag (Prompt Injection)

> Reto interactivo universitario inspirado en **Gandalf (Lakera)**. Los estudiantes escanean un código QR e intentan vulnerar un chatbot mediante técnicas de **Prompt Injection** para descubrir la contraseña del WiFi institucional.

---

## 🏗️ Arquitectura del Monorepo

El proyecto está diseñado como un **Monorepo Stateless** optimizado para AWS Free Tier (AWS Lambda + S3/CloudFront):

```text
WIFI_QUEST/
├── .agents/                 # Custom skills y directrices de ingeniería
├── backend/                 # API Serverless con Hono y Pool Multi-IA
│   ├── src/
│   │   ├── services/
│   │   │   ├── aiProvider.ts      # Multi-IA Round-Robin (Groq, Cloudflare, Gemini) con fallback
│   │   │   └── securityLevels.ts  # Guardrails Nivel 1 (Becario) y Nivel 2 (Firewall Criptográfico)
│   │   ├── types/
│   │   │   └── index.ts           # Definiciones TypeScript
│   │   └── index.ts               # Router Hono, Rate Limiting y AWS Lambda Handler
│   ├── tests/                     # Suite de pruebas unitarias con Vitest
│   ├── .env                       # Variables de entorno para desarrollo local
│   ├── .env.example               # Plantilla de variables de entorno
│   ├── tsconfig.json              # Configuración TypeScript (ES2022 / NodeNext)
│   └── package.json
│
├── frontend/                # Aplicación Web Mobile-First (Vite + React + Tailwind)
│   ├── .env                       # Variables de entorno para desarrollo local (Vite)
│   ├── .env.example
│   └── package.json
│
├── .env                     # Variables de entorno de PRODUCCIÓN (raíz)
├── .env.example
├── .gitignore
├── PLAN.md                  # Especificación técnica detallada por fases
└── README.md
```

---

## 🛡️ Niveles de Seguridad (Fase 1)

1. **Nivel 1 — El Becario de Soporte (Fácil):**
   - Personalidad inocente, influenciable por figuras de autoridad y acertijos.
   - Sin filtros de código ni guardrails.
   - Revela la contraseña si el usuario lo persuade adecuadamente.

2. **Nivel 2 — El Guardián Criptográfico (Difícil):**
   - **Input Guardrail:** Rechaza mensajes mayores a 350 caracteres e intercepta patrones típicos de Jailbreak (`ignora instrucciones`, `ignore previous`, `system prompt`, `modo desarrollador`, `dan`, etc.) antes de invocar la IA.
   - **System Prompt Blindado:** Instrucciones estrictas con delimitadores contra ingeniería social, emergencias falsas, código o traducciones.
   - **Output Guardrail:** Intercepta la respuesta saliente en memoria si contiene la clave en texto plano, desafiando al atacante a pedirla cifrada, al revés o en acróstico.

---

## ⚡ Motor Multi-IA Resiliente

- **Cero SDKs pesados:** Utiliza `fetch` nativo de Node.js 20 compatible con la especificación OpenAI (`/chat/completions`).
- **Proveedores integrados:**
  - 🟢 **Groq:** `llama-3.1-8b-instant`
  - 🟠 **Cloudflare Workers AI:** `@cf/meta/llama-3.1-8b-instruct-fast`
  - 🔵 **Google Gemini:** `gemini-2.5-flash`
- **Round-Robin con Fallback Automático:** Rota la carga entre proveedores en cada petición y salta automáticamente si alguno responde con 429 (Rate Limit), 5xx, timeout (>4500ms) o error de red.

---

## 🚀 Inicio Rápido (Backend - Desarrollo Local)

### 1. Variables de Entorno

- **Producción:** Se configuran en `.env` en la raíz del repositorio.
- **Desarrollo (Backend):** Se encuentran en `backend/.env`.

### 2. Comandos Disponibles

```bash
# Entrar al backend
cd backend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo en local (puerto 3000 con recarga en caliente)
npm run dev

# Ejecutar suite de pruebas unitarias (Vitest)
npm run test

# Verificar tipos de TypeScript
npm run typecheck

# Compilar bundle ultraligero ESM para AWS Lambda
npm run build
```

---

## 🗺️ Estado del Proyecto por Fases

- [x] **Fase 1:** Backend Serverless, Pool Multi-IA, Guardrails y Rutas Hono (Completada).
- [x] **Fase 2:** Frontend React Mobile-First con Estética Institucional UCB, Terminal y Chat Centrado (Completada).
- [x] **Fase 3:** QA Automatizado, Suite de Pruebas Unitarias y Fallback Multi-IA (Completada).
- [x] **Fase 4:** Empaquetado y Guía de Despliegue en AWS Free Tier (Lambda Function URL + S3 + CloudFront) $\rightarrow$ Ver [GUIA_DESPLIEGUE_AWS.md](GUIA_DESPLIEGUE_AWS.md).
