# AGENTS.md

WIFI QUEST: CTF universitario de prompt-injection (Gandalf-style). Monorepo npm workspaces (`backend` + `frontend`), stateless, AWS Free Tier (Lambda Function URL + S3/CloudFront). Docs, comentarios y mensajes en español.

## Comandos

Root (workspaces; `npm install` solo desde la raíz):

```bash
npm run dev:back    # http://localhost:3000 (tsx + hot reload)
npm run dev:front   # http://localhost:5173 (Vite)
npm run test:back   # Vitest backend
npm run test:front  # Vitest frontend
npm run build:back  # esbuild -> backend/dist/index.mjs (Lambda)
npm run build:front # tsc -b && vite build -> frontend/dist
```

Un solo test, desde el workspace correspondiente:

```bash
# en backend/
npx vitest run tests/engine/session.test.ts
# en frontend/
npx vitest run src/tests/api.test.ts
```

**Asimetrías que despistan:**
- `lint` (oxlint) solo existe en frontend; `typecheck` (`tsc --noEmit`) solo en backend.
- En frontend no hay script typecheck: `npm run build` corre `tsc -b`.
- Backend tests en `backend/tests/` (incluye `tests/engine/`); frontend tests en `src/tests/`.
- No hay scripts raíz para lint/typecheck: `npm --workspace=backend run typecheck`, `npm --workspace=frontend run lint`.

## Entorno

- `backend/.env` es el que cargan `dev` (`tsx --env-file=.env`) y los tests. Sin ese archivo `dev:back` falla; parte de `backend/.env.example`.
- `frontend/.env` debe definir `VITE_API_URL=http://localhost:3000`; si falta, el cliente usa `''` y pega contra el propio origen de Vite. `frontend/.env.production` se usa en el build. Los cuatro `.env` reales están gitignored.
- El `.env` de la raíz **no lo usa** `deploy.ps1`: las variables de Lambda se configuran en AWS. Editarlo no cambia producción.
- `WIFI_PASS` es obligatoria para `/api/verify`; `getWifiPassword()` cae a `WIFI_PASS_LEVEL_1` → `WIFI_PASS_LEVEL_2` → `Contrasena_WIFI` y lanza error si no hay ninguna.
- `LEVEL1_ENGINE`: `v2` (default) | `v1` (rollback) | `shadow` (responde v1, loguea v2). `REVEAL_WORD_TO_MODEL` (default `true`) controla si la palabra activa va en el prompt del Nivel 1.
- Pool IA sin SDKs (`fetch` OpenAI-compatible): `GROQ_API_KEY`, `CF_ACCOUNT_ID` + `CF_API_KEY`, `GEMINI_API_KEY`. Si falta una key, ese proveedor se salta; modelos por `GROQ_MODEL`, `CF_MODEL`, `GEMINI_MODEL`.
- Los tests no necesitan keys reales: mockean `aiProvider` con `vi.mock` y definen `WIFI_PASS` en cada archivo. No agregues tests que llamen proveedores reales.

## Arquitectura (backend)

- `backend/src/index.ts`: app Hono + CORS + rate limiter en memoria (15 req/min/IP); exporta `handler` para Lambda. El servidor local solo arranca si no hay `AWS_LAMBDA_FUNCTION_NAME`/`LAMBDA_TASK_ROOT` ni `NODE_ENV=test`/`VITEST`.
- **Nivel 1 (Lucas)** usa el motor determinista v2 en `backend/src/engine/`: `blueprint.ts`, `session.ts` (replay), `events.ts`, `matching.ts`/`intent.ts`, `guards.ts`/`templates.ts`, `orchestrator.ts` (`processLevel1V2`). **El backend arbitra veredictos, progreso y victoria; el LLM solo redacta la voz de Lucas.**
- El motor reconstruye el estado desde el historial y no confía en `userTurnNumber` ni en el estado del cliente. `sessionSeed` (generada por partida en el front) aleatoriza orden/ids de fragmentos y debe reenviarse idéntica en cada turno para que el replay coincida.
- **Nivel 2 (Atenea/Firewall Centinela)** en `backend/src/services/securityLevels.ts` + `leakDetector.ts`. Recibe el historial completo; el Nivel 1 recibe una ventana de 6 (v2 además recibe el historial completo para el replay).
- `fragmentService.ts` tokeniza la clave y evalúa fragmentos/ensamblaje; lo comparten v1 y v2. La comparación en el chat es normalizada (mayúsculas/tildes/espacios); `/api/verify` exige coincidencia exacta tras `trim()`.

### Quirk ESM obligatorio

Backend usa `module: NodeNext`: los imports relativos llevan extensión `.js` aunque el fuente sea `.ts` (ej. `from './types/index.js'`). Mantenlo en imports nuevos. El build (esbuild) inyecta un banner `createRequire` para Lambda.

## Frontend

- Vite + React 19 + Tailwind **v4** vía `@tailwindcss/vite`; no hay `tailwind.config.js`, el tema vive en `src/index.css`.
- shadcn/ui (`components.json`, style `radix-nova`, iconos `lucide`).
- Alias `@/*` → `src/*` y `cn` → `src/lib/utils.ts` (en `vite.config.ts` y `tsconfig.app.json`).
- **Tests en node sin jsdom**: usan `renderToStaticMarkup` (SSR). Vitest toma `vite.config.ts`, por eso resuelven `@`/`cn`.
- **El progreso vive solo en memoria**: no se persisten mensajes, nivel, seed, gameState ni timer. Al refrescar o salir se reinicia la partida; `clearLegacyGameStorage()` (en `main.tsx`) borra las claves viejas y conserva `wifi_quest_muted` (preferencia de audio). `clearHistory`/`switchLevel` regeneran la seed y resetean mensajes en memoria.

## Deploy y repo

- `deploy.ps1` está gitignored (solo local): compila backend → `function.zip` → `aws lambda update-function-code`, luego frontend → `aws s3 sync` + invalidación CloudFront. Requiere AWS CLI.
- `.agents/` también está gitignored: las skills (p. ej. `gitflow-workflow`) existen solo en local, no en el repo.
- `main` es la rama de integración; trabajar en `feat/*`/`fix/*` y abrir PR contra `main`. Conventional Commits y tests antes de commit.
- No hay workflows de CI en `.github/`: la verificación es local (typecheck, lint, tests, build).
- `README.md` menciona `PLAN.md` y `GUIA_DESPLIEGUE_AWS.md`, que no existen; tampoco hay `PLAN_*.md` en la raíz actualmente.
