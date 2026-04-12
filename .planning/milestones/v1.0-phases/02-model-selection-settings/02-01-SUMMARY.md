---
phase: 02-model-selection-settings
plan: 01
subsystem: data-layer
tags: [huggingface-api, cache-api, zustand, typescript, transformers.js]

# Dependency graph
requires:
  - phase: 01-foundation-critical-fixes
    provides: "Working types, hfSearch.ts with searchModels/fetchAvailableQuantizations, useCompareStore with addConfig/removeConfig"
provides:
  - "Extended TestConfig with estimatedSize and cached fields"
  - "fetchModelDetails() returning quantizations + per-quant file sizes from HF API"
  - "isModelCached() utility querying browser Cache API for transformers-cache entries"
  - "formatSize() utility for human-readable byte formatting"
  - "updateConfig store action for in-place config mutation"
affects: [02-model-selection-settings, 03-prompt-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: ["HF API ?blobs=true for file size extraction", "Browser Cache API direct query for cache status", "Zustand updateConfig pattern for in-place state mutation"]

key-files:
  created:
    - src/lib/cacheCheck.ts
    - src/lib/formatSize.ts
  modified:
    - src/types/index.ts
    - src/lib/hfSearch.ts
    - src/stores/useCompareStore.ts

key-decisions:
  - "fetchModelDetails is additive -- existing searchModels and fetchAvailableQuantizations remain unchanged"
  - "updateConfig accepts Partial<Pick<TestConfig, 'quantization' | 'backend' | 'estimatedSize' | 'cached'>> to constrain mutable fields"
  - "Cache check uses direct Cache API with 'transformers-cache' name rather than importing transformers.js in main thread"

patterns-established:
  - "HF API size extraction: fetchModelDetails with ?blobs=true, matchQuantization helper for single-file matching"
  - "Cache status pattern: isModelCached checks multiple filename variants per quantization against browser Cache API"
  - "Store mutation pattern: updateConfig for in-place config changes instead of remove-then-add"

requirements-completed: [MSEL-01, MSEL-02, MSEL-04, MSEL-05, MSEL-06, STNV-02, STNV-03, STNV-04]

# Metrics
duration: 2min
completed: 2026-04-10
---

# Phase 2 Plan 01: Data Layer & Utilities Summary

**Extended TestConfig with size/cache fields, created fetchModelDetails (HF API sizes), isModelCached (Cache API), formatSize utility, and updateConfig store action for Plan 02 UI consumption**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-10T18:03:15Z
- **Completed:** 2026-04-10T18:05:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended TestConfig interface with `estimatedSize` (bytes from HF API) and `cached` (boolean from Cache API) optional fields
- Created `fetchModelDetails()` in hfSearch.ts that fetches quantizations AND per-quantization ONNX file sizes using HF API `?blobs=true` parameter
- Created `isModelCached()` in cacheCheck.ts that queries browser Cache API (`transformers-cache`) for cached model files across multiple filename patterns per quantization
- Created `formatSize()` utility for human-readable byte formatting with tilde prefix (e.g., ~749.7 MB)
- Added `updateConfig` store action that mutates config in-place, replacing the fragile remove-then-add pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types, create cacheCheck.ts, formatSize.ts, and enhance hfSearch.ts** - `23a4c79` (feat)
2. **Task 2: Add updateConfig store action and verify requirements** - `b0deb9a` (feat)

## Files Created/Modified
- `src/types/index.ts` - Added estimatedSize and cached optional fields to TestConfig
- `src/lib/hfSearch.ts` - Added ModelDetails interface, fetchModelDetails function, matchQuantization helper
- `src/lib/cacheCheck.ts` - NEW: Cache API utility with isModelCached function and QUANT_FILENAMES mapping
- `src/lib/formatSize.ts` - NEW: Byte formatting utility with ~X.X MB format
- `src/stores/useCompareStore.ts` - Added updateConfig action to CompareState interface and implementation

## Decisions Made
- `fetchModelDetails` is purely additive; existing `searchModels` and `fetchAvailableQuantizations` remain completely unchanged (per D-01)
- `matchQuantization` is a private helper (not exported) since it reuses the same logic as `extractQuantizations` but for single files
- `updateConfig` constrains mutable fields to `quantization | backend | estimatedSize | cached` to prevent accidental mutation of identity fields (id, modelId, displayName)
- Used direct Cache API access rather than importing `@huggingface/transformers` in main thread to avoid ~10MB+ bundle impact

## Deviations from Plan

None - plan executed exactly as written.

## Requirement Verification Notes

- **MSEL-01**: searchModels filters for `onnx,transformers.js` + `text-generation` pipeline tag + sorted by downloads, limit 20 -- VERIFIED COMPLETE
- **MSEL-02**: Search dropdown displays modelId, pipelineTag, ONNX badge, conditional transformers.js badge, downloads count, likes count -- VERIFIED COMPLETE
- **MSEL-04**: Types and data utilities ready for two-row chip UI (Plan 02 scope for rendering) -- DATA LAYER COMPLETE
- **MSEL-05**: `fetchAvailableQuantizations` and new `fetchModelDetails` both extract quantizations from HF API -- VERIFIED COMPLETE
- **MSEL-06**: `addConfig` appends to configs array with no dedup logic; unique ID via Date.now() allows same model with different settings -- VERIFIED COMPLETE
- **STNV-02**: ApiKeySettings has providers array with openai, anthropic, google -- VERIFIED COMPLETE
- **STNV-03**: Show/Hide toggle per provider + Zustand persist middleware to localStorage -- VERIFIED COMPLETE
- **STNV-04**: Test button per provider with handleTest() making actual API calls -- VERIFIED COMPLETE

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data utilities and type contracts are ready for Plan 02 (UI refactor) to consume
- `fetchModelDetails` replaces the need for separate `fetchAvailableQuantizations` calls when size data is also needed
- `updateConfig` enables Plan 02 to implement in-place quantization/backend changes without remove-then-add pattern
- `isModelCached` ready for cache status dot rendering in two-row chips
- `formatSize` ready for download size display in chips

## Self-Check: PASSED

All 6 files verified present. Both task commits (23a4c79, b0deb9a) verified in git log.

---
*Phase: 02-model-selection-settings*
*Completed: 2026-04-10*
