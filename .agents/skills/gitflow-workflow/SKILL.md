---
name: gitflow-workflow
description: 'The user''s branching, commit, testing-gate, and pull-request workflow: create feat/fix/chore/refactor/docs/test branches from the project''s actual integration branch (auto-detected, not assumed), run the project''s test suite before allowing a commit, use Conventional Commits messages (scoped by back/front in monorepos), and open the PR/MR against the integration branch — never commit directly to it. Use whenever asked to start a new feature, fix a bug, prepare a commit, or open a pull/merge request.'
---

# Flujo de ramas, commits y PRs

Convención personal del usuario, transversal a todos sus proyectos. Aplica siempre que la tarea implique empezar trabajo nuevo, corregir algo, comitear, o abrir un PR/MR — sin importar el repo.

## 1. Detectar la rama de integración (nunca asumir el nombre)

Antes de crear cualquier rama, identifica cuál es la rama principal de ese proyecto:

```bash
git branch -r
```

Busca, en este orden de prioridad, la primera que exista: `development`, `develop`, `dev`, `main`, `master`. Esa es la base para ramas nuevas y el destino del PR/MR. No la des por hecha de memoria de una conversación anterior — cada repo puede variar.

## 2. Prefijos de rama

| Prefijo | Uso |
|---|---|
| `feat/` | Funcionalidad nueva |
| `fix/` | Corrección de bug |
| `chore/` | Tareas de mantenimiento (deps, config, limpieza) sin cambio de comportamiento |
| `refactor/` | Reestructuración de código sin cambiar comportamiento externo |
| `docs/` | Solo documentación |
| `test/` | Solo agregar/ajustar tests |

Nombre de rama: `<prefijo>/<descripcion-corta-en-kebab-case>`. Ejemplo: `feat/login-social`, `fix/validacion-email`.

Crear la rama siempre partiendo de la integración actualizada:

```bash
git checkout <rama-integracion>
git pull
git checkout -b feat/nombre-descriptivo
```

## 3. Antes de comitear: correr los tests

No se commitea sin correr el test suite del proyecto primero. Detecta el comando según lo que haya en el repo:

- **Backend Spring Boot** (hay `pom.xml`): `mvn test`
- **Backend con Gradle** (hay `build.gradle`): `./gradlew test`
- **Frontend** (hay `package.json`): revisa el script `test` (`npm test` o `npm run test`)

Si el proyecto tiene ambos (monorepo o repos separados back/front en la misma tarea), corre los dos. **Si algo falla, no se commitea** — se corrige primero. No saltarse este paso ni con `--no-verify` ni de ninguna otra forma salvo que el usuario lo pida explícitamente para ese commit puntual.

## 4. Mensaje de commit: Conventional Commits

Formato: `<tipo>(<alcance opcional>): <descripción en presente, minúscula, sin punto final>`

El `<tipo>` corresponde al prefijo de la rama (`feat`, `fix`, `chore`, `refactor`, `docs`, `test`). Ejemplos:

```
feat(auth): agrega login con Google
fix(pagos): corrige redondeo en el cálculo de comisión
```

Commits cortos y enfocados — un cambio lógico por commit, no un commit gigante acumulando toda la rama. Si el trabajo de la rama tiene varios cambios lógicos distintos, son varios commits, no uno solo al final.

### Monorepos back+front (deploy vía Dokploy/compose)

Varios proyectos del usuario son monorepo: backend y frontend en el mismo repositorio, deployados juntos como un servicio compose en Dokploy. En ese caso, **el commit no deja de ser uno por cambio lógico** — la regla no cambia por ser monorepo. Lo que sí cambia:

- **Stagear solo lo que corresponde al cambio actual** (`git add backend/...` o `git add frontend/...`), nunca `git add .` a ciegas cuando el cambio real fue solo de un lado. Si efectivamente se tocó back y front para la misma feature de forma inseparable, ahí sí va todo en un commit — pero es la excepción, no la norma.
- **Usar el scope del commit para indicar el lado**: `feat(back): ...` / `feat(front): ...` en vez de omitir el scope o mezclar cambios de ambos sin marcarlo. Esto deja el historial filtrable por lado (`git log --grep '(back)'`) aunque viva en un solo repo, sin necesidad de separar en dos repositorios.

## 5. Pull Request / Merge Request

- Se empuja la rama (`git push -u origin <rama>`) y se abre el PR/MR **contra la rama de integración detectada en el paso 1**, nunca contra `main`/`master` a menos que esa sea la propia rama de integración del proyecto.
- **Nunca commits directos sobre la rama de integración** — siempre vía rama + PR/MR, incluso para cambios pequeños.
- Usa `gh pr create` (GitHub) o `glab mr create` (GitLab, instancia de la universidad) según corresponda al remoto del proyecto — no hace falta herramienta adicional a la ya instalada.
- Título del PR: mismo formato que el commit principal (`tipo(scope): descripción`). Descripción: breve resumen de qué cambia y por qué, más un checklist de qué se probó (equivalente a lo hecho en el paso 3).

## 6. Resumen del flujo completo

1. Detectar rama de integración → actualizarla (`pull`).
2. Crear rama con el prefijo correcto desde ahí.
3. Trabajar, y antes de cada commit correr los tests correspondientes (back y/o front). Si fallan, no comitear.
4. Commits cortos, formato Conventional Commits, con scope `(back)`/`(front)` cuando el repo es monorepo.
5. Push + PR/MR contra la rama de integración. Nunca commit directo ahí.
