---
phase: 03-prompt-input-test-controls
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/components/ExportBar/index.tsx
  - src/components/PreDownload/index.tsx
  - src/components/PromptInput/index.tsx
  - src/components/TestControls/index.tsx
  - src/components/TestProgress/index.tsx
  - src/lib/workerBridge.ts
  - src/pages/ComparePage.tsx
  - src/stores/useCompareStore.ts
  - src/stores/useSettingsStore.ts
  - src/types/index.ts
  - src/workers/inference.worker.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the PromptInput, TestControls, TestProgress, PreDownload, ExportBar components together with the stores, types, worker bridge, and inference worker that support them. The architecture is coherent: state flows cleanly through Zustand, the worker protocol uses typed discriminated unions, and error handling is present at most boundaries.

One critical bug exists in the inference worker: `download-complete` is emitted unconditionally even when the download was cancelled, causing the store to be updated as if the download finished successfully. Five warnings cover a non-null assertion that can crash on rare race conditions, a parameter-input edge case that allows `0` tokens, incorrect `totalModels` counts when mixing cloud and local models, the progress bar showing 100% immediately when running a single model, and lost error results after cancellation. Three info-level items cover an unreliable `startedAt` timestamp, a magic number in a progress calculation, and a redundant double-filtering of local configs.

---

## Critical Issues

### CR-01: `download-complete` posted after cancellation resets state incorrectly

**File:** `src/workers/inference.worker.ts:98`

**Issue:** `post({ type: 'download-complete' })` is unconditional — it fires whether the `for` loop completed normally or exited early because `cancelled === true`. The `download-complete` handler in `workerBridge.ts` (lines 46-65) then marks all `status === 'complete'` models as `cached: true`, sets `executionStatus` to `'idle'`, and clears `downloadProgress`. This means a cancelled download finishes by setting status to `'idle'` (not `'cancelled'`), making it indistinguishable from a clean finish. Any model that completed a shard before the cancel is incorrectly marked cached.

Note: `cancelExecution()` in the main thread also terminates the worker immediately, so in practice the worker is often killed before reaching line 98. However, if `cancelled` is set via the `'cancel'` command message (the non-termination path) rather than `worker.terminate()`, the race is fully exposed.

**Fix:**
```typescript
// inference.worker.ts — at the end of handleDownload()
if (!cancelled) {
  post({ type: 'download-complete' })
}
```

---

## Warnings

### WR-01: Non-null assertion on config lookup can crash if config was removed

**File:** `src/lib/workerBridge.ts:105`

**Issue:** `store.configs.find((c) => c.id === event.configId)!` uses `!` to assert the result is non-null. If the user removes a model config while a run is in progress (or if there is any desync between worker state and store state), `find()` returns `undefined`. The non-null assertion silently coerces it and the resulting `TestResult` will have `config: undefined`, causing downstream crashes in components that render `result.config.displayName` etc.

**Fix:**
```typescript
const config = store.configs.find((c) => c.id === event.configId)
if (!config) break  // or continue — config no longer in store, skip
store.addResult({
  config,
  // ...
})
```

### WR-02: Number input allows `0` to be stored when field is cleared

**File:** `src/components/PromptInput/index.tsx:113`

**Issue:** `onChange={(e) => onChange(Number(e.target.value))}` converts an empty string (produced when the user fully clears the field) to `0` via `Number('')`. For `maxTokens` this passes `max_new_tokens: 0` to the worker and cloud APIs, generating zero tokens and producing empty output with no error message. The `min={1}` attribute on the input prevents using the spinner control below 1, but keyboard-cleared values bypass min/max enforcement.

**Fix:**
```typescript
onChange={(e) => {
  const n = Number(e.target.value)
  if (!isNaN(n) && e.target.value !== '') {
    onChange(Math.min(max, Math.max(min, n)))
  }
}}
```

### WR-03: `totalModels` mismatch between cloud progress and worker progress

**File:** `src/lib/workerBridge.ts:167-177`

**Issue:** Inside `startComparison`, the cloud-model progress is set with `totalModels: configs.length` (the full list of all configs) and `currentIndex: configs.indexOf(config)`. Inside `handleRun` in the worker, `totalModels` is `localConfigs.length` (only local models). When a user runs 2 cloud + 1 local model:
- Cloud run 1 reports `(1/3)`, cloud run 2 reports `(2/3)`.
- Local run reports `(1/1)` — the progress display jumps back to `(1/1)`.

