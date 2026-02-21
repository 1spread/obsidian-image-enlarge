# [P2-9] DONE: tsconfig.json missing `strict: true`

**Priority:** P2 — Important
**File:** `tsconfig.json`
**Status:** Fixed

## Problem

Only 2 of 6 strict TypeScript flags were enabled (`noImplicitAny`, `strictNullChecks`).
Missing: `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`.

## Fix

Replaced both individual flags with `"strict": true`:

```json
{
  "compilerOptions": {
    "strict": true,
    ...
  }
}
```
