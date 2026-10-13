---
name: cicd-pipelines
description: "Kevin's convention for writing and maintaining CI pipeline files — GitHub Actions (.github/workflows/*.yml) or GitLab CI (.gitlab-ci.yml), detected from the project's git remote. Covers pipeline triggers, the quality-gate job shape (lint/test/build/security/docker-build) for Spring Boot backends and React/shadcn frontends, path filtering for back+front monorepos, and secrets handling. Use whenever asked to add, fix, or review a CI pipeline, set up GitHub Actions or GitLab CI, or make tests run automatically on push. Does not cover branch/commit/PR conventions (see gitflow-workflow) or local Docker containers (see docker-local-db)."
---

# Pipelines de CI: GitHub Actions y GitLab CI

Convención personal de Kevin para el archivo de pipeline en sí (`.github/workflows/*.yml` o `.gitlab-ci.yml`). Esta skill no decide nombres de rama, formato de commit ni el flujo de PR/MR — eso ya lo cubre `gitflow-workflow`; aquí solo se referencia. Tampoco cubre contenedores locales de desarrollo — eso es `docker-local-db`. Esta skill se enfoca únicamente en qué corre en CI y cómo está estructurado el archivo de pipeline.

## 1. Detectar la plataforma de CI

No asumas cuál usa el proyecto — revisa el remoto:

```bash
git remote -v
```

- Remoto en `github.com` → **GitHub Actions**, archivo en `.github/workflows/ci.yml`.
- Remoto en un host de GitLab (ej. `git.alexa.tja.ucb.edu.bo`, `gitlab.com`) → **GitLab CI**, archivo en `.gitlab-ci.yml` en la raíz del repo.

Si el repo ya tiene un pipeline existente en cualquiera de las dos rutas, léelo primero — modifícalo respetando su estructura en vez de reescribirlo desde cero, salvo que Kevin pida explícitamente rehacerlo.

## 2. Cuándo dispara el pipeline

El pipeline corre en **cada push a cualquier rama** (`feat/*`, `fix/*`, `chore/*`, etc.), no solo al abrir el PR/MR — Kevin prefiere ver el resultado de CI apenas empuja, sin esperar a abrir el pull/merge request. No hace falta duplicar el trigger para PR/MR: correr en push ya cubre ese caso porque el PR apunta a una rama que ya corrió.

**GitHub Actions:**
```yaml
on:
  push:
    branches: ['**']
```

**GitLab CI:** por defecto un pipeline sin regla `rules`/`only`/`except` ya corre en cada push a cualquier rama — no hace falta configuración extra salvo que quieras excluir alguna rama puntual.

## 3. Alcance: solo CI, nunca deploy

Dokploy ya escucha el repo directamente vía webhook y hace el deploy solo cuando detecta push a la rama de integración — **el pipeline de CI nunca debe llamar a Dokploy ni construir/publicar la imagen final de producción**. Su único trabajo es ser un gate de calidad: si algo falla, avisa antes de que ese código llegue a la rama que Dokploy vigila. No agregues jobs de `deploy`, `notify`, ni webhooks salvo que Kevin lo pida explícitamente para un caso puntual.

## 4. Monorepo back+front: path filters

Los proyectos de Kevin son casi siempre monorepo (backend Spring Boot + frontend React/shadcn en el mismo repo, deployados juntos vía Dokploy/compose). El pipeline debe evitar correr el job de un lado si ese lado no cambió — más rápido y menos ruido.

**GitHub Actions** — usa `paths` en el trigger para separar jobs, o `dorny/paths-filter` dentro de un job previo si necesitas que ambos jobs vivan en el mismo workflow con más control:

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'

  backend-ci:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ver sección 5

  frontend-ci:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ver sección 5
