# Quick Task 260413-p3d: UI/UX Fixes — Summary

**Completed:** 2026-04-14
**Commits:** 7a473c2, 93832be, 3c5af7d

## Changes

### 1. ConfirmModal Component (NEW)
- `src/components/ConfirmModal/index.tsx` — Custom Tailwind modal with focus trap, Escape-to-close, backdrop-click-to-close
- Replaces all 3 `window.confirm()` calls in CachedModelsTable (delete quant, delete model, cleanup)
- Reusable for Delete All confirmation

### 2. Delete All Button
- `src/components/CachedModelsTable/index.tsx` — Top-right danger button next to Clean Up
- Shows model count + total size in confirmation modal
- Deletes all quantizations and shared files for every cached model

### 3. Quantization Dropdown Persistence
- `src/components/ModelSelector/index.tsx` — Added mount-time rehydration useEffect
- Reads from module-level `modelDetailsCache` Map on navigation return
- Falls back to HF API fetch for configs restored from localStorage after page refresh

### 4. Cache Status Refresh After Download
- `src/lib/workerBridge.ts` — Added secondary `isModelCached()` re-check after `download-complete` event
- Covers edge cases where progress tracking misses a model

### 5. Persist Prompt + Model Selection
- `src/stores/useCompareStore.ts` — Added Zustand `persist` middleware (key: `compare-llm-state`)
- Persists `prompt` and `configs` via `partialize` (excludes transient state)

### 6. Bug Fixes (from verification)
- **Empty parent after last quant delete:** `handleDeleteQuant` now also removes shared files (config.json, tokenizer.json) when deleting the last quantization of a model
- **Cache sync between pages:** All cache mutations in CachedModelsTable now call `syncCompareCacheStatus()` to update `useCompareStore.configs[].cached` via Cache API re-check

## Files Modified
- `src/components/ConfirmModal/index.tsx` (NEW)
- `src/components/CachedModelsTable/index.tsx`
- `src/components/ModelSelector/index.tsx`
- `src/lib/workerBridge.ts`
- `src/stores/useCompareStore.ts`
