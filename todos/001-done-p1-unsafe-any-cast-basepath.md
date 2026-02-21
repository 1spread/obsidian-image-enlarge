# [P1-1] DONE: unsafe `as any` cast for basePath

**Priority:** P1 — Critical
**File:** `main.ts:205`
**Status:** Fixed

## Problem

`(this.app.vault.adapter as any).basePath` accessed a private internal property via `any` cast.
No type safety; would silently return `undefined` on Obsidian version changes.

## Fix

Used `instanceof FileSystemAdapter` guard with the public `getBasePath()` API:

```typescript
import { FileSystemAdapter } from 'obsidian';
const vaultBasePath = this.app.vault.adapter instanceof FileSystemAdapter
  ? this.app.vault.adapter.getBasePath()
  : null;
```
