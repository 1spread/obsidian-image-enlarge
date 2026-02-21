# [P2-7] DONE: dead code `currentImgSrc` field

**Priority:** P2 — Important
**File:** `main.ts:19, 40`
**Status:** Fixed

## Problem

`private currentImgSrc = ''` was set in `openOverlay` but never read anywhere.
Confusing dead code.

## Fix

Removed the field entirely.
