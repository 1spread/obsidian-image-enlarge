# [P1-2] DONE: zoom state not updated on minimum size clamp

**Priority:** P1 — Critical
**File:** `main.ts:175-184`
**Status:** Fixed

## Problem

When clamping to minimum size, `return` was called before updating `info.curWidth`/`info.curHeight`.
Internal state diverged from display; subsequent zooms used stale values as the starting point.

## Fix

Added `info.curWidth = newW; info.curHeight = newH;` before `return`:

```typescript
if (newW < IMG_VIEW_MIN || newH < IMG_VIEW_MIN) {
  // ... clamp logic ...
  info.curWidth = newW;
  info.curHeight = newH;
  return;
}
```
