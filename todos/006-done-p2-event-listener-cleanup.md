# [P2-4] DONE: anonymous event listeners couldn't be removed in closeOverlay

**Priority:** P2 — Important
**File:** `main.ts:81-123`
**Status:** Fixed

## Problem

`overlay`, `imgView`, `copyBtn`, `copyPathBtn` listeners were anonymous closures — no reference
available for `removeEventListener`. `closeOverlay` only removed the DOM element, leaving
listeners in memory.

## Fix

Used `AbortController` pattern. All listeners share a `signal`, and `closeOverlay` calls `abort()`:

```typescript
const controller = new AbortController();
this.overlayAbortController = controller;
const { signal } = controller;

overlay.addEventListener('click', handler, { signal });
imgView.addEventListener('wheel', handler, { signal });
// ...

// In closeOverlay:
this.overlayAbortController.abort();
```
