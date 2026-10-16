# AGENTS.md

WIFI QUEST: CTF universitario de prompt-injection (Gandalf-style). Monorepo npm workspaces (`backend` + `frontend`), stateless, AWS Free Tier (Lambda Function URL + S3/CloudFront). Docs y comentarios en español.

## Comandos

Root (`package.json` tiene workspaces; `npm install` se hace desde la raíz):

```bash
npm run dev:back    # backend en http://localhost:3000 (tsx + hot reload)
npm run dev:front   # frontend en http://localhost:5173 (Vite)
npm run test:back   # Vitest (backend)
npm run test:front  # Vitest (frontend)
npm run build:back  # esbuild -> backend/dist/index.mjs (para Lambda)
npm run build:front # tsc -b && vite build -> frontend/dist
```

Por workspace:

- Backend (`backend/`): `dev`, `test` (vitest run), `test:watch`, `typecheck` (`tsc --noEmit`), `build`.
- Frontend (`frontend/`): `dev`, `build`, `lint` (oxlint), `test`.

**Asimetrías que despistan:**
- `lint` solo existe en frontend (oxlint, config en `frontend/.oxlintrc.json`). El backend no tiene lint.
- `typecheck` solo existe en backend. En frontend no hay script typecheck; usa `npm run build` (corre `tsc -b`).
- Test único: `vitest run <archivo>` dentro del workspace correspondiente.

## Variables de entorno (tres `.env`, no mezclar)

| Archivo | Uso |
|---|---|
| `.env` (raíz) | producción / deploy |
| `backend/.env` | desarrollo local del backend |
| `frontend/.env` | `VITE_API_URL` para desarrollo |

- `WIFI_PASS` es obligatoria para `/api/verify`; `getWifiPassword()` (backend) acepta `WIFI_PASS` → `WIFI_PASS_LEVEL_1` → `WIFI_PASS_LEVEL_2` → `Contrasena_WIFI` (en ese orden) y lanza error si ninguna está definida.
- `LEVEL1_ENGINE`: `v2` (default) | `v1` (rollback) | `shadow` (responde v1, loguea v2). Controla el motor del Nivel 1.
- `REVEAL_WORD_TO_MODEL` (bool) activa/desactiva la palabra en el prompt del LLM (A/B test).
- Proveedores round-robin (sin SDKs, `fetch` nativo OpenAI-compatible): `GROQ_API_KEY`, `CF_ACCOUNT_ID` + `CF_API_KEY`, `GEMINI_API_KEY`. Si falta una key, ese proveedor se salta del pool.
- Frontend: `VITE_API_URL` apunta a `http://localhost:3000` en dev; `frontend/.env.production` tiene la Lambda URL real.

## Arquitectura (backend)

- `backend/src/index.ts` = app Hono + rate limiter en memoria (15 req/min/IP). Exporta `handler` para Lambda; el servidor local (`@hono/node-server`) solo arranca si NO está `AWS_LAMBDA_FUNCTION_NAME`/`LAMBDA_TASK_ROOT` ni `NODE_ENV=test`/`VITEST`.
- **Motor Nivel 1 (v2)** en `backend/src/engine/`: determinista; el backend arbitra (veredictos/progreso/victoria) y el LLM solo redacta la voz de Lucas. Piezas: `blueprint.ts`, `session.ts` (replay desde historial, no confía en el turno del cliente), `matching.ts`/`intent.ts`, `guards.ts`/`templates.ts`, `orchestrator.ts` (`processLevel1V2()`).
- Nivel 2 (Firewall Centinela) en `backend/src/services/securityLevels.ts` (guardrails input/output + `leakDetector.ts`).

### Quirk ESM obligatorio

Backend usa `module: NodeNext`; los imports internos llevan extensión `.js` aunque el fuente sea `.ts` (ej. `from './types/index.js'`). Mantén esa convención en imports relativos nuevos. El build (esbuild) inyecta un `createRequire` banner para Lambda.

## Frontend

- Vite + React 19 + Tailwind **v4** (via plugin `@tailwindcss/vite`; no hay `tailwind.config.js`). Config CSS en `src/index.css`.
- shadcn/ui (`components.json`, style `radix-nova`, iconLibrary `lucide`).
- Alias: `@/*` → `src/*` y `cn` → `src/lib/utils.ts` (definidos en `vite.config.ts` y `tsconfig.app.json`).
- **Tests de frontend corren en node sin jsdom**: usan `renderToStaticMarkup` (SSR). Los alias `@`/`cn` se resuelven porque Vitest usa `vite.config.ts`.

## Convenciones y gotchas

- Tests backend no necesitan keys reales: `api.test.ts` mockea `aiProvider` y define `WIFI_PASS` en `beforeEach`. No agregues tests que llamen a proveedores reales.
- `README.md` referencia `PLAN.md` y `GUIA_DESPLIEGUE_AWS.md`, que **no existen**; los planes reales son los `PLAN_*.md` de la raíz.
- Deploy: `deploy.ps1` (PowerShell) compila backend → `function.zip` → `aws lambda update-function-code`, luego frontend → `aws s3 sync` + invalidación CloudFront. Requiere AWS CLI.
- Workflow git: rama de integración + Conventional Commits + correr tests antes de commit → ver skill `gitflow-workflow`; buenas prácticas de backend → skill `backend-best-practices`. Ambas en `.agents/skills/`.
