# [P3-4] DONE: string concatenation in style assignments

**Priority:** P3 — Nice-to-have
**File:** `main.ts:194-197`
**Status:** Fixed

## Problem

`applyTransform` used string concatenation: `info.curWidth + 'px'`.

## Fix

Unified to template literals throughout `applyTransform`:

```typescript
imgView.style.width = `${info.curWidth}px`;
imgView.style.height = `${info.curHeight}px`;
imgView.style.transform = `translate(${info.left}px, ${info.top}px)`;
```
