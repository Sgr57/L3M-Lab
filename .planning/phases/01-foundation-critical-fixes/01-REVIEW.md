---
phase: 01-foundation-critical-fixes
reviewed: 2026-04-10T12:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - vite.config.ts
  - src/workers/inference.worker.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed `vite.config.ts` and `src/workers/inference.worker.ts`. The Vite configuration is clean and correct -- cross-origin headers, HuggingFace transforms exclusion, and ES worker format are all properly configured.

The inference worker has solid structure with good defensive patterns (streaming fallback for token counts, proper error-to-result conversion, cache size estimation wrapped in try/catch). However, there are three warnings: unhandled promise rejections from the async `onmessage` handler, a misleading `download-complete` signal when individual downloads have failed, and redundant type assertions that bypass the type checker instead of using type narrowing.

## Warnings

### WR-01: Unhandled promise rejection in async onmessage handler

**File:** `src/workers/inference.worker.ts:11`
**Issue:** The `onmessage` handler is `async` but the returned promise is never caught. If `handleDownload` or `handleRun` throw an unexpected error that is not caught by their internal try/catch blocks (e.g., a TypeError from malformed `cmd` data, or the `await` itself rejects before entering the function), the promise rejection goes unhandled. In worker contexts, unhandled rejections can silently kill the worker without any feedback to the main thread.
**Fix:** Wrap the handler body in a top-level try/catch that posts a generic error event:
```typescript
self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  try {
    const cmd = e.data

    if (cmd.type === 'cancel') {
      cancelled = true
      return
    }

    if (cmd.type === 'download') {
      await handleDownload(cmd.configs)
      return
    }

    if (cmd.type === 'run') {
      cancelled = false
      await handleRun(cmd.prompt, cmd.params, cmd.configs)
      return
    }
  } catch (err) {
    post({
      type: 'error',
      message: `Worker unhandled error: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}
```

### WR-02: download-complete posted regardless of individual download failures

**File:** `src/workers/inference.worker.ts:88`
**Issue:** When one or more model downloads fail (caught at line 78-85, which posts individual error events), the loop continues and `download-complete` is unconditionally posted at line 88. The main thread receives `download-complete` even if every single download failed, which can mislead the UI into showing a success state or enabling the "Run" action when models are not actually cached.
**Fix:** Track failure count and either post a different event or include failure information:
```typescript
async function handleDownload(configs: TestConfig[]) {
  const localConfigs = configs.filter((c) => c.backend !== 'api')
  let failedCount = 0

  for (const config of localConfigs) {
    try {
      // ... existing download logic ...
    } catch (err) {
      failedCount++
      post({
        type: 'error',
        configId: config.id,
        modelName: config.displayName,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  post({ type: 'download-complete' })
  // Alternatively, extend the event type:
  // post({ type: 'download-complete', failedCount })
}
```
At minimum, the main thread handler should check whether any `error` events were received before treating `download-complete` as full success.

### WR-03: Redundant type assertions bypass type checker on backend narrowing

**File:** `src/workers/inference.worker.ts:49,153-154`
**Issue:** The code uses `config.quantization as 'q4' | 'q8' | 'fp16' | 'fp32'` and `config.backend as 'webgpu' | 'wasm'` type assertions. The `Quantization` type already matches the asserted type, making that cast redundant. The `backend` assertion to `'webgpu' | 'wasm'` is logically safe because `api` configs are filtered out at line 32/96, but using `as` hides this invariant from the type system. If the `Backend` type later gains a new variant (e.g., `'cuda'`), these assertions would silently suppress a type error.
**Fix:** Use a type guard or assertion function that the type checker can verify:
```typescript
// Option A: Extract the narrowed type after filtering
type LocalBackend = Exclude<Backend, 'api'>

const localConfigs = configs.filter(
  (c): c is TestConfig & { backend: LocalBackend } => c.backend !== 'api'
)

// Then config.backend is already typed as 'webgpu' | 'wasm'
const generator = await pipeline('text-generation', config.modelId, {
  dtype: config.quantization,
  device: config.backend,
})
```

## Info

### IN-01: Error metrics indistinguishable from zero-value measurements

**File:** `src/workers/inference.worker.ts:118-126`
**Issue:** When a model run fails, the error result sets `ttft: 0`, `tokensPerSecond: 0`, `totalTime: 0`, and `tokenCount: 0`. These are valid metric values that could represent an actual (extremely fast or immediately-failing) run. Unlike `modelSize`, `loadTime`, and `initTime` which use `number | null`, these fields are typed as plain `number`, making it impossible for downstream consumers to distinguish "measured zero" from "not measured due to error." This is a type design limitation rather than a bug, since the `error` field on `TestResult` can be checked to determine if metrics are meaningful.
**Fix:** Consider expanding the `TestMetrics` type to use `number | null` for all fields, or document the convention that metrics are meaningless when `TestResult.error` is set.

### IN-02: Cancellation not responsive during long model loading or warm-up

**File:** `src/workers/inference.worker.ts:100,152,164`
**Issue:** The `cancelled` flag is checked only at the top of the `for` loop (line 100). The `pipeline()` call (line 152) and warm-up generation (line 164) can each take 10+ seconds for large models. During this time, a cancel command sets the flag but the worker continues the current model to completion before checking. The user experience is that cancellation appears unresponsive until the current model finishes loading.
**Fix:** This is inherent to the `@huggingface/transformers` API which does not support cancellation tokens. Document this limitation or add a cancelled check between the load and warm-up phases:
```typescript
const loadTime = performance.now() - loadStart
if (cancelled) throw new Error('Cancelled')

// Phase: Initializing
// ...
const initTime = performance.now() - initStart
if (cancelled) throw new Error('Cancelled')
```

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
