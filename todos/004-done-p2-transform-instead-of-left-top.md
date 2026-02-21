# [P2-2] DONE: use `transform: translate()` instead of `left`/`top`

**Priority:** P2 — Important
**File:** `main.ts:192-198`, `styles.css:18-24`
**Status:** Fixed

## Problem

`position: absolute` + `left`/`top` changes triggered layout recalculation on every frame.
GPU compositing was not used.

## Fix

Changed `applyTransform` to use `transform: translate()`:

```typescript
imgView.style.transform = `translate(${info.left}px, ${info.top}px)`;
```

CSS updated to anchor image at `top: 0; left: 0` so transform is applied from origin.
Layout is now GPU-composited — no reflow on position updates.
