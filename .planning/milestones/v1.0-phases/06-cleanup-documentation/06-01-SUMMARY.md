---
phase: 06-cleanup-documentation
plan: 01
subsystem: core-libs, ui-components
tags: [dead-code-removal, component-dedup, tech-debt]
dependency_graph:
  requires: []
  provides:
    - "Clean exportUtils without dead copyToClipboard"
    - "Clean hfSearch without dead fetchAvailableQuantizations"
    - "Consistent BackendBadge labels (API/GPU/WASM) in TestProgress"
  affects:
    - src/lib/exportUtils.ts
    - src/lib/hfSearch.ts
    - src/components/TestProgress/index.tsx
tech_stack:
  added: []
  patterns:
    - "Shared component reuse over local duplication"
key_files:
  modified:
    - src/lib/exportUtils.ts
    - src/lib/hfSearch.ts
    - src/components/TestProgress/index.tsx
decisions:
  - "D-06-01: Keep isCloud variable in TestProgress for configBackend fallback logic"
metrics:
  duration: "2m 20s"
  completed: "2026-04-11T23:09:18Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 06 Plan 01: Dead Code Removal & BackendBadge Dedup Summary

Removed two dead exported functions (copyToClipboard, fetchAvailableQuantizations) and replaced TestProgress local BackendBadge with the shared component for consistent API/GPU/WASM labels across the app.

## Tasks Completed

### Task 1: Remove dead exported functions
**Commit:** d6c6616

Deleted `copyToClipboard` from `src/lib/exportUtils.ts` (replaced by `downloadFile` in Phase 5, decision D-14) and `fetchAvailableQuantizations` plus its JSDoc block from `src/lib/hfSearch.ts` (replaced by `fetchModelDetails` which returns both quantizations and per-quant file sizes). Both functions had zero imports anywhere in the codebase. All remaining exports (`downloadFile`, `formatAsMarkdown`, `formatAsCSV`, `formatAsJSON`, `buildComparisonRun`, `searchModels`, `fetchModelDetails`, `extractQuantizations`) verified intact.

**Files modified:** `src/lib/exportUtils.ts`, `src/lib/hfSearch.ts`

### Task 2: Replace TestProgress local BackendBadge with shared component
**Commit:** 416e18c

Imported the shared `BackendBadge` from `../shared/BackendBadge` and added a `configs` store lookup to resolve the actual backend type from the test config (with `isCloud ? 'api' : 'webgpu'` fallback). Replaced the local `BackendBadge` invocation (`type`/`backend` props) with the shared component's single `backend` prop. Deleted the 14-line local `BackendBadge` function. TestProgress now displays "API" for cloud models, "GPU" for WebGPU models, and "WASM" for WASM models -- matching ComparisonTable, OutputComparison, and all other badge usage.

**Files modified:** `src/components/TestProgress/index.tsx`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc -b --noEmit` | Pass (zero errors) |
| `grep -rn "copyToClipboard" src/` | 0 matches |
| `grep -rn "fetchAvailableQuantizations" src/` | 0 matches |
| `grep -c "function BackendBadge" TestProgress/index.tsx` | 0 (local deleted) |
| `grep "import { BackendBadge }" TestProgress/index.tsx` | 1 match (shared import) |
| `npm run build` | Pass (built in 458ms) |

## Known Stubs

None.

## Self-Check: PASSED

All files exist, all commits verified.
