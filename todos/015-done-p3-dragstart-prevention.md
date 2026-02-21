# [P3-3] DONE: no dragstart prevention on image

**Priority:** P3 — Nice-to-have
**File:** `main.ts` (openOverlay)
**Status:** Fixed

## Problem

Clicking and dragging the image view triggered browser's native image drag behavior,
interfering with the zoom/pan UX.

## Fix

Added `dragstart` prevention via AbortController signal:

```typescript
imgView.addEventListener('dragstart', (e) => e.preventDefault(), { signal });
```
