---
phase: 260415-ntl
reviewed: 2026-04-15T12:00:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - src/components/ModelSelector/index.tsx
  - src/components/PreDownload/index.tsx
  - src/lib/workerBridge.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-04-15
**Depth:** quick (with targeted logic analysis per user request)
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Cached Models accordion (ModelSelector), per-model Retry button (PreDownload), and retry/error state handling (workerBridge). No hardcoded secrets, dangerous functions, debug artifacts, or empty catch blocks detected.

Targeted analysis of the retry and cache-loading flows revealed three logic/race-condition warnings related to concurrent worker commands during retry, stale download-complete handling after retry, and missing error handling on the async cache enumeration. One info-level finding on unhandled promise in `retryDownload`.

## Warnings

### WR-01: Retry can issue concurrent download commands to single worker

**File:** `src/lib/workerBridge.ts:171-188`
**Issue:** `retryDownload()` posts a new `download` WorkerCommand to the worker without checking whether the worker is already executing a `handleDownload` call. The worker's `onmessage` handler (`inference.worker.ts:78`) uses `await handleDownload(cmd.configs)` -- if a retry fires while an existing download batch is still running (e.g., user quickly clicks retry on two failed models, or retry fires before the previous batch's `download-complete` event is processed), the second message queues behind the first `await` in the worker event loop. This is safe from a crash perspective because Web Worker messages are processed sequentially. However, the second `handleDownload` call resets `cancelled = false` (line 99 of the worker), meaning a cancel issued between the two batches could be silently overridden. More importantly, the second `download` triggers its own `download-complete` event, which in `handleWorkerEvent` (line 48-72) terminates the worker and sets status to idle -- potentially while the first download's `download-complete` has already terminated it, causing `getWorker()` in the retry path to create a fresh worker that immediately receives no response.
**Fix:** Guard `retryDownload` to prevent re-entry while downloading:
```typescript
export function retryDownload(config: TestConfig): void {
  const store = useCompareStore.getState()
  // Prevent concurrent retry if already downloading
  if (store.executionStatus === 'downloading') return

  store.updateModelDownloadStatus(config.id, {
    status: 'waiting',
    progress: 0,
    loaded: 0,
    total: 0,
    error: undefined,
  })

  store.setExecutionStatus('downloading')

  const retryCmd: WorkerCommand = { type: 'download', configs: [config] }
  getWorker().postMessage(retryCmd)
}
```
Or alternatively, the PreDownload UI already disables the Retry button when `isDownloading` is true (line 140), but this only protects the UI path. The function itself should be defensive since it is exported and could be called programmatically.

### WR-02: download-complete after retry terminates worker and clears errors from other failed models

**File:** `src/lib/workerBridge.ts:48-72`
**Issue:** When a single-model retry completes, the worker posts `download-complete`. The handler at line 48-72 iterates all models in `downloadProgress.models` and marks complete ones as cached. Then it checks `hasErrors` across ALL models. If another model still shows `status: 'error'` from the original batch, the progress is correctly preserved. However, the handler then unconditionally terminates the worker (lines 68-71). If the user wants to retry a second failed model afterward, `getWorker()` will create a fresh worker, which is fine -- but if the ONNX runtime cached any session state in the old worker, that state is lost, potentially causing the next download to re-download files that were partially loaded in the previous worker session. This is not a crash bug but causes unnecessary re-downloads.
**Fix:** Only terminate the worker on `download-complete` when there are no remaining errors (i.e., all models succeeded and the session is fully done):
```typescript
case 'download-complete': {
  const dp = store.downloadProgress
  if (dp) {
    for (const model of dp.models) {
      if (model.status === 'complete') {
        store.updateConfig(model.configId, { cached: true })
      }
    }
    const hasErrors = dp.models.some((m) => m.status === 'error')
    if (!hasErrors) {
      store.setDownloadProgress(null)
    }
  }
  store.setExecutionStatus('idle')

  // Only terminate worker when no errors remain (user may retry)
  const remainingErrors = store.downloadProgress?.models.some((m) => m.status === 'error') ?? false
  if (!remainingErrors && worker) {
    worker.terminate()
    worker = null
  }
  break
}
```

### WR-03: Cache enumeration error silently swallowed, leaves loading spinner forever

**File:** `src/components/ModelSelector/index.tsx:122-146`
**Issue:** The `useEffect` that loads cached models calls `enumerateCache().then(...)` but has no `.catch()` handler. If `enumerateCache()` throws (e.g., Cache API not available in the browser, permission denied, or storage quota issues), the promise rejection is unhandled. The `cachedLoading` state remains `true` forever, showing "Loading cached models..." with no way to recover.
**Fix:** Add a catch handler to reset loading state:
```typescript
enumerateCache().then((entries) => {
  if (cancelled) return
  const grouped = groupByModelAndQuant(entries, useModelUsageStore.getState())
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
}).catch(() => {
  if (!cancelled) {
    setCachedRows([])
    setCachedLoading(false)
  }
})
```

## Info

### IN-01: retryDownload fire-and-forget with no caller feedback

**File:** `src/lib/workerBridge.ts:171`
**Issue:** `retryDownload` is synchronous (returns `void`) and posts a message to the worker without any callback or promise. The caller in PreDownload (line 139) has no way to know if the retry command was actually received or if the worker was in a bad state. This is consistent with `startDownload` which has the same pattern, so it is not a regression, but worth noting for future hardening.
**Fix:** Consider returning a boolean indicating whether the retry was actually dispatched (e.g., false if executionStatus was already 'downloading').

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
