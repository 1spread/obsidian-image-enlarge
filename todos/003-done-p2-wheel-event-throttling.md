# [P2-1] DONE: wheel event RAF throttling

**Priority:** P2 — Important
**File:** `main.ts:102-111`
**Status:** Fixed

## Problem

Wheel events fired up to 120 times/sec on high-refresh displays.
`getBoundingClientRect()` read + 4 style writes ran synchronously, causing layout thrashing.

## Fix

Added `requestAnimationFrame` throttling. New events cancel the pending RAF and reschedule,
so only the latest event per frame is processed:

```typescript
if (this.rafId !== null) cancelAnimationFrame(this.rafId);
this.rafId = requestAnimationFrame(() => {
  this.rafId = null;
  this.zoom(ratio, { offsetX, offsetY });
  this.applyTransform(imgView);
});
```

RAF is cancelled in `closeOverlay` to prevent stale callbacks.
