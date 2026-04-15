# Quick Task 260415-ntl: Cached Models Accordion + Retry Button - Research

**Researched:** 2026-04-15
**Domain:** React UI components, Cache API integration, Web Worker messaging
**Confidence:** HIGH

## Summary

Both features are well-supported by existing codebase patterns. The cached models accordion reuses `enumerateCache()` + `groupByModelAndQuant()` from `cacheManager.ts` and follows the cloud models accordion pattern already in ModelSelector. The per-model retry button requires a new `retryDownload()` export in `workerBridge.ts` that posts a download command for a single failed model to the worker.

**Primary recommendation:** Keep implementation simple by reusing existing data loading patterns (CachedModelsTable) and existing accordion structure (cloud models accordion). For retry, add a targeted single-model download function to workerBridge.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Implementation Decisions
- Mini table rows: one row per model+quantization showing name, quant, size, last-used
- Click row to add model to comparison
- Reuse data from `enumerateCache()` + `groupByModelAndQuant()` in cacheManager.ts
- Auto WebGPU, fallback WASM: clicking a cached model row auto-adds config with WebGPU backend (or WASM if WebGPU not supported)
- No backend picker dialog -- cached models are local by definition
- Model added as `cached: true` immediately
- Per-model retry: small retry icon next to each failed model in PreDownload progress list
- Retries just that individual model, not all failed models
- Global "Retry Failed" not needed for now

### Claude's Discretion
- Accordion open/closed default state (suggest: closed by default, matching cloud accordion)
- Empty state when no models cached
- Retry mechanism implementation (re-post download command for single model to worker)
</user_constraints>

## Cached Models Accordion

### Data Loading Pattern

The `CachedModelsTable` component (on the /models page) loads cache data with this pattern [VERIFIED: src/components/CachedModelsTable/index.tsx]:

```typescript
const entries = await enumerateCache()
const grouped = groupByModelAndQuant(entries, useModelUsageStore.getState())
```

This returns `CachedModelInfo[]` with `modelId`, `totalSize`, `lastUsed`, and `quantizations[]` (each with `quantization`, `size`, `lastUsed`). This is the exact data needed for the accordion rows.

**Performance consideration:** `enumerateCache()` reads ALL entries from `caches.open('transformers-cache')` and fetches Content-Length or blob size for each. For typical user caches (2-10 models), this takes 50-200ms. Fine for a one-time load on mount, but should not run on every render. [ASSUMED]

**Recommended approach:** Load cache data in a `useEffect` on ModelSelector mount (or on cached accordion open). Store in local state. No need for a global store -- this is read-only display data.

### Flattening for Display

The CONTEXT.md specifies "one row per model+quantization". The `groupByModelAndQuant()` output is hierarchical (model -> quantizations[]). Flatten it:

```typescript
type CachedRow = { modelId: string; quantization: string; size: number; lastUsed: number | null }

const rows: CachedRow[] = models.flatMap((m) =>
  m.quantizations.map((q) => ({
    modelId: m.modelId,
    quantization: q.quantization,
    size: q.size,
    lastUsed: q.lastUsed,
  }))
)
```

### Adding Config on Click

When user clicks a cached model row, create a `TestConfig` similar to `handleSelectModel()` [VERIFIED: src/components/ModelSelector/index.tsx line 116-151]:

```typescript
const config: TestConfig = {
  id: `${modelId}-${quantization}-${backend}-${crypto.randomUUID()}`,
  modelId,
  displayName: modelId.split('/').pop() ?? modelId,
  quantization: quantization as Quantization,
  backend: webgpuSupported ? 'webgpu' : 'wasm',
  estimatedSize: size,
  cached: true,  // always true -- it's from the cache
}
addConfig(config)
```

