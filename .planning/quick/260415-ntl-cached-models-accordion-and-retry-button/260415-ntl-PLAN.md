---
phase: 260415-ntl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ModelSelector/index.tsx
  - src/lib/workerBridge.ts
  - src/components/PreDownload/index.tsx
autonomous: true
requirements: [CACHED-ACCORDION, RETRY-BUTTON]

must_haves:
  truths:
    - "User sees a 'Cached Models' accordion in the ModelSelector before the HF search input"
    - "Accordion shows one row per model+quantization with name, quant, size, and last-used"
    - "Clicking a cached model row adds it to the comparison configs with the correct backend"
    - "Duplicate cached model+quant combos cannot be added twice"
    - "When a download fails, the error status persists visibly after download-complete"
    - "User sees a Retry button next to each failed model in the PreDownload progress list"
    - "Clicking Retry re-downloads only that single failed model"
  artifacts:
    - path: "src/components/ModelSelector/index.tsx"
      provides: "Cached Models accordion with mini table rows before HF search"
      contains: "cachedAccordionOpen"
    - path: "src/lib/workerBridge.ts"
      provides: "retryDownload export and error-preserving download-complete handler"
      exports: ["retryDownload"]
    - path: "src/components/PreDownload/index.tsx"
      provides: "Per-model retry button on error rows and post-download error visibility"
      contains: "retryDownload"
  key_links:
    - from: "src/components/ModelSelector/index.tsx"
      to: "src/lib/cacheManager.ts"
      via: "enumerateCache + groupByModelAndQuant call in useEffect"
      pattern: "enumerateCache.*groupByModelAndQuant"
    - from: "src/components/ModelSelector/index.tsx"
      to: "src/stores/useCompareStore.ts"
      via: "addConfig on cached row click"
      pattern: "addConfig"
    - from: "src/components/PreDownload/index.tsx"
      to: "src/lib/workerBridge.ts"
      via: "retryDownload import and call on button click"
      pattern: "retryDownload"
    - from: "src/lib/workerBridge.ts"
      to: "src/stores/useCompareStore.ts"
      via: "download-complete preserves downloadProgress when errors exist"
      pattern: "hasErrors.*setDownloadProgress"
---

<objective>
Add two features to the Compare page: (1) a Cached Models accordion in ModelSelector showing browser-cached models for quick one-click selection, and (2) per-model retry buttons in PreDownload for failed downloads.

Purpose: Users currently must search HuggingFace to re-add models they already have cached locally. The accordion provides instant access. The retry button fixes the gap where download errors reference "retry" but no button exists.

Output: Updated ModelSelector with cached accordion, updated PreDownload with retry buttons, updated workerBridge with error-preserving download-complete handler and retryDownload export.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260415-ntl-cached-models-accordion-and-retry-button/260415-ntl-CONTEXT.md
@.planning/quick/260415-ntl-cached-models-accordion-and-retry-button/260415-ntl-RESEARCH.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From src/types/index.ts:
```typescript
export type Quantization = 'q4' | 'q8' | 'fp16' | 'fp32'
export type Backend = 'webgpu' | 'wasm' | 'api'
export type ExecutionStatus = 'idle' | 'downloading' | 'running' | 'complete' | 'error' | 'cancelled'

export interface TestConfig {
  id: string
  modelId: string
  displayName: string
  quantization: Quantization
  backend: Backend
  provider?: CloudProvider
  cloudModel?: string
  estimatedSize?: number
  cached?: boolean
}

export interface ModelDownloadStatus {
  configId: string
  modelName: string
  status: 'waiting' | 'downloading' | 'complete' | 'error'
  progress: number
  loaded: number
  total: number
  error?: string
}

export interface MultiModelDownloadProgress {
  models: ModelDownloadStatus[]
  currentIndex: number
}

export interface CachedModelInfo {
  modelId: string
  totalSize: number
  lastUsed: number | null
  quantizations: CachedQuantInfo[]
}

export interface CachedQuantInfo {
  quantization: string
  size: number
  lastUsed: number | null
  files: string[]
}
```

From src/lib/cacheManager.ts:
```typescript
export async function enumerateCache(): Promise<CacheEntry[]>
export function groupByModelAndQuant(entries: CacheEntry[], usageStore: { getLastUsed: ... }): CachedModelInfo[]
```

From src/lib/workerBridge.ts:
```typescript
export function startDownload(configs: TestConfig[]): void
export function cancelExecution(): void
// getWorker() is module-private, creates worker on demand
```

