# [P2-10] DONE: unexplained magic number `100`

**Priority:** P2 — Important
**File:** `main.ts:128`
**Status:** Fixed

## Problem

`winH - 100` — the value `100` had no explanation. Unclear what vertical space it reserved.

## Fix

Extracted to a named constant:

```typescript
const BUTTON_AREA_HEIGHT = 100; // bottom button group clearance
```
