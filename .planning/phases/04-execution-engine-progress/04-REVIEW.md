---
phase: 04-execution-engine-progress
reviewed: 2026-04-11T12:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/FallbackBanner/index.tsx
  - src/components/OutputComparison/index.tsx
  - src/components/TestProgress/index.tsx
  - src/lib/cloudApis.ts
  - src/lib/workerBridge.ts
  - src/pages/ComparePage.tsx
  - src/stores/useCompareStore.ts
  - src/types/index.ts
  - src/types/worker-messages.ts
  - src/workers/inference.worker.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The execution engine and progress tracking implementation is well-structured overall. The worker bridge, cloud API layer, and inference worker demonstrate solid architecture with proper error handling patterns, discriminated unions for worker messages, and a clean state management approach. However, there are two critical issues: a non-null assertion that can crash at runtime when a config is removed during execution, and the Google API key being exposed in URL query parameters where it can leak into browser history and server logs. There are also several warnings around unhandled async errors and misleading UI for error results.

## Critical Issues

### CR-01: Non-null assertion on config lookup can crash at runtime

**File:** `src/lib/workerBridge.ts:111`
**Issue:** The expression `store.configs.find((c) => c.id === event.configId)!` uses a non-null assertion. If the user removes a config from the store while the worker is still running (e.g., via `removeConfig`), the `find()` returns `undefined`, and the non-null assertion causes the code to proceed with `undefined` as a `TestConfig`. This will crash downstream when accessing `config.id`, `config.displayName`, etc. on the `undefined` value.
**Fix:**
```typescript
case 'error':
  // Mark model as errored in download progress if downloading
  if (event.configId && store.downloadProgress) {
    store.updateModelDownloadStatus(event.configId, {
      status: 'error',
      error: event.message,
    })
  }
  // Existing run-error handling
  if (event.configId && store.executionStatus === 'running') {
    const config = store.configs.find((c) => c.id === event.configId)
    if (!config) break  // Config was removed during execution; skip result
    store.addResult({
      config,
      metrics: {
        modelSize: null,
        loadTime: null,
        initTime: null,
        ttft: 0,
        tokensPerSecond: 0,
        totalTime: 0,
        tokenCount: 0,
      },
      output: '',
      rating: null,
      timestamp: Date.now(),
      error: event.message,
    })
  }
  break
```

### CR-02: Google API key exposed in URL query parameter

**File:** `src/lib/cloudApis.ts:194`
**Issue:** The Google API key is passed as a query parameter (`?key=${apiKey}`) in the URL. While this is the Google-documented approach for their REST API, it means the API key appears in browser history, network logs, any proxy/CDN logs, and the `Referer` header on subsequent navigations. For a client-side application where the key is already stored in localStorage, this is an additional exposure vector. Browser DevTools Network tab will show the full URL with the key to anyone with physical access.
**Fix:** This is how Google's Generative Language API works (key-in-URL is their design), so a full fix requires a proxy. As a mitigation, consider adding a comment documenting the risk, and ensure the Settings page warns users that API keys are stored locally and visible in network requests. Alternatively, if Google ever supports Bearer token auth for this endpoint, switch to that. For now, at minimum document the known exposure:
```typescript
// SECURITY NOTE: Google's API requires the key in the URL query string.
// This exposes the key in browser history, DevTools Network tab, and any
// intermediary logs. Users should be aware their key is visible in network traffic.
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  { ... }
)
```

## Warnings

### WR-01: Unhandled clipboard API error in copyOutput

**File:** `src/components/OutputComparison/index.tsx:59-61`
**Issue:** `navigator.clipboard.writeText()` can throw if the page does not have focus, if permissions are denied, or in non-secure contexts (HTTP). The `await` is not wrapped in try/catch, so a rejected promise will become an unhandled promise rejection. Additionally, there is no user feedback on success or failure.
**Fix:**
```typescript
const copyOutput = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard write can fail if page lacks focus or permissions
    // Silently fail for now; could show a toast notification
  }
}
```

### WR-02: Metrics header renders misleading "0.0 tok/s" and "0 tokens" for error results

**File:** `src/components/OutputComparison/index.tsx:124-128`
**Issue:** The metrics header (tokens/second, token count, total time) renders for all results, including error results that have zeroed metrics. This displays "0.0 tok/s", "0 tokens", "0 ms" for failed models, which is misleading -- it suggests the model ran and produced nothing, rather than that it failed. The output body section correctly differentiates error vs. success (line 132), but the header does not.
**Fix:** Conditionally hide metrics for error results:
```typescript
<div className="flex items-center gap-3 text-[11px] text-text-secondary">
  {r.error ? (
    <span className="text-error font-medium">Failed</span>
  ) : (
    <>
      <span>{r.metrics.tokensPerSecond.toFixed(1)} tok/s</span>
      <span>{r.metrics.tokenCount} tokens</span>
      <span>{formatTime(r.metrics.totalTime)}</span>
    </>
  )}
</div>
```

### WR-03: Cloud model execution loop does not check for cancellation between models

