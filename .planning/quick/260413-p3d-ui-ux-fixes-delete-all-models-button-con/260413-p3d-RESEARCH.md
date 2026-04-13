# Quick Task 260413-p3d: UI/UX Fixes - Research

**Researched:** 2026-04-13
**Domain:** React/Zustand state management, Tailwind modal patterns, Cache API
**Confidence:** HIGH

## Summary

All 5 issues are well-scoped and involve known patterns already used in the codebase. The primary complexity is in Issue #3 (quantization dropdown) which is a classic state-loss-on-unmount bug, and Issue #4 (cache status refresh) which requires understanding the download-complete event flow. No new dependencies are needed.

**Primary recommendation:** Fix in dependency order: ConfirmModal first (used by delete-all and replaces window.confirm), then persistence (enables quantization fix), then cache refresh.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Delete-All button: top-right danger button in model list header area, next to existing "Clean Up" button. Red/danger styling. Must use new confirm modal.
- Confirm Modal: custom Tailwind component, no external deps. Matches existing design language. Reusable for single-delete, delete-all, and cleanup confirmations. Accessible (focus trap, escape to close, backdrop click to close).
- Persistence: use Zustand persist middleware on useCompareStore (already used by useSettingsStore and useModelUsageStore as reference). Persist prompt text, selected model configs, AND generation parameters.

### Claude's Discretion
- None specified

### Deferred Ideas (OUT OF SCOPE)
- None specified
</user_constraints>

## Issue Analysis

### Issue #1: Delete-All Button on Models Page

**Current state:** `CachedModelsTable` (line 195-207) has a toolbar with "Cached Models" label and a "Clean Up (N unused)" button. The "Delete All" button should sit next to the cleanup button. [VERIFIED: src/components/CachedModelsTable/index.tsx]

