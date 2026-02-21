# [P2-6] DONE: crossOrigin set for file:// URLs

**Priority:** P2 — Important
**File:** `main.ts:224-226`
**Status:** Fixed

## Problem

Setting `crossOrigin = 'anonymous'` on `file://` URLs can taint the canvas and cause
`SecurityError` when calling `toBlob`.

## Fix

Skip `crossOrigin` for local file URLs:

```typescript
const isFileUrl = imgView.src.startsWith('file:');
if (!isFileUrl) {
  image.crossOrigin = 'anonymous';
}
```
