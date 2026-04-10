---
phase: 03-prompt-input-test-controls
plan: 02
subsystem: ui
tags: [react, zustand, tailwind, pre-download, progress-bar, serial-download]

# Dependency graph
requires:
  - phase: 03-prompt-input-test-controls
    plan: 01
    provides: ModelDownloadStatus types, MultiModelDownloadProgress, parameters in useSettingsStore, workerBridge multi-model download
provides:
  - PreDownload component with serial multi-model download progress UI
  - Simplified TestControls run-only bar
  - ComparePage layout matching D-12 ordering
affects: [phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [dedicated-section-component, conditional-null-render, shared-formatSize-utility]

key-files:
  created:
    - src/components/PreDownload/index.tsx
  modified:
    - src/components/TestControls/index.tsx
    - src/pages/ComparePage.tsx

key-decisions:
  - "PreDownload hidden when no local models selected (returns null) -- D-05 implies no purpose without local models"
  - "Estimated time intentionally excluded from TestControls info text per D-10 (unreliable without benchmarks)"
  - "Uses shared formatSize with real estimatedSize bytes instead of crude sizeMap quantization estimate"

patterns-established:
  - "Conditional section render: component returns null when section has no purpose (PreDownload with no local models)"
  - "Shared utility over inline: formatSize imported from lib instead of duplicated per component"

requirements-completed: [CTRL-01, CTRL-02, CTRL-03, CTRL-04]

# Metrics
duration: 2min
completed: 2026-04-10
---

# Phase 3 Plan 02: PreDownload Component and Simplified TestControls Summary

**Dedicated PreDownload section with serial multi-model progress, simplified run-only TestControls bar, and D-12 layout ordering in ComparePage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-10T22:20:06Z
- **Completed:** 2026-04-10T22:22:06Z
- **Tasks:** 2 completed (Task 3 is checkpoint:human-verify, pending user interaction)
- **Files created:** 1
- **Files modified:** 2

## Accomplishments
- Created PreDownload component with per-model serial download progress (checkmark done, progress bar downloading, dot waiting, error states)
- Simplified TestControls to run-only bar: removed Pre-Download button, uses shared formatSize with real estimatedSize, reads parameters from useSettingsStore
- Updated ComparePage layout order to PromptInput -> ModelSelector -> PreDownload -> TestControls per D-12

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PreDownload component** - `b28f1d5` (feat)
2. **Task 2: Simplify TestControls and update ComparePage layout** - `848a26c` (feat)
3. **Task 3: Visual and functional verification** - checkpoint:human-verify (pending)

## Files Created/Modified
- `src/components/PreDownload/index.tsx` - New dedicated pre-download section with serial multi-model progress UI, cancel support, cached/uncached states
- `src/components/TestControls/index.tsx` - Simplified to run-only bar: model count + download size info, Cancel button, Run Comparison button
- `src/pages/ComparePage.tsx` - Added PreDownload import and render between ModelSelector and TestControls

## Decisions Made
- PreDownload returns null (hidden) when no local models are selected -- D-05 says "always visible when local models are selected," implying no purpose without them
- Estimated time excluded from TestControls info text per D-10 -- unreliable without benchmarks, varies by hardware
- Uses shared `formatSize` from `src/lib/formatSize.ts` with real `estimatedSize` bytes from HF API instead of crude quantization-based sizeMap estimate
- PreDownload passes `localConfigs` (filtered) to `startDownload()` for explicit call-site intent, even though bridge also filters internally

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Checkpoint Pending

**Task 3 (checkpoint:human-verify)** is pending user interaction. This task requires visual and functional verification of all Phase 3 features in the browser:
- PromptInput collapsible parameters panel
- PreDownload section visibility, cached state, download progress
- TestControls simplified bar (no Pre-Download button, Run + Cancel only)
- Layout order per D-12
- Disable states during execution

## Next Phase Readiness
- All CTRL requirements (CTRL-01 through CTRL-04) implemented
- PreDownload and TestControls ready for user verification
- Layout matches D-12 ordering
- Pending: Task 3 human verification approval before phase can be marked complete

## Self-Check: PASSED

---
*Phase: 03-prompt-input-test-controls*
*Completed: 2026-04-10*
