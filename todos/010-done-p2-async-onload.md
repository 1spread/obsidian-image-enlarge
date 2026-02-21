# [P2-8] DONE: unnecessary `async` on `onload()`

**Priority:** P2 — Important
**File:** `main.ts:28`
**Status:** Fixed

## Problem

`async onload()` had no `await` expressions. The `async` keyword unnecessarily wrapped the
return value in a Promise.

## Fix

Removed `async`:

```typescript
onload() {
  document.on('click', IMG_SELECTOR, this.handleImageClick);
  this.register(() => document.off('click', IMG_SELECTOR, this.handleImageClick));
}
```
