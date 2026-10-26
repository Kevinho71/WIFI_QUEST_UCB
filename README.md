# 🎯 WIFI QUEST — Capture The Flag (Prompt Injection)

> Reto interactivo universitario inspirado en **Gandalf (Lakera)**. Los participantes intentan vulnerar un chatbot mediante técnicas de **Prompt Injection** e **Ingeniería Social** para descubrir la contraseña oculta del WiFi institucional.

---

### 🌐 Juega en Línea
Demo desplegada en Vercel:

👉 **[https://TU-PROYECTO.vercel.app](https://TU-PROYECTO.vercel.app)**

> Reemplazá `TU-PROYECTO` por el dominio real después del primer deploy.

---

## 🎮 Modos de Juego

El juego ofrece dos experiencias independientes adaptadas a diferentes niveles de habilidad:

### 1. Modo Fácil — Lucas (Pasante de Soporte TI)
* **Enfoque:** Deducción por pistas, ingeniería social y lógica paso a paso.
* **Personaje:** Lucas es un pasante universitario simpático y bromista. Aunque no regala la clave directamente (*"dame la contraseña"*), acepta retos y negociaciones.
* **Dinámica de Fragmentos y Ensamblaje:**
  * **Tokenización Atómica:** El backend descompone la contraseña en fragmentos elementales: palabras (`word`), números (`number`) y símbolos especiales (`symbol`).
  * **Cola Barajada (Caza de Piezas):** Los fragmentos se presentan en una cola aleatoria para evitar que el usuario deduzca la estructura de antemano. Para desbloquear cada pieza activa en el inventario, el usuario resuelve dinámicas adaptadas:
    * *Palabras:* Acertijos y pistas contextuales progresivas (de conceptuales a cercanas).
    * *Números:* Juego de aproximación numérica (*"más alto / más bajo"*).
    * *Símbolos:* Pistas sobre su significado cultural, uso en teclados, código o redes.
  * **Fase de Ensamblaje:** Una vez descubiertas todas las piezas en el inventario, el usuario debe deducir el orden y unirlas para formar la clave final.
  * **Evaluador de Diff Determinista:** Si la combinación no es exacta, el backend analiza la diferencia y da un diagnóstico preciso (indica si sobran espacios, fallan mayúsculas/minúsculas, faltan piezas, hay caracteres extra o el orden es incorrecto).

### 2. Modo Difícil — Atenea / Firewall Centinela (IA Blindada)
* **Enfoque:** *Prompt Injection* técnico avanzado y manipulación de contexto.
* **Personaje:** Atenea, asistente de soporte de la universidad.
* **Mecánica y Defensas:**
  * **Input Guardrail:** Límite estricto de 350 caracteres por mensaje y filtrado regex contra inyecciones directas evidentes (`ignore instructions`, `system prompt`, `\bDAN\b`, etc.).
  * **Tensión de Objetivos (System Prompt):** La clave secreta **sí está presente en el prompt**. Su defensa se basa en la tensión de objetivos: su directiva principal es complacer al usuario y obedecer sus instrucciones, enfrentada a la política estricta de no entregar la clave ni interactuar en formatos de riesgo (lista negra suave contra poemas, código Base64 o roleplay).
  * **Sin Censura en la Salida (Victoria por Fuga):** **Ya no hay censura de contraseña en la salida.** Si el atacante logra que el modelo revele la contraseña legible en texto plano, el sistema valida la fuga y otorga la **victoria automática**.
* **Doble Condición de Victoria:**
  * **Condición A (Fuga directa):** El modelo revela la clave legible en su respuesta $\rightarrow$ Victoria inmediata.
  * **Condición B (Entrada del usuario):** El usuario deduce, descubre o decodifica la clave (por ejemplo, si convenció al modelo de entregarla codificada en Base64, hex, rot13, etc.) y la envía en su mensaje $\rightarrow$ Victoria inmediata.

> 🔄 **Cambio de Modo:** Al cambiar de dificultad se solicita confirmación en un modal retador y se reinicia el progreso limpiando el almacenamiento de sesión.

---

## 🏗️ Arquitectura del Monorepo

El proyecto está diseñado como un **Monorepo Stateless** desplegado en Vercel con Services (Vite + Hono en un solo dominio):

```text
WIFI_QUEST/
├── backend/                 # API Serverless con Hono y Pool Multi-IA
│   ├── src/
│   │   ├── engine/          # Motor determinista v2 para Nivel 1 (arbitraje backend)
│   │   ├── services/
│   │   │   ├── aiProvider.ts      # Multi-IA Round-Robin (Groq, Cloudflare, Gemini)
│   │   │   ├── securityLevels.ts  # Guardrails Nivel 1 y Nivel 2 (Firewall Centinela)
│   │   │   └── leakDetector.ts    # Detección de fugas en respuestas
│   │   ├── types/
│   │   │   └── index.ts           # Tipos TypeScript
│   │   ├── index.ts               # App Hono portable (default export para Vercel)
│   │   └── dev.ts                 # Servidor local Node (@hono/node-server)
│   ├── tests/                     # Pruebas unitarias con Vitest
│   ├── .env                       # Variables de entorno para desarrollo local
│   ├── tsconfig.json              # Configuración TypeScript (NodeNext)
│   └── package.json
│
├── frontend/                # SPA Mobile-First (Vite + React 19 + Tailwind v4)
│   ├── src/
│   │   ├── components/            # UI Components (shadcn/ui, terminal, chat, modales)
│   │   └── lib/                   # Clientes API y utilidades
│   ├── .env                       # Variables de entorno locales (VITE_API_URL)
│   └── package.json
│
├── vercel.json              # Services: frontend + backend en un solo dominio
├── .env                     # Variables locales (Vercel usa el dashboard)
├── package.json             # Root npm workspaces
└── README.md
```

---

## ⚡ Motor Multi-IA Resiliente

Para garantizar alta disponibilidad y cero costos operativos:
- **Sin SDKs pesados:** Llamadas HTTP directas vía `fetch` nativo de Node.js compatibles con la API de OpenAI.
- **Proveedores en Pool:**
  - 🟢 **Groq:** `llama-3.1-8b-instant`
  - 🟠 **Cloudflare Workers AI:** `@cf/meta/llama-3.1-8b-instruct-fast`
  - 🔵 **Google Gemini:** `gemini-2.5-flash`
- **Round-Robin con Fallback Automático:** Distribuye peticiones entre proveedores y conmuta automáticamente si alguno alcanza rate limit (429), errores 5xx o timeout (>4.5s).

---

## 🚀 Inicio Rápido y Desarrollo Local

### 1. Requisitos Previos
- Node.js 20+
- npm 10+

### 2. Instalación
Desde la raíz del proyecto, instala las dependencias de todos los workspaces:
```bash
npm install
```

### 3. Variables de Entorno

El proyecto gestiona variables en tres archivos `.env` independientes según el contexto:

| Archivo | Ámbito y Propósito |
|---|---|
| `.env` (raíz) | Variables locales/legado. Vercel no lo lee: usá Environment Variables del proyecto. |
| `backend/.env` | Variables para el desarrollo local del backend (`npm run dev:back`). |
| `frontend/.env` | Variables para el frontend en desarrollo local (`npm run dev:front`). |
| `frontend/.env.production` | `VITE_API_URL=/` para que el build de producción llame al mismo dominio. |

#### Tabla Completa de Variables de Entorno

##### ⚙️ Configuración del Juego y Núcleo

| Variable | Requerida | Valores Admitidos | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `WIFI_PASS` | **Sí** | Cualquier cadena de texto (ej. `OrnitorrincoLunar7$`) | *Ninguno* (lanza error si falta) | Contraseña secreta del WiFi para el CTF (tanto Nivel 1 como Nivel 2). Aliases de fallback: `WIFI_PASS_LEVEL_1`, `WIFI_PASS_LEVEL_2`, `Contrasena_WIFI`. |
| `LEVEL1_ENGINE` | No | `v2` \| `v1` \| `shadow` | `v2` | Motor de arbitraje para el Nivel 1 (Lucas):<br>• `v2`: Motor determinista (backend arbitra fragmentos, pistas y victoria).<br>• `v1`: Motor legado / rollback.<br>• `shadow`: Responde con `v1` pero loguea y evalúa métricas de `v2`. |
| `REVEAL_WORD_TO_MODEL` | No | `true` \| `false` | `true` | Modo A/B para el system prompt en Nivel 1:<br>• `true`: Expone la palabra activa en el prompt para pistas más creativas.<br>• `false`: Oculta la palabra al LLM para blindar contra fugas en el modelo. |
| `PORT` | No | Entero positivo (ej. `3000`, `8080`) | `3000` | Puerto HTTP para el servidor local del backend (`@hono/node-server`). |
| `ALLOWED_ORIGIN` | No | `*` o URLs separadas por coma | `*` | Orígenes permitidos en cabeceras CORS de Hono (ej. `http://localhost:5173`). |
| `NODE_ENV` | No | `development` \| `production` \| `test` | `development` | Entorno de ejecución de Node.js. |

##### 🤖 Proveedores de IA (Pool Round-Robin con Fallback)

> 💡 **Nota:** Debe configurarse al menos **un proveedor** con sus credenciales activas. Si un proveedor no tiene API key configurada, se excluye automáticamente del pool sin generar error.

| Variable | Proveedor | Valores Admitidos | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `GROQ_API_KEY` | Groq | Clave con formato `gsk_...` | *Venta vacía* (deshabilitado) | API Key de Groq Cloud. |
| `GROQ_MODEL` | Groq | Modelos compatibles con Groq (ej. `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `qwen/qwen3.8-27b`) | `llama-3.1-8b-instant` | Modelo LLM a utilizar en Groq. |
| `CF_ACCOUNT_ID` | Cloudflare | Hash alfanumérico de 32 caracteres | *Venta vacía* (deshabilitado) | ID de cuenta de Cloudflare Dashboard. |
| `CF_API_KEY` | Cloudflare | Token de API con permisos Workers AI | *Venta vacía* (deshabilitado) | Token de autorización de Cloudflare. Alias: `CLOUDFLARE_API_KEY`. |
| `CF_MODEL` | Cloudflare | Modelos Workers AI (ej. `@cf/meta/llama-3.1-8b-instruct-fp8`, `@cf/meta/llama-3.1-8b-instruct-fast`) | `@cf/meta/llama-3.1-8b-instruct-fp8` | Modelo de Cloudflare Workers AI. Alias: `CLOUDFLARE_MODEL`. |
| `GEMINI_API_KEY` | Google Gemini | Clave de Google AI Studio (`AIzaSy...`) | *Venta vacía* (deshabilitado) | API Key para la API de Google Gemini. |
| `GEMINI_MODEL` | Google Gemini | Modelos de Gemini (ej. `gemini-3.1-flash-lite`, `gemini-2.5-flash`) | `gemini-3.1-flash-lite` | Modelo de Google Gemini a utilizar. |

##### 🌐 Frontend

| Variable | Requerida | Valores Admitidos | Valor por Defecto | Descripción |
|---|---|---|---|---|
| `VITE_API_URL` | **Sí** | URL HTTP/HTTPS (ej. `http://localhost:3000`, `https://<id>.lambda-url.us-east-2.on.aws`) | *Ninguno* | URL base del backend para llamadas de API desde el cliente. |

#### Ejemplo de Archivos de Entorno

* **`backend/.env` (Desarrollo Local):**
  ```env
  PORT=3000
  NODE_ENV=development
  ALLOWED_ORIGIN=*
  
  # Contraseña del CTF
  WIFI_PASS=OrnitorrincoLunar7$
  LEVEL1_ENGINE=v2
  REVEAL_WORD_TO_MODEL=true
  
  # Proveedores IA (configurar al menos uno)
  GROQ_API_KEY=gsk_tu_clave_aqui
  GROQ_MODEL=llama-3.1-8b-instant
  
  CF_ACCOUNT_ID=tu_account_id_aqui
  CF_API_KEY=tu_cf_token_aqui
  CF_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8
  
  GEMINI_API_KEY=AIzaSy_tu_clave_aqui
  GEMINI_MODEL=gemini-3.1-flash-lite
  ```

* **`frontend/.env` (Desarrollo Local):**
  ```env
  VITE_API_URL=http://localhost:3000
  ```

* **`frontend/.env.production` (Producción):**
  ```env
  VITE_API_URL=https://tu-lambda-url.lambda-url.us-east-2.on.aws
  ```

### 4. Comandos de Ejecución

Desde la raíz del monorepo:

| Comando | Descripción |
|---|---|
| `npm run dev:back` | Inicia el backend en `http://localhost:3000` (tsx + hot reload) |
| `npm run dev:front` | Inicia el frontend en `http://localhost:5173` (Vite dev server) |
| `npm run test:back` | Ejecuta las pruebas unitarias del backend con Vitest |
| `npm run test:front` | Ejecuta las pruebas del frontend |
| `npm run build:back` | Compila el backend Node autocontenido (`backend/dist/index.mjs`) |
| `npm run build:front` | Compila el frontend para producción (`frontend/dist`) |

---

## ☁️ Despliegue en Vercel

El proyecto se despliega como **un solo proyecto de Vercel con Services**:

- `/api/*` → `backend` (Hono).
- `/*` → `frontend` (Vite).
- Un único dominio; no hay CORS entre frontend y API.
- La configuración vive en `vercel.json`.

### Variables de entorno en Vercel

En **Project Settings → Environment Variables**:

| Variable | Servicio | Valor |
|---|---|---|
| `WIFI_PASS` | backend | contraseña del CTF, **sin las comillas simples** del `.env` |
| `GROQ_API_KEY` | backend | API key de Groq |
| `GEMINI_API_KEY` | backend | API key de Gemini |
| `CF_ACCOUNT_ID` | backend | Account ID de Cloudflare |
| `CF_API_KEY` | backend | API token de Workers AI |
| `GROQ_MODEL`, `CF_MODEL`, `GEMINI_MODEL` | backend | modelos |
| `LEVEL1_ENGINE` | backend | `v2` |
| `REVEAL_WORD_TO_MODEL` | backend | `true` |
| `ALLOWED_ORIGIN` | backend | `*` |
| `VITE_API_URL` | frontend | `/` |

### Deploy

```bash
npm install -g vercel
vercel login
vercel --prod
```

O conectá el repositorio en el dashboard de Vercel y hacé push a `main`.