**Implementation:** Add a "Delete All" button in the toolbar `div` (line 195). It should:
- Be disabled when `models.length === 0` or `deleting !== null`
- Use the same danger styling as the cleanup button: `border-error/50 text-error hover:bg-error/5`
- Call a new `handleDeleteAll()` that iterates all models and deletes each (similar to `handleDeleteModel` but for all)
- Must use the new ConfirmModal (Issue #2) instead of `window.confirm`

**Deletion logic:** The `deleteCachedModel` function from `cacheManager.ts` already supports deleting all quantizations for a model. Loop through all models, delete each model's quantizations, then shared files. [VERIFIED: src/lib/cacheManager.ts]

### Issue #2: Custom Confirm Modal

**Current state:** Three places use `window.confirm()`: `handleDeleteQuant` (line 127), `handleDeleteModel` (line 145), and `handleCleanup` (line 175) in CachedModelsTable. [VERIFIED: grep across src/]

**Component location:** `src/components/ConfirmModal/index.tsx` (follows existing PascalCase directory pattern) [VERIFIED: naming convention from existing components]

**Accessibility requirements from CONTEXT.md:**
- Focus trap: on open, focus the cancel/confirm button; Tab should not leave the modal
- Escape to close: `onKeyDown` handler on the dialog
- Backdrop click to close: click handler on the overlay div
- Use `<dialog>` element or `role="dialog"` + `aria-modal="true"` for screen readers

**Props shape:**
```typescript
interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string   // default "Delete"
  onConfirm: () => void
  onCancel: () => void
}
```

**Pattern:** Replace `window.confirm()` with a state-driven modal. Each delete handler sets state like `{ action: 'deleteModel', modelId: '...' }`, the modal renders based on that state, and onConfirm executes the actual delete.

### Issue #3: Quantization Dropdown Losing Options on Navigation

**Root cause identified:** The quantization options (`quants`) for each config come from `configDetails` state in `ModelSelector` (line 60):
```typescript
const [configDetails, setConfigDetails] = useState<Record<string, { quants: Quantization[]; sizeByQuant: Record<string, number> }>>({})
```
This is **local component state** (useState). When the user navigates away from ComparePage, ModelSelector unmounts and `configDetails` is lost. When navigating back, ModelSelector remounts with empty `configDetails`. The fallback on line 284 is:
```typescript
const quants = details?.quants ?? [config.quantization]
```
So it falls back to a single-item array with only the currently selected quantization. [VERIFIED: src/components/ModelSelector/index.tsx lines 60, 284]

**The real issue:** `configs` survive in useCompareStore (Zustand), but the model details (available quantizations, sizes) are stored in component-local state AND a module-level Map (`modelDetailsCache`, line 52). The module-level cache survives hot-module replacement but NOT page navigation in production (React Router re-mounts the component, module cache survives since it is module-scoped).

Wait -- the module-level `modelDetailsCache` Map on line 52 IS module-scoped and DOES survive React Router navigation (modules are loaded once). So the data should be available. Let me re-examine.

The issue is that `configDetails` (component state) maps **config IDs** to model details. This state is lost on unmount. When the component remounts, the `configDetails` useState starts empty. The `modelDetailsCache` maps **model IDs** to details, so the raw data survives, but the component never re-populates `configDetails` from `modelDetailsCache` for existing configs.

**Fix:** On mount, populate `configDetails` from `modelDetailsCache` for all existing configs. Add a `useEffect` that runs once on mount:
```typescript
useEffect(() => {
  const existing: Record<string, { quants: Quantization[]; sizeByQuant: Record<string, number> }> = {}
  for (const config of configs) {
    if (config.backend === 'api') continue
    const details = modelDetailsCache.get(config.modelId)
    if (details) {
      existing[config.id] = { quants: details.quantizations, sizeByQuant: details.sizeByQuant }
    }
  }
  if (Object.keys(existing).length > 0) {
    setConfigDetails(existing)
  }
}, [])  // only on mount
```

**Alternative (cleaner):** Move configDetails into useCompareStore alongside configs, so it survives navigation. But this is heavier and the mount-rehydrate approach is simpler.

**After persistence is added (Issue #5):** configs will survive page refresh too. But `modelDetailsCache` (module-level Map) will NOT survive page refresh -- it is lost when the page reloads. So for persisted configs, we need a way to re-fetch model details on mount if the cache is empty. The useEffect above should also trigger an async `fetchModelDetails` call for any config whose modelId is NOT in `modelDetailsCache`.

### Issue #4: Cache Status Not Refreshing After Download

**Current flow in ComparePage context:**
1. User clicks "Download" -> `startDownload()` in workerBridge.ts posts `download` command to worker
2. Worker posts `download-progress` events -> `handleWorkerEvent` updates `downloadProgress` state
3. Worker posts `download-complete` -> `handleWorkerEvent` marks downloaded models as `cached: true` via `store.updateConfig(model.configId, { cached: true })` (line 52-54) [VERIFIED: src/lib/workerBridge.ts lines 48-59]

**This actually works for the Compare page.** The `download-complete` handler iterates `dp.models` and sets `cached: true` for each completed model. The model chip in ModelSelector reads `config.cached` from the store, so it should update.

**The issue is likely on the Models page** (ModelsPage.tsx). The `CachedModelsTable` component uses `refreshKey` for re-enumeration. The `ModelDownloader` component detects download completion by watching `executionStatus` transitions (line 77-84) and calls `onDownloadComplete` which bumps the `refreshKey`. This causes CachedModelsTable to remount and re-enumerate the cache.

**Potential race condition:** The `download-complete` handler in workerBridge terminates the worker and sets `executionStatus` to `'idle'`. But Cache API writes from the worker happen before the worker posts `download-complete`. So the race is unlikely.

**More likely issue:** In the Compare page flow, the `cached` badge in ModelSelector reads from `config.cached` in the store. After download completes, `handleWorkerEvent`'s `download-complete` case sets `cached: true` on matching configs (lines 50-55). BUT it only marks models whose `model.status === 'complete'` in the `downloadProgress` state. If `downloadProgress` has already been nulled out (race), or if the status wasn't properly updated to 'complete' for a model, the cache flag won't flip.

**Looking more carefully at the flow:**
1. Worker posts individual `download-progress` with `progress >= 100` -> status set to `'complete'`
2. Worker posts `download-complete` -> iterates `dp.models`, checks `model.status === 'complete'`, sets `cached: true`

This seems sound. The issue might be that `isModelCached()` is called at model selection time but never re-called after download. The `cached` property on the config gets set to `true` by the download-complete handler, which is correct.

**User's actual complaint likely:** After downloading a model on the Models page (via ModelDownloader), the cache table doesn't show the new model until manual page refresh. This is handled by the `refreshKey` pattern. The detection works via `executionStatus` transition from `'downloading'` to `'idle'`. This should work. The issue might be that the `CachedModelsTable` is keyed by `refreshKey` which causes a full remount (destroying expanded/sort state), creating a UX that feels broken even when it works.

**Alternate interpretation:** The "cache status" refers to the `Cached`/`Not cached` badge on model chips in ModelSelector on the ComparePage. After a pre-download completes, the badge should flip from "Not cached" to "Cached". The download-complete handler DOES call `updateConfig(model.configId, { cached: true })`. If this isn't working, there might be a configId mismatch between the download progress models and the actual configs.

**Recommendation:** Add a re-check of cache status after download-complete using the actual Cache API (call `isModelCached()` for each local config) rather than relying solely on the download progress tracking. This is more robust and handles edge cases.

### Issue #5: Persist Prompt and Model Selection

**Current state:**
- `useCompareStore` (line 34): created with plain `create<CompareState>()` -- NO persist middleware [VERIFIED: src/stores/useCompareStore.ts]
- `useSettingsStore`: uses `persist` middleware with `partialize` to only persist `apiKeys` and `parameters` [VERIFIED: src/stores/useSettingsStore.ts]
- `useModelUsageStore`: uses `persist` middleware, persists entire state [VERIFIED: src/stores/useModelUsageStore.ts]
- Generation parameters are ALREADY persisted via useSettingsStore (CONTEXT.md says "persist... generation parameters" but they already are)

**What to persist from useCompareStore:**
- `prompt` (string) -- user's last prompt
- `configs` (TestConfig[]) -- selected model configurations

**What NOT to persist:**
- `results` -- these are per-run, should reset
- `executionStatus` -- should always start as 'idle'
- `runProgress`, `downloadProgress` -- transient UI state
- `fallbackWarning` -- transient

**Implementation:**
```typescript
import { persist } from 'zustand/middleware'

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      // ... existing state and actions
    }),
    {
      name: 'compare-llm-state',
      partialize: (state) => ({
        prompt: state.prompt,
        configs: state.configs,
      }),
    }
  )
)
```

**Serialization concern:** `TestConfig` is a plain object with string/number/boolean fields. It serializes cleanly to JSON. No functions, no class instances, no circular references. [VERIFIED: src/types/index.ts]

**On hydration:** When configs are restored from localStorage, the `configDetails` in ModelSelector will be empty. The fix from Issue #3 (re-fetch model details on mount) handles this -- it fetches details for any config whose modelId isn't in the module-level cache.

## Architecture Patterns

### ConfirmModal Component Pattern
```
src/
  components/
    ConfirmModal/
      index.tsx       # Reusable modal with focus trap
```

**Pattern:** Controlled component. Parent manages `open` state. Modal renders a backdrop overlay + centered card. Uses React portal or just absolute/fixed positioning.

```typescript
// Usage in CachedModelsTable:
const [confirmState, setConfirmState] = useState<{
  open: boolean
  title: string
  message: string
  onConfirm: () => void
} | null>(null)

// Replace: if (!window.confirm(...)) return
// With: setConfirmState({ open: true, title: '...', message: '...', onConfirm: () => { ... } })
```

### Persist Middleware Pattern (from existing codebase)
```typescript
// Pattern from useSettingsStore.ts -- replicate for useCompareStore
create<State>()(
  persist(
    (set) => ({ /* state + actions */ }),
    {
      name: 'storage-key',
      partialize: (state) => ({ /* only fields to persist */ }),
    }
  )
)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom localStorage read/write | Zustand `persist` middleware | Already used in 2 stores, handles serialization, hydration, and versioning [VERIFIED: existing pattern] |
| Focus trapping in modal | Manual keydown/focus tracking | `useRef` + `useEffect` with `element.focus()` | For POC scope, a simple auto-focus on mount + keydown escape handler is sufficient. A full focus-trap library (focus-trap-react) is overkill for one component. |

## Common Pitfalls

### Pitfall 1: Stale Closures in Confirm Modal
**What goes wrong:** The `onConfirm` callback captures stale state from when the modal was opened.
**How to avoid:** Store the action intent (e.g., `{ type: 'deleteModel', modelId }`) in state, not a pre-bound callback. Execute the actual async operation in a handler that reads fresh state.

### Pitfall 2: Persist Middleware Hydration Race
**What goes wrong:** Components render with default state before localStorage hydration completes, causing a flash.
**How to avoid:** Zustand persist v4 hydrates synchronously from localStorage by default. For `partialize`-d stores, non-persisted fields get their initial values immediately. This is not an issue here since prompt="" and configs=[] are reasonable defaults that match the "empty" initial state.

### Pitfall 3: configDetails Re-fetch on Persisted Configs
**What goes wrong:** After page refresh, configs are restored from localStorage but `modelDetailsCache` (module-level Map) is empty. Quantization dropdowns show only the current quantization.
**How to avoid:** On ModelSelector mount, check each restored config against `modelDetailsCache`. If missing, call `fetchModelDetails(config.modelId)` and populate both the cache and component state. This must be async and should handle the loading gracefully (show current quant until details load).

### Pitfall 4: Delete-All Must Handle Large Cache
**What goes wrong:** Deleting many models sequentially takes time. UI appears frozen.
**How to avoid:** Use the `deleting` state to disable buttons and show a "Deleting..." indicator. Process deletions sequentially (already the pattern in handleCleanup). The CachedModelsTable already handles this with its `deleting` state guard.

## Integration Points

All 5 issues share state through `useCompareStore`:
- Issue #5 adds persist middleware to useCompareStore (changes store creation)
- Issue #3 depends on Issue #5 (persisted configs need model details re-fetch)
- Issue #1 and #2 both modify CachedModelsTable
- Issue #2 produces a reusable component consumed by Issue #1 and existing delete handlers

**Recommended implementation order:**
1. ConfirmModal component (standalone, no deps)
2. useCompareStore persist middleware (Issue #5)
3. ModelSelector mount re-hydration (Issue #3, depends on #5)
4. Cache status refresh fix (Issue #4)
5. Delete-All button + replace window.confirm (Issues #1 + #2 integration in CachedModelsTable)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Module-level `modelDetailsCache` Map survives React Router navigation but not page refresh | Issue #3 | If it doesn't survive navigation, the fix needs to also handle that case (it does -- the useEffect re-fetches) |
| A2 | Zustand persist v4 hydrates synchronously from localStorage | Pitfall 2 | If async, there could be a flash of empty state; mitigated by reasonable defaults |

## Sources

### Primary (HIGH confidence)
- `src/stores/useCompareStore.ts` -- current store without persist
- `src/stores/useSettingsStore.ts` -- persist middleware reference pattern
- `src/stores/useModelUsageStore.ts` -- second persist middleware reference
- `src/components/ModelSelector/index.tsx` -- quantization dropdown, configDetails state
- `src/components/CachedModelsTable/index.tsx` -- delete handlers, window.confirm usage
- `src/lib/workerBridge.ts` -- download-complete handler, cache status update
- `src/lib/cacheCheck.ts` -- isModelCached function
- `src/types/index.ts` -- TestConfig shape (serializable)

## Metadata

**Confidence breakdown:**
- Issue #1 (Delete-All): HIGH -- straightforward extension of existing delete patterns
- Issue #2 (Confirm Modal): HIGH -- standard React modal pattern, well-understood
- Issue #3 (Quantization dropdown): HIGH -- root cause identified in code, fix is clear
- Issue #4 (Cache refresh): MEDIUM -- exact user complaint unclear, provided robust fix
- Issue #5 (Persistence): HIGH -- exact pattern exists in 2 other stores

**Research date:** 2026-04-13
**Valid until:** 2026-05-13
