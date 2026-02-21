# [P2-5] DONE: canvas memory unbounded for large images

**Priority:** P2 — Important
**File:** `main.ts:228-254`
**Status:** Fixed

## Problem

A 6000×4000 image allocated ~96 MB of canvas memory with no upper bound.

## Fix

Added `MAX_CANVAS_DIM = 8192` cap. After `toBlob` completes, canvas is released:

```typescript
const MAX_CANVAS_DIM = 8192;
// Scale down if needed
if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
  const scale = Math.min(MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h);
  w = Math.floor(w * scale);
  h = Math.floor(h * scale);
}
canvas.width = w;
canvas.height = h;
// ...
canvas.toBlob(async (blob) => {
  canvas.width = 0; // release GPU memory
  // ...
});
```
