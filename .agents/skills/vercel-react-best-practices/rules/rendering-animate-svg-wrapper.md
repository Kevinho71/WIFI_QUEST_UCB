---
title: Animate SVG Wrapper Instead of SVG Element
impact: LOW
impactDescription: smoother SVG animations on some browsers
tags: rendering, svg, css, animation, performance
---

## Animate SVG Wrapper Instead of SVG Element

Chromium has GPU-accelerated CSS animations on SVG elements by default since Chrome 89 (2021), and Firefox before that — so animating an SVG directly is fine today. The wrapper trick is a cheap micro-optimization that still helps in a few edge cases (e.g. Safari quirks or complex animated SVG graphs), but don't treat it as a requirement.

**Incorrect (animating SVG directly — fine on modern browsers, can be janky in edge cases):**

```tsx
function LoadingSpinner() {
  return (
    <svg 
      className="animate-spin"
      width="24" 
      height="24" 
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" />
    </svg>
  )
}
```

**Correct (animating a wrapper div for edge-case smoothness):**

```tsx
function LoadingSpinner() {
  return (
    <div className="animate-spin">
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" />
      </svg>
    </div>
  )
}
```

This applies to all CSS transforms and transitions (`transform`, `opacity`, `translate`, `scale`, `rotate`). Animating the wrapper div avoids SVG-specific rendering quirks in some browsers and can be smoother for complex animated SVGs.
