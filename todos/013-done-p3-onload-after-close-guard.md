# [P3-1] DONE: `imgView.onload` could fire after overlay closed

**Priority:** P3 — Nice-to-have
**File:** `main.ts:73`
**Status:** Fixed

## Problem

If the overlay was closed before the image finished loading, the `onload` callback would still
fire and try to call `calculateFitSize` on a detached/null overlay.

## Fix

Added early-return guard in the `onload` callback:

```typescript
imgView.onload = () => {
  if (!this.overlayEl) return; // overlay closed before image loaded
  this.calculateFitSize(imgView);
};
```
