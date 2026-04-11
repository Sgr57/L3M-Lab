---
phase: 04-execution-engine-progress
plan: 03
subsystem: ui-components
tags: [progress-bar, cloud-timer, fallback-banner, error-display, ui]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [weighted-progress-bar, cloud-elapsed-timer, backend-badge, fallback-banner, error-category-display, fallback-indicator]
  affects: []
tech_stack:
  added: []
  patterns: [weighted-progress-formula, component-local-timer, collapsible-error-detail]
key_files:
  created:
    - src/components/FallbackBanner/index.tsx
  modified:
    - src/components/TestProgress/index.tsx
    - src/components/OutputComparison/index.tsx
    - src/pages/ComparePage.tsx
decisions:
  - Read maxTokens from useSettingsStore for accurate generating phase progress instead of hardcoding 256
  - Cloud elapsed timer uses component-local setInterval (not store-driven) per RESEARCH.md guidance
  - Used HTML entity &rarr; for arrow in fallback indicator to avoid encoding issues
metrics:
  duration: 3m
  completed: "2026-04-11T13:24:13Z"
  tasks_completed: 2
  tasks_total: 3
  checkpoint_pending: true
---

# Phase 4 Plan 3: UI Layer for Execution Engine Summary

Weighted progress bar with loading/init/generating phase formula, cloud elapsed timer, backend type badges, FallbackBanner for GPU device loss, enhanced error cards with category badges and collapsible raw errors, and fallback indicators in OutputComparison.

## What Was Done

### Task 1: Weighted progress bar, cloud elapsed timer, and backend badge in TestProgress + FallbackBanner
**Commit:** caf72f3

Rewrote TestProgress with complete Phase 4 UI:
- **calculateWeightedProgress function**: Implements the weighted formula where loading=10%, initializing=10%, generating=80% of each model's progress slice. Cloud models use cloud-pending (0%) and cloud-complete (100%) phases.
- **Cloud elapsed timer**: Component-local state with 100ms setInterval that starts when phase is cloud-pending and clears on phase change. Displays format like "1.2s".
- **BackendBadge component**: Color-coded badge (cloud/webgpu/wasm) next to model name using established color tokens.
- **maxTokens from store**: Reads maxTokens from useSettingsStore for accurate generating phase progress calculation.
- **Extended PHASE_LABELS**: Added cloud-pending ("Waiting for response...") and cloud-complete ("Complete") labels.

Created FallbackBanner component:
- **Persistent warning banner**: Reads fallbackWarning from useCompareStore, shows inline SVG warning icon with message text.
- **Visibility logic**: Only renders when fallbackWarning is non-null AND execution status is running or complete.
- **Non-dismissible**: No close button per D-05 design decision.

### Task 2: Enhanced error cards in OutputComparison, fallback indicator, and ComparePage wiring
**Commit:** 04ed672

Enhanced OutputComparison error display:
- **ERROR_CATEGORY_LABELS map**: 6 categories (CORS Blocked, Auth Failed, Rate Limited, Timeout, Server Error, Unknown Error).
- **Categorized error badge**: Shows error category badge with bg-error/10 styling, falls back to generic "Error" badge.
- **Hint text display**: Shows errorHint if available, falls back to raw error string.
- **Collapsible raw error**: Toggle button ("Show raw error"/"Hide raw error") with expandable monospace error detail panel.
- **Fallback indicator**: "WebGPU -> WASM" text in warning color when result has fallbackBackend set.
- **Error card tinting**: Error result cards get border-error/30 bg-error/5 styling with red left border.

Updated ComparePage:
- **FallbackBanner placement**: Renders between TestProgress and results section, guarded by fallbackWarning truthiness check.

### Task 3: Human verification (PENDING CHECKPOINT)
**Status:** Awaiting human verification of visual behavior in browser.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Enhancement] Used useSettingsStore for maxTokens instead of hardcoding 256**
- **Found during:** Task 1
- **Issue:** Plan suggested hardcoding 256 as default maxTokens. The useSettingsStore already has the user's configured maxTokens value.
- **Fix:** Imported useSettingsStore and read parameters.maxTokens for accurate generating phase progress.
- **Files modified:** src/components/TestProgress/index.tsx
- **Commit:** caf72f3

## Verification Results

- `npx tsc --noEmit` exits with code 0
- All acceptance criteria artifacts verified via grep
- All 6 phase cases present in calculateWeightedProgress
- Cloud timer uses setInterval at 100ms
- BackendBadge component renders cloud/webgpu/wasm variants
- FallbackBanner reads fallbackWarning from store, returns null when not set
- ERROR_CATEGORY_LABELS has all 6 categories
- Collapsible raw error toggle implemented
- Fallback indicator shows "WebGPU -> WASM"
- ComparePage imports and renders FallbackBanner

## Self-Check: PASSED (Tasks 1-2)

- [x] src/components/TestProgress/index.tsx exists
- [x] src/components/FallbackBanner/index.tsx exists
- [x] src/components/OutputComparison/index.tsx exists
- [x] src/pages/ComparePage.tsx exists
- [x] Commit caf72f3 found
- [x] Commit 04ed672 found
- [x] npx tsc --noEmit passes with zero errors
- [ ] Task 3 human verification pending
