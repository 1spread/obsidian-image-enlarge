# [P3-2] DONE: `calculateFitSize` called twice for cached images

**Priority:** P3 — Nice-to-have
**File:** `main.ts:73-78`
**Status:** Fixed

## Problem

Original code set `onload` callback and then immediately checked `realImg.complete`, potentially
calling `calculateFitSize` twice for already-cached images.

## Fix

Used `if/else` pattern — `onload` is only set if the image is not yet complete:

```typescript
if (imgView.complete && imgView.naturalWidth > 0) {
  this.calculateFitSize(imgView);
} else {
  imgView.onload = () => { ... };
}
```