Key differences from HF search selection:
- No `fetchModelDetails()` call needed (we already know quantization and size)
- No `isModelCached()` check needed (it's cached by definition)
- `displayName` derived from modelId (no HF search result name available)
- No `configDetails` state needed (no quantization picker -- the row IS the quantization)

### Duplicate Prevention

Should check if the exact `modelId + quantization` combo is already in configs before adding. The cloud accordion does this with `alreadyAdded` check [VERIFIED: line 415-417]:

```typescript
const alreadyAdded = configs.some(
  (c) => c.modelId === row.modelId && c.quantization === row.quantization && c.backend !== 'api'
)
```

### Accordion Structure

Copy the cloud accordion pattern [VERIFIED: src/components/ModelSelector/index.tsx lines 387-494]:
- State: `const [cachedAccordionOpen, setCachedAccordionOpen] = useState(false)` -- closed by default
- Placement: BEFORE the HF search input (per task description "before HF search")
- Only render if cached models exist (or always render with empty state)

### Cache Staleness After Downloads

When a download completes mid-session, the cached models list becomes stale. The `download-complete` handler in workerBridge [VERIFIED: lines 48-66] sets `executionStatus` back to `idle` and marks configs as `cached: true`. The accordion should re-enumerate cache when:
1. The accordion is opened (lazy load)
2. OR `executionStatus` transitions from `'downloading'` to `'idle'` (download just completed)

A simple approach: load on mount + reload whenever `executionStatus` changes to `'idle'` from a non-idle state.

## Per-Model Retry Button

### Current Download Flow

`startDownload()` [VERIFIED: src/lib/workerBridge.ts lines 140-163]:
1. Filters to uncached local configs
2. Creates `ModelDownloadStatus[]` with `status: 'waiting'`
3. Sets `downloadProgress` in store
4. Sets `executionStatus` to `'downloading'`
5. Posts `{ type: 'download', configs }` to worker

The worker [VERIFIED: src/workers/inference.worker.ts lines 98-170]:
1. Iterates configs sequentially
2. For each: calls `pipeline()` which downloads + caches
3. On error: posts `{ type: 'error', configId, retryable }` but continues to next model
4. After all: posts `{ type: 'download-complete' }`

**Critical finding:** After `download-complete`, the worker is terminated [VERIFIED: workerBridge.ts line 63-66]:
```typescript
if (worker) {
  worker.terminate()
  worker = null
}
```

This means after a download batch finishes (even with errors), the worker is gone. A retry must create a fresh worker, which `getWorker()` handles automatically.

### Retry Implementation Path

The simplest path is a new `retryDownload(config: TestConfig)` function in workerBridge:

```typescript
export function retryDownload(config: TestConfig) {
  const store = useCompareStore.getState()
  
  // Reset this model's status in downloadProgress
  store.updateModelDownloadStatus(config.id, {
    status: 'waiting',
    progress: 0,
    error: undefined,
  })
  
  store.setExecutionStatus('downloading')
  
  // Re-initialize download progress with just this model
  // OR update existing progress to show retry in context
  
  const cmd: WorkerCommand = { type: 'download', configs: [config] }
  getWorker().postMessage(cmd)
}
```

**Key issue:** The `download-complete` handler terminates the worker and sets `executionStatus` to `'idle'`. If a retry is issued after download-complete, this works fine (fresh worker). But what about the `downloadProgress` state?

After `download-complete`, `downloadProgress` is set to `null` [VERIFIED: line 59]. The retry button is in the PreDownload component which only shows progress when `isDownloading && downloadProgress` [VERIFIED: PreDownload line 76]. So by the time the user sees error status, `downloadProgress` is already null.

**The real flow is:**
1. Downloads run: models show waiting/downloading/complete/error statuses
2. `download-complete` fires: status -> idle, downloadProgress -> null
3. PreDownload re-renders: no longer showing the per-model progress list
4. The error is lost from the UI

**Resolution:** The `download-complete` handler should NOT clear downloadProgress if any model has `status: 'error'`. Instead, keep the progress visible so the user can see which models failed and retry them. Modify the handler:

```typescript
case 'download-complete': {
  const dp = store.downloadProgress
  if (dp) {
    // Mark completed models as cached
    for (const model of dp.models) {
      if (model.status === 'complete') {
        store.updateConfig(model.configId, { cached: true })
      }
    }
    // If any errors, keep progress visible for retry. Otherwise clear.
    const hasErrors = dp.models.some((m) => m.status === 'error')
    if (hasErrors) {
      store.setExecutionStatus('idle')  // Not 'downloading' -- allow interaction
      // Keep downloadProgress so PreDownload shows the error state + retry
    } else {
      store.setExecutionStatus('idle')
      store.setDownloadProgress(null)
    }
  }
  // Worker termination stays the same
}
```

Then the retry button appears on error rows. When clicked, it calls `retryDownload(config)` which posts a single-model download command.

### Worker Support for Single-Model Download

The worker's `handleDownload()` accepts `configs: TestConfig[]` and iterates them [VERIFIED: inference.worker.ts lines 98-170]. Posting a single-config array `[failedConfig]` works without modification. The worker will:
1. Download just that one model
2. Post progress events for its configId
3. Post `download-complete`

The `download-complete` handler will fire again, but now we need to merge the retry result into the existing downloadProgress. The `updateModelDownloadStatus` action [VERIFIED: useCompareStore.ts lines 71-79] already handles this -- it finds the model by configId and updates it in place.

### PreDownload UI Changes

Add a retry button next to each error status row [VERIFIED: PreDownload lines 116-118]:

```tsx
{model.status === 'error' && (
  <span className="text-error">{model.error ?? 'Error'}</span>
)}
```

Add after the error text:
```tsx
{model.status === 'error' && (
  <>
    <span className="text-error truncate">{model.error ?? 'Error'}</span>
    <button
      type="button"
      className="ml-1 text-primary hover:text-primary/80 text-[11px] font-semibold"
      onClick={() => retryDownload(configForId(model.configId))}
    >
      Retry
    </button>
  </>
)}
```

The retry button needs the full TestConfig. PreDownload already has access to `configs` from the store. Look up by configId:
```typescript
const configForRetry = configs.find((c) => c.id === model.configId)
```

### Download Progress Visibility

PreDownload currently only shows progress when `isDownloading` (status === 'downloading') [VERIFIED: PreDownload line 76]. After download-complete with errors, status will be `'idle'` but `downloadProgress` is kept. Change the condition:

```typescript
// Show progress during download OR when there are errors to retry
const showProgress = (isDownloading || downloadProgress?.models.some(m => m.status === 'error')) && downloadProgress
```

## Common Pitfalls

### Pitfall 1: Cache Enumeration During Download
**What goes wrong:** If the cached accordion loads while a download is in progress, `enumerateCache()` may see partially downloaded files.
**How to avoid:** Don't auto-refresh the accordion while `executionStatus === 'downloading'`. Only refresh when transitioning to idle.

### Pitfall 2: Worker Termination on Download-Complete
**What goes wrong:** The worker is terminated after download-complete. If a retry is needed, a new worker must be created. `getWorker()` handles this, but the retry must not assume the old worker exists.
**How to avoid:** `getWorker()` already creates a new worker if `worker === null`. No special handling needed -- just call `getWorker().postMessage(cmd)`.

### Pitfall 3: Stale DisplayName for Cached Models
**What goes wrong:** Cached models only store `modelId` in cache URLs. There's no display name stored. Using `modelId.split('/').pop()` gives the repo name but not a user-friendly name.
**How to avoid:** Accept that cached model display names will be the repo part of modelId (e.g., "SmolLM2-135M-Instruct"). This is consistent with how the CachedModelsTable shows them.

### Pitfall 4: downloadProgress null After Errors
**What goes wrong:** Current `download-complete` handler sets `downloadProgress` to null, losing error state before user can retry.
**How to avoid:** Preserve `downloadProgress` when errors exist (described above in retry implementation).

## Integration Checklist

1. **ModelSelector:** Add `cachedAccordionOpen` state, `useEffect` for `enumerateCache()`, render accordion with flattened rows before search input
2. **PreDownload:** Add retry button per error row, modify progress visibility condition
3. **workerBridge.ts:** Add `retryDownload(config)` export, modify `download-complete` handler to preserve errors
4. **No changes needed:** worker code, store types, cacheManager.ts, cacheCheck.ts

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] src/components/ModelSelector/index.tsx -- accordion pattern, config creation
- [VERIFIED: codebase] src/components/PreDownload/index.tsx -- download progress UI
- [VERIFIED: codebase] src/lib/workerBridge.ts -- download flow, worker lifecycle
- [VERIFIED: codebase] src/workers/inference.worker.ts -- handleDownload, single-config support
- [VERIFIED: codebase] src/lib/cacheManager.ts -- enumerateCache, groupByModelAndQuant
- [VERIFIED: codebase] src/stores/useCompareStore.ts -- downloadProgress state management
- [VERIFIED: codebase] src/components/CachedModelsTable/index.tsx -- cache loading pattern reference

### Assumptions
- Cache enumeration performance (50-200ms for typical user) [ASSUMED]