The `TestProgress` component renders `(currentIndex + 1)/{totalModels}` directly (line 49), producing a confusing counter. The progress bar percentage also resets to ~100% for the single local model.

**Fix:** Assign consistent indices by passing the full configs array (and the local model's offset within it) to the worker, or track a global model index in the store and have the worker accept `startIndex` and `totalModels` as parameters:
```typescript
// In startComparison, pass offset to worker:
const cmd: WorkerCommand = {
  type: 'run',
  prompt,
  params,
  configs: localConfigs,
  startIndex: cloudConfigs.length,   // offset into full list
  totalModels: configs.length,       // full count
}
```

### WR-04: Progress bar shows 100% immediately when running a single model

**File:** `src/components/TestProgress/index.tsx:38`

**Issue:** `progressPct = Math.round(((currentIndex + 1) / totalModels) * 100)`. When there is only one model (`totalModels = 1`, `currentIndex = 0`), this evaluates to 100% as soon as the first `run-started` event fires — before any loading, initializing, or generating has occurred. The progress bar renders full for the entire duration of the run, which is misleading.

**Fix:** Base progress on model-level phase completion rather than model index. An alternative is to track per-token progress or use an indeterminate bar during single-model runs:
```typescript
// Show indeterminate if single model, otherwise use model index
const progressPct = totalModels <= 1
  ? undefined  // render an indeterminate / animated bar instead
  : Math.round((currentIndex / totalModels) * 100)  // note: currentIndex, not +1
```

### WR-05: Error results silently dropped after cancellation

**File:** `src/lib/workerBridge.ts:103`

**Issue:** The error handler only adds a `TestResult` when `store.executionStatus === 'running'`. If `cancelExecution()` has already set status to `'cancelled'` before a late-arriving `'error'` event is processed, the error is silently discarded — no result, no UI feedback for the user about which model failed and why. This matters for the download-error path too (line 96), where a download error for a specific model is only shown if `downloadProgress` is still non-null (which `cancelExecution` clears).

**Fix:** The guards are appropriate for preventing phantom results, but the intent should be documented and the discard should at minimum be a `console.warn` so developers can detect unexpected drops during testing:
```typescript
// After the executionStatus check:
} else {
  console.warn('[workerBridge] Error event discarded (status:', store.executionStatus, ')', event)
}
```

---

## Info

### IN-01: `startedAt` uses first result timestamp rather than run start time

**File:** `src/components/ExportBar/index.tsx:17`

**Issue:** `const startedAt = results.length > 0 ? results[0].timestamp : Date.now()`. `results[0].timestamp` is the time that result was assembled (after `runCloudModel` returned), not when the run started. If a fast cloud model finishes first, `startedAt` is the first result completion time, not the true run start. The `ComparisonRun` interface includes `startedAt` semantically as the run start.

**Fix:** Store a `runStartedAt` timestamp in `useCompareStore` when `startComparison` calls `store.reset()`, then read it in `ExportBar`. Alternatively, pass it down from the store's existing `executionStatus` transition timestamp.

### IN-02: Magic `100` in progress bar width cap

**File:** `src/components/PreDownload/index.tsx:109`

**Issue:** `Math.min(model.progress, 100)` — the literal `100` is a magic number representing the max percentage value. While obvious in context, a named constant improves clarity and is consistent with the rest of the codebase.

**Fix:**
```typescript
const MAX_PROGRESS_PCT = 100
// ...
style={{ width: `${model.status === 'complete' ? MAX_PROGRESS_PCT : Math.min(model.progress, MAX_PROGRESS_PCT)}%` }}
```

### IN-03: `handleDownload` in worker re-filters configs already filtered by caller

**File:** `src/workers/inference.worker.ts:33`

**Issue:** `const localConfigs = configs.filter((c) => c.backend !== 'api')` — `startDownload` in `workerBridge.ts` already filters to `uncachedLocal` before sending the command (line 130). The worker re-applies the backend filter, making the worker's behavior dependent on the caller having done the right thing, while also redundantly re-filtering. The comment in `PreDownload/index.tsx` (line 31) notes the same ambiguity. Pick one authoritative filter location.

**Fix:** Either trust the caller and remove the re-filter in the worker, or remove the filter in the caller and let the worker be the single source of truth. Given the worker operates in isolation, it is the safer place to own the filter:
```typescript
// workerBridge.ts startDownload — simplify to pass all local configs,
// let the worker decide what to download:
const cmd: WorkerCommand = { type: 'download', configs: localConfigs }
// worker already filters out api backends and handles caching
```

---

_Reviewed: 2026-04-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
