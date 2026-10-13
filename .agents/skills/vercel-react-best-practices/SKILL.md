---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when creating or scaffolding a brand-new project, or when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, performance improvements, or initializing a new React/Next.js app.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel. Contains 70 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times
- Scaffolding or initializing a brand-new React/Next.js project

## Project Scaffolding

When asked to create a brand-new project, scaffold it with the official CLI instead of hand-writing config. Both CLIs default to TypeScript and run non-interactively once any flag is passed — which matters for automated runs.

- **React SPA (Vite):** `npm create vite@latest <name> -- --template react-ts`
  - The current default linter is **Oxlint** (not ESLint); pass `--eslint` only if ESLint is explicitly required. `--immediate` installs dependencies and starts the dev server; `.` as the name scaffolds into the current directory.
  - After scaffolding, apply the `features/` + `shared/` structure from Project Learnings below — the stock template starts flat.
- **Next.js (App Router):** `npx create-next-app@latest <name>`
  - Defaults are already TypeScript + Tailwind + App Router; flags only pin them explicitly (`--ts --tailwind --app --eslint --import-alias "@/*"`). Useful extras: `--src-dir` (source under `src/`), `--react-compiler` (enables the React Compiler), `--skip-install`, `--empty`.

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- `async-cheap-condition-before-await` - Check cheap sync conditions before awaiting flags or remote values
- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-analyzable-paths` - Prefer statically analyzable import and file-system paths to avoid broad bundles and traces
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- `server-auth-actions` - Authenticate server actions like API routes
- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-dedup-props` - Avoid duplicate serialization in RSC props
- `server-hoist-static-io` - Hoist static I/O (fonts, logos) to module level
- `server-no-shared-module-state` - Avoid module-level mutable request state in RSC/SSR
- `server-serialization` - Minimize data passed to client components
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-parallel-nested-fetching` - Chain nested fetches per item in Promise.all
- `server-after-nonblocking` - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners
- `client-passive-event-listeners` - Use passive listeners for scroll
- `client-localstorage-schema` - Version and minimize localStorage data

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-memo-with-default-value` - Hoist default non-primitive props
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-derived-state-no-effect` - Derive state during render, not effects
- `rerender-functional-setstate` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-simple-expression-in-memo` - Avoid memo for simple primitives
- `rerender-split-combined-hooks` - Split hooks with independent dependencies
- `rerender-move-effect-to-event` - Put interaction logic in event handlers
- `rerender-transitions` - Use startTransition for non-urgent updates
- `rerender-use-deferred-value` - Defer expensive renders to keep input responsive
- `rerender-use-ref-transient-values` - Use refs for transient frequent values
- `rerender-no-inline-components` - Don't define components inside components

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-hydration-suppress-warning` - Suppress expected mismatches
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading state
- `rendering-resource-hints` - Use React DOM resource hints for preloading
- `rendering-script-defer-async` - Use defer or async on script tags

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability
- `js-flatmap-filter` - Use flatMap to map and filter in one pass
- `js-request-idle-callback` - Defer non-critical work to browser idle time

### 8. Advanced Patterns (LOW)

- `advanced-effect-event-deps` - Don't put `useEffectEvent` results in effect deps
- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-init-once` - Initialize app once per app load
- `advanced-use-latest` - useLatest for stable callback refs

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/async-parallel.md
rules/bundle-barrel-imports.md
```

Each rule file contains:
- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

## Project Learnings

Conventions distilled from real codebases that go beyond the Vercel rule catalog. They live here (not inside the prefixed rule files) so the upstream catalog stays intact. These are the highest-leverage, repeatable patterns found when auditing React SPAs.

### Route-level code splitting (`project-lazy-routes`)

Split per app surface with `React.lazy` + `Suspense` when the app has clearly separated audiences (public, admin, authenticated portal) — each surface is a natural lazy-loading boundary. Vite/SPA: `const AdminRoutes = lazy(() => import('./admin'))` wrapped in a `<Suspense fallback={...}>`. Next.js: use `next/dynamic` or App Router `loading.tsx` instead. Audit signal: an `App.tsx` statically importing ~40 pages means every route ships on first load.

### Consistent image lazy-loading (`project-img-lazy`)

Every `<img>` gets `loading="lazy"` (except above-the-fold/LCP images) plus explicit `width`/`height` or an `aspect-*` ratio to prevent CLS. Audit signal: only a small fraction of `<img>` elements carry `loading="lazy"` or explicit dimensions.

### One shared layout per surface (`project-shared-layout`)

Each app surface (landing, admin, portal) gets a single layout component applied uniformly — don't let every page build its own chrome (navbars, sidebars, footers). Audit signal: duplicated nav/sidebar/footer markup across page files.

### Centralized route constants (`project-routes-const`)

Declare routes once in a `ROUTES` constant object and reference it everywhere; never inline raw path strings in `navigate(...)`, `Link`, or redirect logic. Renames and guards become a one-line change.

### Feature-based folder structure (`project-feature-structure`)

Organize as `features/<domain>/<feature>/` plus a `shared/` folder split by artifact type (`api`, `types`, `constants`, `hooks`, `components`) instead of a flat `pages/` + `components/`. Scales for medium/large React apps and keeps each feature's code cohesive.

### Audit checklist

Before declaring a React app done, or when reviewing one, run through:

- [ ] Count static page imports in the router entry — is each surface lazy-loaded?
- [ ] `rg "<img" | rg -c "loading=\"lazy\""` — do images have lazy + explicit dimensions?
- [ ] Is there one shared layout per surface, or duplicated chrome?
- [ ] `rg "navigate\('/[a-z]|to=\"/[a-z]"` — any inline route strings instead of `ROUTES`?
- [ ] Does the folder structure match `features/` + `shared/`?

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
