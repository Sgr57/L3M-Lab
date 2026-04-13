---
phase: 07-cache-management-page
plan: 03
subsystem: ui/models-page
tags: [model-downloader, search, pre-cache, ui]
dependency_graph:
  requires: [07-01, 07-02]
  provides: [complete-models-page]
  affects: [src/pages/ModelsPage.tsx, src/components/ModelDownloader/index.tsx]
tech_stack:
  added: []
  patterns: [hf-search-reuse, worker-bridge-download, zustand-selector]
key_files:
  created:
    - src/components/ModelDownloader/index.tsx
  modified:
    - src/pages/ModelsPage.tsx
decisions:
  - Reused search functions from hfSearch.ts rather than embedding ModelSelector component to avoid coupling to comparison state
  - Module-level model details cache to avoid redundant API calls
  - Detect download completion via executionStatus transition from downloading to idle
metrics:
  duration: 101s
  completed: 2026-04-13T15:17:22Z
  tasks_completed: 1
  tasks_total: 2
---

# Phase 7 Plan 3: ModelDownloader and Complete ModelsPage Summary

ModelDownloader component with HuggingFace ONNX model search, quantization selection with size estimates, download via workerBridge with progress bar, and automatic CachedModelsTable refresh on completion.

## What Was Built

### Task 1: ModelDownloader Component + ModelsPage Wiring

Created `src/components/ModelDownloader/index.tsx` with:
- Search autocomplete reusing `searchModels()` and `fetchModelDetails()` from `hfSearch.ts`
- Debounced search input (300ms) with dropdown showing model ID, pipeline tag, ONNX badge, downloads, likes
- Model selection loads quantization details and displays selectable pills with size estimates
- "Download Model" button triggers `startDownload()` from `workerBridge.ts` with a temporary `TestConfig`
- Download progress bar using existing `useCompareStore` download tracking
- Automatic table refresh via `onDownloadComplete` callback when download finishes
- Backend auto-detection (WebGPU if supported, WASM fallback) from `useSettingsStore`

Updated `src/pages/ModelsPage.tsx` to import and render `ModelDownloader` below `CachedModelsTable`, with `onDownloadComplete` wired to increment `refreshKey`.

### Task 2: Human Verification (Checkpoint)

Awaiting human verification of the complete /models page.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data sources are wired (hfSearch API for search, workerBridge for download, useCompareStore for progress tracking).

## Self-Check: PENDING

Task 2 (human checkpoint) not yet completed. Self-check will be finalized after checkpoint approval.
