# [P2-3] DONE: same image loaded twice

**Priority:** P2 — Important
**File:** `main.ts:71-78`
**Status:** Fixed

## Problem

`imgView.src = src` and `new Image(); realImg.src = src` loaded the same URL twice,
doubling peak memory for large images.

## Fix

Removed `realImg` entirely. `calculateFitSize` now receives `imgView` directly and reads
`naturalWidth`/`naturalHeight` from it after it loads:

```typescript
if (imgView.complete && imgView.naturalWidth > 0) {
  this.calculateFitSize(imgView);
} else {
  imgView.onload = () => {
    if (!this.overlayEl) return;
    this.calculateFitSize(imgView);
  };
}
```