**File:** `src/lib/workerBridge.ts:179-247`
**Issue:** The `startComparison` function iterates over `cloudConfigs` in a for-loop (line 179), but never checks `store.executionStatus` for `'cancelled'` between iterations. If the user calls `cancelExecution()` during a cloud API call, the current fetch will complete (no AbortController), and the loop will proceed to the next cloud model. The cancellation only terminates the worker (for local models). Cloud models will continue executing sequentially until all are done.
**Fix:** Check cancellation status at the top of each loop iteration:
```typescript
for (let i = 0; i < cloudConfigs.length; i++) {
  // Check if user cancelled between cloud model runs
  if (useCompareStore.getState().executionStatus === 'cancelled') break

  const config = cloudConfigs[i]
  // ... rest of loop
}
```
For a more thorough fix, also pass an `AbortController` signal to each `fetch()` call in `cloudApis.ts` and abort it when `cancelExecution()` is called.

### WR-04: `download-complete` event marks all "complete" models as cached, even if some errored

**File:** `src/lib/workerBridge.ts:48-66`
**Issue:** When `download-complete` fires, the handler iterates over `dp.models` and marks any model with `status === 'complete'` as cached (line 52). This is correct in isolation. However, the handler then unconditionally calls `store.setExecutionStatus('idle')` (line 57), even if some models errored during download. The user sees the status return to 'idle' with no indication that some downloads failed. The errored models remain in the download progress list but that list is immediately nulled out (line 58).
**Fix:** After the download-complete event, check if any models errored and set status accordingly:
```typescript
case 'download-complete': {
  const dp = store.downloadProgress
  if (dp) {
    const hasErrors = dp.models.some((m) => m.status === 'error')
    for (const model of dp.models) {
      if (model.status === 'complete') {
        store.updateConfig(model.configId, { cached: true })
      }
    }
    // If some downloads failed, transition to error state instead of idle
    store.setExecutionStatus(hasErrors ? 'error' : 'idle')
  } else {
    store.setExecutionStatus('idle')
  }
  store.setDownloadProgress(null)
  // ... worker termination
  break
}
```

### WR-05: BackendBadge in TestProgress hardcodes "webgpu" for all local models

**File:** `src/components/TestProgress/index.tsx:117`
**Issue:** The variable `backendType` is set to `'webgpu'` for all non-cloud models (`const backendType = isCloud ? 'api' : 'webgpu'`). This means WASM models will display a "webgpu" badge color and label during execution, even though they are running on the WASM backend. The `BackendBadge` component at line 176 checks `backend === 'wasm'` for correct display, but it receives `'webgpu'` for WASM models. Additionally, when a WebGPU model falls back to WASM, the badge still shows "webgpu".
**Fix:** Derive the backend from the `runProgress` data. The `RunProgress` type does not currently carry the backend, so either add a `backend` field to `RunProgress`, or look up the config:
```typescript
// Quick fix: check if runProgress phase indicates local, then look up actual backend from config
const config = useCompareStore((s) => s.configs.find((c) => c.id === runProgress?.configId))
const backendType = isCloud ? 'api' : (config?.backend ?? 'webgpu')
```

## Info

### IN-01: Expand/Collapse button shown for error results where it has no visible effect

**File:** `src/components/OutputComparison/index.tsx:178-185`
**Issue:** The Expand/Collapse button and the Copy button are rendered for error results, but error results show the error details section (line 132-165) instead of the output text. The Expand toggle controls `max-h-20 overflow-hidden` on the output text div, which is not rendered for error results. The Copy button copies `r.output` which is `''` for errors. Both actions are effectively no-ops for error results.
**Fix:** Conditionally render the footer buttons:
```typescript
{!r.error && (
  <button ... onClick={() => toggleExpand(r.config.id)}>
    {isExpanded ? 'Collapse' : 'Expand'}
  </button>
)}
```
And for Copy, disable or hide when `r.output` is empty.

### IN-02: Module-level mutable state in workerBridge.ts

**File:** `src/lib/workerBridge.ts:8-9`
**Issue:** `totalModelCount` and `cloudModelOffset` are module-level mutable variables used to coordinate progress between cloud and worker execution. While this works for a single concurrent comparison, it creates implicit coupling and would break if the architecture ever supported concurrent runs. This is acceptable for the current POC scope but worth noting for future refactoring.
**Fix:** No immediate action needed. If the architecture evolves to support concurrent runs, encapsulate these in a per-run context object.

### IN-03: Redundant error classification code in startComparison catch block

**File:** `src/lib/workerBridge.ts:210-225`
**Issue:** The catch block initializes `category`, `hint`, and `rawError` with default values (lines 211-213), then immediately overwrites them in both branches of the `if/else` (lines 215-225). The initial assignments are dead code since every path through the conditional reassigns all three variables.
**Fix:** Simplify by removing the dead default assignments:
```typescript
} catch (err) {
  const classified = err instanceof CloudApiError
    ? classifyCloudError(err, err.provider, err.status)
    : classifyCloudError(err, config.provider ?? 'unknown')

  store.addResult({
    config,
    metrics: { ... },
    output: '',
    rating: null,
    timestamp: Date.now(),
    error: classified.hint,
    errorCategory: classified.category,
    errorHint: classified.hint,
    rawError: classified.rawError,
  })
}
```

---

_Reviewed: 2026-04-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