From src/stores/useCompareStore.ts:
```typescript
// Key actions used by these features:
addConfig: (config: TestConfig) => void
updateConfig: (configId: string, updates: Partial<...>) => void
setExecutionStatus: (status: ExecutionStatus) => void
setDownloadProgress: (progress: MultiModelDownloadProgress | null) => void
updateModelDownloadStatus: (configId: string, update: Partial<...>) => void
```

From src/stores/useModelUsageStore.ts:
```typescript
export const useModelUsageStore = create<{
  lastUsed: Record<string, number>
  getLastUsed: (modelId: string, quantization: string) => number | null
}>()
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Cached Models accordion to ModelSelector</name>
  <files>src/components/ModelSelector/index.tsx</files>
  <action>
Add a "Cached Models" accordion to ModelSelector, placed BEFORE the HF search input (`<div ref={wrapperRef}`). Follow the existing cloud accordion pattern exactly.

**New imports at top of file:**
```typescript
import { enumerateCache, groupByModelAndQuant } from '../../lib/cacheManager'
import { useModelUsageStore } from '../../stores/useModelUsageStore'
import { formatSize } from '../../lib/formatSize'  // already imported? check — yes, it IS NOT imported, add it
```
Note: `formatSize` is NOT currently imported in ModelSelector. Add it.

**New state variables** inside `ModelSelector()`, after `cloudAccordionOpen`:
```typescript
const [cachedAccordionOpen, setCachedAccordionOpen] = useState(false)
const [cachedRows, setCachedRows] = useState<{ modelId: string; quantization: string; size: number; lastUsed: number | null }[]>([])
const [cachedLoading, setCachedLoading] = useState(false)
```

**Cache data loading useEffect** — load when accordion opens, and reload when `executionStatus` transitions to `'idle'` (catches post-download refresh). Do NOT reload while `executionStatus === 'downloading'` (partial cache files). Place after the existing search useEffect:

```typescript
useEffect(() => {
  // Only load when accordion is open, and not during active download
  if (!cachedAccordionOpen || executionStatus === 'downloading') return

  let cancelled = false
  setCachedLoading(true)

  enumerateCache().then((entries) => {
    if (cancelled) return
    const grouped = groupByModelAndQuant(entries, useModelUsageStore.getState())
    // Flatten: one row per model+quantization (per CONTEXT.md decision)
    const rows = grouped.flatMap((m) =>
      m.quantizations.map((q) => ({
        modelId: m.modelId,
        quantization: q.quantization,
        size: q.size,
        lastUsed: q.lastUsed,
      }))
    )
    setCachedRows(rows)
    setCachedLoading(false)
  })

  return () => { cancelled = true }
}, [cachedAccordionOpen, executionStatus])
```

**Click handler** — add cached model to configs with auto WebGPU/WASM backend, duplicate prevention:

```typescript
function handleAddCachedModel(row: { modelId: string; quantization: string; size: number }) {
  const backend: Backend = webgpuSupported ? 'webgpu' : 'wasm'
  // Duplicate check: same modelId + quantization + non-api backend
  const alreadyAdded = configs.some(
    (c) => c.modelId === row.modelId && c.quantization === row.quantization && c.backend !== 'api'
  )
  if (alreadyAdded) return

  const config: TestConfig = {
    id: `${row.modelId}-${row.quantization}-${backend}-${crypto.randomUUID()}`,
    modelId: row.modelId,
    displayName: row.modelId.split('/').pop() ?? row.modelId,
    quantization: row.quantization as Quantization,
    backend,
    estimatedSize: row.size,
    cached: true,
  }
  addConfig(config)
}
```

**Accordion JSX** — insert BEFORE the `<div ref={wrapperRef}>` search section. Render only if `cachedRows.length > 0` OR `cachedAccordionOpen` (so toggling open triggers load even when empty). Match the cloud accordion's visual structure:

```tsx
{/* Cached Models Accordion — before HF search (per CONTEXT.md) */}
<div className="mb-4 rounded-lg border border-border">
  <button
    type="button"
    className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-secondary"
    onClick={() => setCachedAccordionOpen(!cachedAccordionOpen)}
    disabled={disabled}
  >
    <span>Cached Models</span>
    <svg
      xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${cachedAccordionOpen ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
  {cachedAccordionOpen && (
    <div className="border-t border-border px-4 pb-3 pt-2">
      {cachedLoading ? (
        <div className="text-xs text-text-tertiary">Loading cached models...</div>
      ) : cachedRows.length === 0 ? (
        <div className="text-xs text-text-tertiary">No models cached yet. Download models to see them here.</div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary">
              <th className="pb-1.5 font-semibold">Model</th>
              <th className="pb-1.5 font-semibold">Quant</th>
              <th className="pb-1.5 font-semibold text-right">Size</th>
              <th className="pb-1.5 font-semibold text-right">Last Used</th>
              <th className="pb-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {cachedRows.map((row) => {
              const alreadyAdded = configs.some(
                (c) => c.modelId === row.modelId && c.quantization === row.quantization && c.backend !== 'api'
              )
              return (
                <tr
                  key={`${row.modelId}-${row.quantization}`}
                  className={`border-t border-border/50 ${alreadyAdded ? 'opacity-40' : 'hover:bg-bg cursor-pointer'}`}
                  onClick={() => !alreadyAdded && !disabled && handleAddCachedModel(row)}
                >
                  <td className="py-1.5 pr-2 truncate max-w-[200px]" title={row.modelId}>
                    {row.modelId.split('/').pop() ?? row.modelId}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="rounded bg-webgpu-bg px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {row.quantization}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-text-tertiary">{formatSize(row.size)}</td>
                  <td className="py-1.5 text-right text-text-tertiary">
                    {row.lastUsed ? formatRelativeTime(row.lastUsed) : 'Never'}
                  </td>
                  <td className="py-1.5 text-right">
                    {alreadyAdded ? (
                      <span className="text-text-tertiary text-[10px]">added</span>
                    ) : (
                      <span className="text-primary text-[11px] font-semibold">+</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )}
</div>
```

**Helper function** — add after `formatCount()` at bottom of file:

```typescript
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
```

**Key details:**
- Accordion closed by default (matching cloud accordion pattern, per Claude's Discretion)
- Empty state shows helpful message when no cached models
- `formatSize` is imported from `../../lib/formatSize` (same utility used elsewhere)
- Rows are clickable to add, with visual disabled state when already added
- No backend picker dialog — auto-selects WebGPU with WASM fallback (per CONTEXT.md)
  </action>
  <verify>
    <automated>cd /Users/emanuele/Projects/CompareLocalLLM && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Cached Models accordion appears in ModelSelector before HF search input. Shows one row per model+quantization with name, quant, size, last-used. Clicking a row adds the model to comparison configs with correct backend. Duplicate combos are visually dimmed and non-clickable. Empty state shown when no models cached.</done>
</task>

<task type="auto">
  <name>Task 2: Add per-model retry button for failed downloads</name>
  <files>src/lib/workerBridge.ts, src/components/PreDownload/index.tsx</files>
  <action>
**Part A: Modify workerBridge.ts download-complete handler to preserve errors**

In `handleWorkerEvent`, find the `case 'download-complete':` block (currently lines 48-67). Replace it so that `downloadProgress` is NOT cleared when any model has `status: 'error'`. This preserves the error state for the retry UI:

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
    // If any errors, keep downloadProgress visible so PreDownload shows retry buttons.
    // Otherwise clear it entirely.
    const hasErrors = dp.models.some((m) => m.status === 'error')
    if (!hasErrors) {
      store.setDownloadProgress(null)
    }
  }
  store.setExecutionStatus('idle')

  // Terminate worker after download to clean up WASM/ONNX runtime state.
  // A fresh worker is created on the next operation.
  if (worker) {
    worker.terminate()
    worker = null
  }
  break
}
```

Key change: `setExecutionStatus('idle')` is called regardless (to allow interaction), but `setDownloadProgress(null)` is only called when there are NO errors.

**Part B: Add retryDownload export to workerBridge.ts**

Add this new exported function after the existing `startDownload` function (after line 164):

```typescript
export function retryDownload(config: TestConfig): void {
  const store = useCompareStore.getState()

  // Reset this model's status back to waiting
  store.updateModelDownloadStatus(config.id, {
    status: 'waiting',
    progress: 0,
    loaded: 0,
    total: 0,
    error: undefined,
  })

  store.setExecutionStatus('downloading')

  // Post single-model download command — worker handles configs[] of length 1
  const cmd: WorkerCommand = { type: 'download', configs: [config] }
  getWorker().postMessage(cmd)
}
```

Note: `getWorker()` handles creating a fresh worker if the previous one was terminated after download-complete. The worker's `handleDownload` already iterates `configs[]` and works with a single-element array.

**Part C: Update PreDownload component for retry UI**

In `src/components/PreDownload/index.tsx`:

1. Add import for `retryDownload`:
```typescript
import { startDownload, cancelExecution, retryDownload } from '../../lib/workerBridge'
```

2. Change the progress visibility condition (currently line 76: `{isDownloading && downloadProgress && (`).
   Replace with a condition that also shows progress when errors exist post-download:

```typescript
{/* Per-model progress list during download OR when errors need retry */}
{showProgress && (
```

Where `showProgress` is computed above the return:
```typescript
const hasDownloadErrors = downloadProgress?.models.some((m) => m.status === 'error') ?? false
const showProgress = (isDownloading || hasDownloadErrors) && downloadProgress !== null
```

3. Add a "Dismiss" button in the header area when showing post-download errors (status is idle but errors visible). Add this in the `.flex.items-center.gap-3` div, before the existing cancel button logic:

```tsx
{!isDownloading && hasDownloadErrors && (
  <button
    type="button"
    className="rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-text-secondary bg-surface"
    onClick={() => useCompareStore.getState().setDownloadProgress(null)}
  >
    Dismiss
  </button>
)}
```

4. Add the retry button next to each error status row. Find the error rendering block (currently line 116-118):
```tsx
{model.status === 'error' && (
  <span className="text-error">{model.error ?? 'Error'}</span>
)}
```

Replace it with:
```tsx
{model.status === 'error' && (
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-error truncate">{model.error ?? 'Error'}</span>
    <button
      type="button"
      className="shrink-0 rounded border border-primary px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
      onClick={(e) => {
        e.stopPropagation()
        const config = configs.find((c) => c.id === model.configId)
        if (config) retryDownload(config)
      }}
      disabled={isDownloading}
    >
      Retry
    </button>
  </div>
)}
```

5. Also add the `useCompareStore` import for the dismiss action (it is already imported at line 1, just need to use `.getState()` inline since it is a one-off action).

**Key details:**
- The retry button is disabled while another download is in progress (prevents concurrent downloads)
- `e.stopPropagation()` prevents any parent click handlers from firing
- After retry, `download-complete` fires again from worker — the handler re-evaluates `hasErrors` to decide whether to clear progress
- The dismiss button lets users clear error state manually when they don't want to retry
  </action>
  <verify>
    <automated>cd /Users/emanuele/Projects/CompareLocalLLM && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>When a download fails: (1) error status persists after download-complete instead of being cleared, (2) a "Retry" button appears next to each failed model in the progress list, (3) clicking Retry re-downloads only that single model via a new worker, (4) a "Dismiss" button lets users clear the error state. The download button is still usable (status returns to idle). Retry is disabled during active downloads.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Cache API -> UI | Reading cached model data for display; cache entries may contain unexpected URL patterns |
| Worker postMessage | Sending download commands to worker thread with user-selected config |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ntl-01 | T (Tampering) | enumerateCache data | accept | Cache API is same-origin only; data comes from user's own browser cache. No external input. |
| T-ntl-02 | D (DoS) | retryDownload | mitigate | Retry button disabled while `isDownloading` prevents concurrent download storms. Worker is sequential. |
| T-ntl-03 | I (Info Disclosure) | cached model list | accept | Shows user's own cached models in their own browser. No cross-user data. |
</threat_model>

<verification>
1. TypeScript compiles: `npx tsc --noEmit` passes with zero errors
2. Dev server runs: `npm run dev` starts without errors
3. Cached accordion: Open ModelSelector, click "Cached Models" — rows appear with name/quant/size/last-used
4. Cached selection: Click a cached model row — config chip appears with correct backend and "Cached" badge
5. Duplicate prevention: Click same cached model again — row is dimmed, no duplicate added
6. Download error persistence: Trigger a download failure (use invalid model ID) — error row stays visible after download completes
7. Retry button: Error row shows "Retry" button — click it — model re-downloads individually
8. Dismiss: Click "Dismiss" — error progress clears, UI returns to normal
</verification>

<success_criteria>
- Cached Models accordion renders before HF search in ModelSelector, closed by default
- Mini table rows show model name, quantization badge, size, and relative last-used time
- Clicking a row creates a TestConfig with `cached: true` and auto-detected backend
- Per-model Retry button appears on download error rows in PreDownload
- Retry re-downloads only the failed model without affecting other models' status
- Download errors persist after download-complete until dismissed or retried
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260415-ntl-cached-models-accordion-and-retry-button/260415-ntl-SUMMARY.md`
</output>