```

**GitLab CI** — usa `rules: changes` directamente en cada job, sin necesidad de un job intermedio:

```yaml
backend-ci:
  rules:
    - changes:
        - backend/**
  script:
    # ver sección 5

frontend-ci:
  rules:
    - changes:
        - frontend/**
  script:
    # ver sección 5
```

Ajusta las rutas (`backend/**`, `frontend/**`) a la estructura real del repo — algunos proyectos de Kevin usan otros nombres de carpeta (`back/`, `api/`, `web/`, `client/`). Verifica la estructura real (`ls` en la raíz del repo) antes de escribir los filtros.

## 5. Qué corre en cada job

### Backend (Spring Boot)

Detecta la herramienta de build antes de escribir el step:

- `pom.xml` presente → Maven: `mvn -B test` y `mvn -B package` (o `mvn -B verify` si quieres test+package en un solo paso).
- `build.gradle` / `build.gradle.kts` presente → Gradle: `./gradlew test` y `./gradlew build`.

Orden dentro del job: **test antes que build** — si los tests fallan, no tiene sentido gastar tiempo empaquetando. Cachea el repositorio de dependencias (`~/.m2` en Maven, `~/.gradle/caches` en Gradle) para que el pipeline no baje todo desde cero en cada corrida — `actions/setup-java` con `cache: maven` (o `gradle`) lo hace automático en GitHub Actions; en GitLab CI se define manualmente bajo `cache:`.

### Frontend (React/shadcn, TypeScript)

Con `package.json` como referencia:

1. `npm ci` (no `npm install` — en CI siempre `ci`, respeta el lockfile exacto y falla si está desincronizado, que es justo la señal que quieres en un pipeline).
2. `npm run lint` si existe el script.
3. `npm test` / `npm run test` si existe el script.
4. `npm run build` — valida que el build de producción no esté roto.

Igual que en backend: lint y test antes que build.

### Escaneo de seguridad de dependencias

Agrega un paso de auditoría de dependencias conocidas con CVEs, sin bloquear necesariamente el pipeline en severidades bajas (eso generaría demasiado ruido) pero sí en altas/críticas:

- **Frontend**: `npm audit --audit-level=high`.
- **Backend Maven**: OWASP Dependency-Check (`org.owasp:dependency-check-maven`) o, más simple de arrancar, `mvn -B org.owasp:dependency-check-maven:check` si el plugin ya está declarado en el `pom.xml`; si no lo está, avisa a Kevin antes de agregarlo (es una dependencia de build nueva).
- **Backend Gradle**: plugin `org.owasp.dependencycheck`.

Este paso corre en paralelo o después del job de test, nunca antes — no tiene sentido auditar dependencias de un build que ni siquiera compila.

### Build de imagen Docker (sin publicar)

Valida que el `Dockerfile` (o el servicio correspondiente del `docker-compose.yml`) sigue construyendo, pero **sin hacer `push` a ningún registry** — es solo una verificación de que el Dockerfile no está roto, no un paso de release. Usa `docker build .` (o `docker compose build <servicio>` si el proyecto arma la imagen vía compose) apuntando al Dockerfile de cada lado del monorepo que tenga uno.

```yaml
# GitHub Actions, dentro del job correspondiente
- name: Build docker image (no push)
  run: docker build -t ${{ github.repository }}-backend:ci .
```

```yaml
# GitLab CI
docker-build-check:
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t backend-ci .
```

## 6. Secretos: nunca hardcodeados

Cualquier credencial que el pipeline necesite (ej. una base de datos de test, una API key para el escaneo de seguridad) va **siempre** en el mecanismo nativo de secretos de la plataforma, nunca en el YAML ni en variables de entorno con el valor literal:

- **GitHub Actions**: `Settings → Secrets and variables → Actions`, referenciados como `${{ secrets.NOMBRE }}`.
- **GitLab CI**: `Settings → CI/CD → Variables`, referenciados como `$NOMBRE` (marca las sensibles como "Masked" y, si no necesitan estar disponibles en ramas de fork/MR externos, como "Protected").

Si el job de backend necesita una base de datos real para los tests de integración (no siempre — muchos proyectos usan H2 o Testcontainers y no necesitan nada externo), levántala como *servicio* del propio job (`services:` en GitHub Actions, `services:` en GitLab CI con la imagen `postgres`), nunca apuntando a una base de datos real de desarrollo o producción.

## 7. Estructura de referencia completa

Ejemplo mínimo de GitHub Actions combinando todo lo anterior (ajustar rutas y nombres de carpeta al repo real):

```yaml
name: CI

on:
  push:
    branches: ['**']

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      frontend: ${{ steps.filter.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
            frontend:
              - 'frontend/**'

  backend-ci:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'maven'
      - run: mvn -B test
      - run: mvn -B package -DskipTests
      - run: docker build -t backend-ci .

  frontend-ci:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm audit --audit-level=high
      - run: npm run build
```

El equivalente en GitLab CI sigue la misma secuencia por job (`rules: changes` en vez del job `changes` separado, `script:` en vez de `steps:`) — no lo dupliques literal, adapta esta misma lógica a la sintaxis de `.gitlab-ci.yml`.

## 8. Antes de escribir el archivo

1. Confirma la plataforma (paso 1) y si ya existe un pipeline previo que deba respetarse.
2. Confirma la estructura real de carpetas del monorepo (`backend/`, `frontend/` u otros nombres) — no asumas.
3. Confirma la herramienta de build del backend (Maven o Gradle) y si el frontend usa `npm`, `pnpm` o `yarn` (ajusta el comando de instalación y el cache en consecuencia — `npm ci` no aplica igual si el proyecto usa `pnpm-lock.yaml` o `yarn.lock`).
4. Si el job de backend necesita una base de datos para tests de integración, pregunta a Kevin si el proyecto usa Testcontainers/H2 (no necesita nada del pipeline) o una base real como servicio (sí necesita `services:` + secretos).
