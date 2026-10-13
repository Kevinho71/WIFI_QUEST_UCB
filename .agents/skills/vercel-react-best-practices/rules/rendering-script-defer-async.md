---
title: Use defer or async on Script Tags
impact: HIGH
impactDescription: eliminates render-blocking
tags: rendering, script, defer, async, performance
---

## Use defer or async on Script Tags

**Impact: HIGH (eliminates render-blocking)**

Script tags without `defer` or `async` block HTML parsing while the script downloads and executes. This delays First Contentful Paint and Time to Interactive.

- **`defer`**: Downloads in parallel, executes after HTML parsing completes, maintains execution order
- **`async`**: Downloads in parallel, executes immediately when ready, no guaranteed order

Use `defer` for scripts that depend on DOM or other scripts. Use `async` for independent scripts like analytics.

**Incorrect (blocks rendering):**

```tsx
export default function Document() {
  return (
    <html>
      <head>
        <script src="https://example.com/analytics.js" />
        <script src="/scripts/utils.js" />
      </head>
      <body>{/* content */}</body>
    </html>
  )
}
```

**Correct (non-blocking):**

```tsx
export default function Document() {
  return (
    <html>
      <head>
        {/* Independent script - use async */}
        <script src="https://example.com/analytics.js" async />
        {/* DOM-dependent script - use defer */}
        <script src="/scripts/utils.js" defer />
      </head>
      <body>{/* content */}</body>
    </html>
  )
}
```

The examples above use the legacy Pages Router `pages/_document.jsx` convention (raw `<html>/<head>/<body>`). In the App Router, don't hand-roll script tags in a page — use `next/script`.

**Next.js App Router:**

```tsx
// app/layout.tsx — beforeInteractive only works here (or in pages/_document).
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Independent script - load after hydration */}
        <Script src="https://example.com/analytics.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
```

`strategy="beforeInteractive"` is only supported inside `app/layout.tsx` (or legacy `pages/_document.jsx`) — placing it in a regular page triggers the `no-before-interactive-script-outside-document` lint error and won't run as intended. For third-party scripts, `afterInteractive` is the safe default.

Reference: [MDN - Script element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#defer)
