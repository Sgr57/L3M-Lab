---
phase: 03-prompt-input-test-controls
plan: 01
subsystem: ui, state, worker
tags: [zustand, react, web-worker, wasm, transformers.js, collapsible-panel]

# Dependency graph
requires:
  - phase: 02-model-selection-settings
    provides: ModelSelector, useSettingsStore, useCompareStore, worker infrastructure
provides:
  - ModelDownloadStatus and MultiModelDownloadProgress types
  - Generation parameters persisted in useSettingsStore
  - Collapsible PromptInput parameters panel
  - WASM-forced download handler in worker
  - Multi-model download progress tracking in workerBridge
affects: [03-02-PLAN, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [collapsible-panel-with-chevron, multi-model-progress-tracking, wasm-forced-download]

key-files:
  created: []
  modified:
    - src/types/index.ts
    - src/stores/useSettingsStore.ts
    - src/stores/useCompareStore.ts
    - src/components/PromptInput/index.tsx
    - src/components/TestControls/index.tsx
    - src/components/ExportBar/index.tsx
    - src/workers/inference.worker.ts
    - src/lib/workerBridge.ts
    - src/components/TestProgress/index.tsx

key-decisions:
  - "Parameters moved to useSettingsStore with persist middleware (per D-02 research recommendation)"
  - "WASM forced for pre-download to avoid GPU memory allocation (per CTRL-01, D-07)"

patterns-established:
  - "Collapsible panel: toggle button with chevron rotation and conditional render (matches ModelSelector accordion)"
  - "Multi-model progress: store holds ModelDownloadStatus[] array, bridge translates per-event worker messages into per-model updates"

requirements-completed: [PRMT-01, PRMT-02, CTRL-01]

# Metrics
duration: 4min
completed: 2026-04-10
---

# Phase 3 Plan 01: Data Layer and Core Logic Summary

**Multi-model download types, persisted generation parameters in settings store, collapsible PromptInput panel, WASM-forced worker downloads, and per-model progress tracking in workerBridge**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T22:12:21Z
- **Completed:** 2026-04-10T22:17:08Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added ModelDownloadStatus and MultiModelDownloadProgress types for per-model download tracking
- Moved generation parameters from useCompareStore to useSettingsStore with localStorage persistence
- Refactored PromptInput with collapsible parameters panel (collapsed by default, shows current values in toggle)
- Forced WASM backend in worker download handler to avoid GPU memory allocation during pre-download
- Built multi-model download progress pipeline: bridge initializes all models as 'waiting', translates worker events into per-model status updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, stores, and collapsible PromptInput** - `f1af099` (feat)
2. **Task 2: Worker WASM override and workerBridge multi-model progress** - `d4a6e7e` (feat)

## Files Created/Modified
- `src/types/index.ts` - Added ModelDownloadStatus and MultiModelDownloadProgress interfaces
- `src/stores/useSettingsStore.ts` - Added parameters state with persist and setParameter action
- `src/stores/useCompareStore.ts` - Removed parameters, changed downloadProgress to MultiModelDownloadProgress, added updateModelDownloadStatus
- `src/components/PromptInput/index.tsx` - Collapsible parameters panel with useSettingsStore integration
- `src/components/TestControls/index.tsx` - Updated to read parameters from useSettingsStore
- `src/components/ExportBar/index.tsx` - Updated to read parameters from useSettingsStore
- `src/workers/inference.worker.ts` - WASM-forced download, cancellation support between models
- `src/lib/workerBridge.ts` - Multi-model download progress initialization and per-model status updates
- `src/components/TestProgress/index.tsx` - Updated to read from new MultiModelDownloadProgress shape

## Decisions Made
- Parameters moved to useSettingsStore with persist middleware so they survive page refresh (per D-02 research recommendation)
- WASM forced for pre-download to avoid GPU memory allocation, leaving WebGPU available for subsequent run (per CTRL-01, D-07)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated TestControls to use useSettingsStore for parameters**
- **Found during:** Task 1 (Store restructuring)
- **Issue:** TestControls read parameters from useCompareStore which no longer has them after the move
- **Fix:** Added useSettingsStore import, changed parameters selector to read from settings store
- **Files modified:** src/components/TestControls/index.tsx
- **Verification:** TypeScript compiles with zero errors
- **Committed in:** f1af099 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated ExportBar to use useSettingsStore for parameters**
- **Found during:** Task 1 (Store restructuring)
- **Issue:** ExportBar destructured parameters from useCompareStore which no longer has them
- **Fix:** Added useSettingsStore import, changed to separate selector for parameters
- **Files modified:** src/components/ExportBar/index.tsx
- **Verification:** TypeScript compiles with zero errors
- **Committed in:** f1af099 (Task 1 commit)

**3. [Rule 3 - Blocking] Updated TestProgress to use new MultiModelDownloadProgress shape**
- **Found during:** Task 2 (workerBridge multi-model progress)
- **Issue:** TestProgress accessed downloadProgress.total, .loaded, .modelName which no longer exist on MultiModelDownloadProgress
- **Fix:** Updated to read current model from downloadProgress.models[currentIndex], show model count
- **Files modified:** src/components/TestProgress/index.tsx
- **Verification:** TypeScript compiles with zero errors, build succeeds
- **Committed in:** d4a6e7e (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary for type safety after store restructuring. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Types and store shapes ready for Plan 02 to build PreDownload component and simplified TestControls
- MultiModelDownloadProgress structure ready for UI consumption
- PromptInput parameters panel functional and persisted
- Worker and bridge ready for multi-model download orchestration

---
*Phase: 03-prompt-input-test-controls*
*Completed: 2026-04-10*
