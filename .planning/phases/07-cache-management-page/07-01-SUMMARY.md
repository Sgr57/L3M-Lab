---
phase: 07-cache-management-page
plan: 01
subsystem: cache-management
tags: [types, store, cache-api, routing, data-layer]
dependency_graph:
  requires: []
  provides:
    - CacheEntry type
    - CachedQuantInfo type
    - CachedModelInfo type
    - useModelUsageStore
    - cacheManager.ts (enumerateCache, groupByModelAndQuant, deleteCachedModel, getStaleModelKeys, quantizationFromFilepath)
    - /models route
    - NavBar Models link
    - workerBridge usage tracking integration
  affects:
    - src/types/index.ts
    - src/lib/workerBridge.ts
    - src/components/NavBar/index.tsx
    - src/App.tsx
tech_stack:
  added: []
  patterns:
    - Zustand persist store for usage tracking
    - Raw Cache API enumeration with Promise.all parallel processing
    - ModelRegistry.clear_cache with raw fallback for deletion
    - Quantization filepath matching (reused from hfSearch.ts)
key_files:
  created:
    - src/stores/useModelUsageStore.ts
    - src/lib/cacheManager.ts
    - src/pages/ModelsPage.tsx
  modified:
    - src/types/index.ts
    - src/lib/workerBridge.ts
    - src/components/NavBar/index.tsx
    - src/App.tsx
decisions:
  - Cast dtype to DataType literal union via 'as' for ModelRegistry.clear_cache compatibility
  - Raw Cache API fallback skips shared files (null quant) when deleting specific dtype
metrics:
  duration: 3m 53s
  completed: 2026-04-13
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 4
---

# Phase 07 Plan 01: Data Layer, Cache Manager, and Routing Summary

Cache management data layer with types, persisted usage store, 5-export cache library, /models route, and workerBridge usage tracking integration.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create cache management types and usage tracking store | 866b2dc | src/types/index.ts, src/stores/useModelUsageStore.ts |
| 2 | Create cache manager library | 0804771 | src/lib/cacheManager.ts |
| 3 | Add routing, NavBar link, and workerBridge usage tracking | 1a14929 | src/pages/ModelsPage.tsx, src/App.tsx, src/components/NavBar/index.tsx, src/lib/workerBridge.ts |

## What Was Built

### Types (src/types/index.ts)
- **CacheEntry**: Raw cache entry with modelId, filepath, url, size
- **CachedQuantInfo**: Quantization-level grouping with size, lastUsed, files
- **CachedModelInfo**: Model-level grouping with totalSize, lastUsed, quantizations array

### Usage Store (src/stores/useModelUsageStore.ts)
- Persisted Zustand store under localStorage key `model-usage-tracking`
- Key format: `"modelId::quantization"` -> timestamp ms
- Methods: `setLastUsed`, `getLastUsed`, `removeUsage` (single quant or all for model)

### Cache Manager (src/lib/cacheManager.ts)
- **enumerateCache()**: Opens `transformers-cache`, parses HF CDN URLs, reads sizes via Content-Length with blob fallback, uses Promise.all for parallel processing
- **quantizationFromFilepath()**: Matches ONNX filenames to q4/q8/fp16/fp32, returns null for shared files
- **groupByModelAndQuant()**: Groups entries hierarchically, merges usage timestamps, sums sizes including shared files
- **deleteCachedModel()**: ModelRegistry.clear_cache primary path with include_tokenizer/include_processor=false for single dtype; raw Cache API fallback for offline/error cases
- **getStaleModelKeys()**: Returns model+quant pairs where lastUsed is null or older than maxAgeMs

### Routing and Integration
- ModelsPage shell at /models with placeholder for Plan 02/03 components
- NavBar "Models" link between Compare and Settings (identical className pattern)
- workerBridge.startComparison tracks usage via useModelUsageStore.setLastUsed for all local models

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **DataType cast for ModelRegistry.clear_cache**: The `dtype` option expects the `DataType` union type from transformers.js. Since our quantization strings (q4, q8, fp16, fp32) match the expected values, we cast via `as 'fp32'` to satisfy TypeScript without importing the internal type.

2. **Raw fallback skips shared files for dtype-specific deletion**: When the raw Cache API fallback is used for dtype-specific deletion, shared files (config.json, tokenizer.json) with null quantization are intentionally skipped to preserve them for other quantizations of the same model.

## Verification

- `npx tsc --noEmit` passes (all 3 tasks)
- `npx vite build` succeeds (Task 3 final check)
- All new files exist with correct exports
- NavBar shows Models link navigating to /models
- workerBridge records usage timestamps for local models

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| src/pages/ModelsPage.tsx | 6-7 | Placeholder text instead of CachedModelsTable/ModelDownloader | Components wired in Plan 02 and Plan 03 respectively |

These stubs are intentional -- ModelsPage is a shell that will be populated by subsequent plans in this phase.

## Threat Flags

None -- no new network endpoints, auth paths, or trust boundaries beyond what the plan's threat model already covers.

## Self-Check: PASSED

- All 3 created files found on disk
- All 4 modified files found on disk
- All 3 task commits verified in git log (866b2dc, 0804771, 1a14929)
