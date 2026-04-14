---
phase: quick-260414-hut
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types/worker-messages.ts
  - src/types/index.ts
  - src/workers/inference.worker.ts
  - src/lib/workerBridge.ts
  - src/components/OutputComparison/index.tsx
autonomous: true

must_haves:
  truths:
    - "GatherBlockQuantized/ERROR_CODE:9 errors show user-friendly message with Retry button instead of raw ONNX error"
    - "Sequence length cache errors show 'model not supported' message without Retry button"
    - "Clicking Retry terminates the worker, recreates it, and re-runs the same comparison"
    - "Non-retryable errors guide the user to try a different model"
  artifacts:
    - path: "src/types/worker-messages.ts"
      provides: "retryable field on WorkerEvent error type"
      contains: "retryable"
    - path: "src/types/index.ts"
      provides: "Extended ErrorCategory type with local error categories"
      contains: "session-init"
    - path: "src/workers/inference.worker.ts"
      provides: "Error classification logic for both ONNX error patterns"
      contains: "ERROR_CODE: 9"
    - path: "src/lib/workerBridge.ts"
      provides: "Error event handler that maps retryable/category to TestResult fields"
      contains: "retryable"
    - path: "src/components/OutputComparison/index.tsx"
      provides: "Retry button for retryable local errors, guidance for non-retryable"
      contains: "Retry"
  key_links:
    - from: "src/workers/inference.worker.ts"
      to: "src/types/worker-messages.ts"
      via: "WorkerEvent error type with retryable + category fields"
      pattern: "retryable.*true|retryable.*false"
    - from: "src/lib/workerBridge.ts"
      to: "src/stores/useCompareStore.ts"
      via: "addResult with errorCategory, errorHint, rawError, retryable"
      pattern: "retryable.*event"
    - from: "src/components/OutputComparison/index.tsx"
      to: "src/lib/workerBridge.ts"
      via: "Retry button calls cancelExecution + startComparison"
      pattern: "cancelExecution|startComparison"
---

<objective>
Fix two ONNX runtime errors that currently show raw error messages to users: (1) GatherBlockQuantized session failure after download (retryable by restarting the worker) and (2) sequence length cache error during generation (non-retryable library limitation for certain model architectures).

Purpose: Users currently see cryptic ONNX error strings with no guidance. This fix classifies each error, shows clear human-readable messages, and provides a Retry button where appropriate -- using the same errorCategory/errorHint/rawError pattern already established for cloud API errors.

Output: Both error types caught, classified, and surfaced with appropriate UI affordances (Retry vs. "Try a different model").
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260414-hut-fix-onnx-runtime-errors-gatherblockquant/260414-hut-CONTEXT.md
@.planning/quick/260414-hut-fix-onnx-runtime-errors-gatherblockquant/260414-hut-RESEARCH.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From src/types/worker-messages.ts (current):
```typescript
export type WorkerEvent =
  | { type: 'download-progress'; data: DownloadProgress }
  | { type: 'download-complete' }
  | { type: 'run-started'; configId: string; modelName: string; currentIndex: number; totalModels: number }
  | { type: 'run-progress'; data: RunProgress }
  | { type: 'run-complete'; result: TestResult }
  | { type: 'all-complete' }
  | { type: 'error'; configId?: string; modelName?: string; message: string }
  | { type: 'device-lost'; message: string }
```

From src/types/index.ts (relevant current types):
```typescript
export type CloudErrorCategory = 'cors' | 'auth' | 'rate-limit' | 'timeout' | 'server' | 'unknown'

export interface TestResult {
  config: TestConfig
  metrics: TestMetrics
  output: string
  rating: number | null
  timestamp: number
  error?: string
  fallbackBackend?: Backend
  errorCategory?: CloudErrorCategory
  errorHint?: string
  rawError?: string
}
```

From src/lib/workerBridge.ts (error handler, lines 114-140):
```typescript
case 'error':
  if (event.configId && store.downloadProgress) {
    store.updateModelDownloadStatus(event.configId, {
      status: 'error',
      error: event.message,
    })
  }
  if (event.configId && store.executionStatus === 'running') {
    store.addResult({
      config: store.configs.find((c) => c.id === event.configId)!,
      metrics: { modelSize: null, loadTime: null, initTime: null, ttft: 0, tokensPerSecond: 0, totalTime: 0, tokenCount: 0 },
      output: '',
      rating: null,
      timestamp: Date.now(),
      error: event.message,
    })
  }
  break
```

From src/components/OutputComparison/index.tsx (error display pattern, lines 109-143):
- Uses r.errorCategory for badge label via ERROR_CATEGORY_LABELS map
- Uses r.errorHint ?? r.error for description text
- Uses r.rawError for collapsible raw error details
- Cloud errors already follow this pattern; local errors currently only set r.error

From src/lib/workerBridge.ts (retry mechanism already available):
```typescript
export function cancelExecution()  // terminates worker, sets worker=null
export async function startComparison(prompt, params, configs)  // creates fresh worker via getWorker()
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add error classification types and worker error detection</name>
  <files>src/types/index.ts, src/types/worker-messages.ts, src/workers/inference.worker.ts</files>
  <action>
**1. Expand the error category type in `src/types/index.ts`:**

Rename `CloudErrorCategory` to `ErrorCategory` and add local error categories. Update the type alias:

```typescript
export type ErrorCategory = 'cors' | 'auth' | 'rate-limit' | 'timeout' | 'server' | 'session-init' | 'model-compat' | 'unknown'
```

Also add `retryable?: boolean` to the `TestResult` interface (after `rawError`).

Then find every reference to `CloudErrorCategory` in the codebase and update to `ErrorCategory`. The references are in:
- `src/types/index.ts` (the definition + TestResult.errorCategory)
- `src/lib/workerBridge.ts` (the cloud error handling in startComparison)
- `src/lib/cloudApis.ts` (classifyCloudError return type)

**2. Add `retryable`, `errorCategory`, and `errorHint` to the WorkerEvent error variant in `src/types/worker-messages.ts`:**

Change the error event from:
```typescript
| { type: 'error'; configId?: string; modelName?: string; message: string }
```
to:
```typescript
| { type: 'error'; configId?: string; modelName?: string; message: string; retryable?: boolean; errorCategory?: ErrorCategory; errorHint?: string }
```

Import `ErrorCategory` from the types index.

**3. Add targeted error classification in `src/workers/inference.worker.ts`:**

In the `handleRun` function's catch block (lines 162-179), BEFORE creating the errorResult, classify the error. Add a helper function `classifyLocalError` at module level:

```typescript
function classifyLocalError(err: unknown): { message: string; errorHint: string; errorCategory: 'session-init' | 'model-compat' | 'unknown'; retryable: boolean } {
  const msg = err instanceof Error ? err.message : String(err)

  // ONNX session creation failure — WebGPU kernel registry not ready after download
  if (msg.includes('ERROR_CODE: 9') || msg.includes('Could not find an implementation for')) {
    return {
      message: msg,
      errorHint: 'WebGPU session failed to initialize for this model. This sometimes happens after downloading a model. Click Retry to restart.',
      errorCategory: 'session-init',
      retryable: true,
    }
  }

  // transformers.js DynamicCache limitation — model architecture not supported
  if (msg.includes('Unable to determine sequence length from the cache')) {
    return {
      message: msg,
      errorHint: 'This model\'s architecture is not compatible with browser-based text generation. Try a different model or quantization.',
      errorCategory: 'model-compat',
      retryable: false,
    }
  }

  return {
    message: msg,
    errorHint: msg,
    errorCategory: 'unknown',
    retryable: true,
  }
}
```

Then update the catch block in `handleRun` (lines 162-179) to use this classification. Replace the raw error message in the errorResult with classified fields:

```typescript
catch (err) {
  const classified = classifyLocalError(err)
  const errorResult: TestResult = {
    config,
    metrics: {
      modelSize: null, loadTime: null, initTime: null,
      ttft: 0, tokensPerSecond: 0, totalTime: 0, tokenCount: 0,
    },
    output: '',
    rating: null,
    timestamp: Date.now(),
    error: classified.errorHint,
    errorCategory: classified.errorCategory,
    errorHint: classified.errorHint,
    rawError: classified.message,
    retryable: classified.retryable,
  }
  post({ type: 'run-complete', result: errorResult })
}
```

Note: The error now goes through `run-complete` (which it already does), so it will be handled by `addResult` in the store. This is the correct path since it creates a proper TestResult with all fields.

Also add classification to the `handleDownload` catch block (lines 124-131) for completeness — use the same `classifyLocalError` function and include the classified fields in the error event posted. For download errors, keep using `type: 'error'` but add the new fields:

```typescript
catch (err) {
  const classified = classifyLocalError(err)
  post({
    type: 'error',
    configId: config.id,
    modelName: config.displayName,
    message: classified.errorHint,
    retryable: classified.retryable,
    errorCategory: classified.errorCategory,
    errorHint: classified.errorHint,
  })
}
```

Import `ErrorCategory` type in the worker file (add to the import from `'../types'`).
  </action>
  <verify>
    <automated>cd /Users/emanuele/Projects/CompareLocalLLM && npx tsc --noEmit 2>&1 | head -40</automated>
  </verify>
  <done>
    - ErrorCategory type includes 'session-init' and 'model-compat' alongside existing cloud categories
    - TestResult has retryable?: boolean field
    - WorkerEvent error variant has retryable, errorCategory, errorHint optional fields
    - Worker classifies GatherBlockQuantized (ERROR_CODE: 9) as session-init/retryable
    - Worker classifies sequence length cache error as model-compat/non-retryable
    - All existing CloudErrorCategory references updated to ErrorCategory
    - TypeScript compiles with zero errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Propagate error classification through workerBridge and add Retry UI</name>
  <files>src/lib/workerBridge.ts, src/components/OutputComparison/index.tsx, src/components/ComparisonTable/index.tsx</files>
  <action>
**1. Update workerBridge.ts error handler (lines 114-140):**

In the `case 'error'` handler, propagate the new fields from the event to the TestResult when creating error results for running models:

```typescript
case 'error':
  if (event.configId && store.downloadProgress) {
    store.updateModelDownloadStatus(event.configId, {
      status: 'error',
      error: event.message,
    })
  }
  if (event.configId && store.executionStatus === 'running') {
    store.addResult({
      config: store.configs.find((c) => c.id === event.configId)!,
      metrics: {
        modelSize: null, loadTime: null, initTime: null,
        ttft: 0, tokensPerSecond: 0, totalTime: 0, tokenCount: 0,
      },
      output: '',
      rating: null,
      timestamp: Date.now(),
      error: event.message,
      errorCategory: event.errorCategory,
      errorHint: event.errorHint ?? event.message,
      rawError: event.message,
      retryable: event.retryable,
    })
  }
  break
```

Note: Most local errors now go through `run-complete` with a full TestResult (from Task 1). This `case 'error'` path is for download errors and any edge cases where the worker posts an error event directly.

**2. Update OutputComparison/index.tsx to show Retry button:**

Add these imports at the top:
```typescript
import { cancelExecution, startComparison } from '../../lib/workerBridge'
import { useSettingsStore } from '../../stores/useSettingsStore'
```

Add to the component body (alongside existing selectors):
```typescript
const prompt = useCompareStore((s) => s.prompt)
const parameters = useSettingsStore((s) => s.parameters)
const executionStatus = useCompareStore((s) => s.executionStatus)
```

Add the ERROR_CATEGORY_LABELS entries for the new categories. Update the existing map:
```typescript
const ERROR_CATEGORY_LABELS: Record<string, string> = {
  cors: 'CORS Blocked',
  auth: 'Auth Failed',
  'rate-limit': 'Rate Limited',
  timeout: 'Timeout',
  server: 'Server Error',
  'session-init': 'Session Failed',
  'model-compat': 'Not Compatible',
  unknown: 'Unknown Error',
}
```

In the error display section (inside the `.mt-2.5.space-y-2` div, after the collapsible raw error section at ~line 143), add a Retry button for retryable errors:

```tsx
{/* Retry / guidance actions */}
<div className="flex items-center gap-2 mt-1">
  {r.retryable ? (
    <button
      type="button"
      className="rounded-lg border border-primary px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={executionStatus === 'running' || executionStatus === 'downloading'}
      onClick={() => {
        cancelExecution()
        void startComparison(prompt, parameters, configs)
      }}
    >
      Retry All Models
    </button>
  ) : (
    <span className="text-xs text-text-tertiary">
      Try removing this model and running again.
    </span>
  )}
</div>
```

The Retry button:
- Calls `cancelExecution()` to terminate the worker and set worker=null
- Then calls `startComparison()` with the same prompt/params/configs (re-read from store)
- Is disabled while a run or download is already in progress
- Per user decision: no silent auto-retry -- user sees the error and chooses to click Retry

**3. Update ComparisonTable/index.tsx:**

Add the new error category labels to the `ERROR_CATEGORY_LABELS` map (same additions as OutputComparison):
```typescript
'session-init': 'Session Failed',
'model-compat': 'Not Compatible',
```

No other changes needed in ComparisonTable -- it already displays errorCategory badges for errors.
  </action>
  <verify>
    <automated>cd /Users/emanuele/Projects/CompareLocalLLM && npx tsc --noEmit 2>&1 | head -40 && npx eslint src/types/index.ts src/types/worker-messages.ts src/workers/inference.worker.ts src/lib/workerBridge.ts src/components/OutputComparison/index.tsx src/components/ComparisonTable/index.tsx 2>&1 | head -40</automated>
  </verify>
  <done>
    - workerBridge error handler propagates errorCategory, errorHint, rawError, retryable to TestResult
    - OutputComparison shows "Retry All Models" button for retryable errors (session-init, unknown)
    - OutputComparison shows "Try removing this model and running again" guidance for non-retryable errors (model-compat)
    - Retry button is disabled during active runs/downloads to prevent double-execution
    - Retry calls cancelExecution() then startComparison() with current prompt/params/configs
    - ComparisonTable displays "Session Failed" and "Not Compatible" category labels
    - Both new error categories appear in ERROR_CATEGORY_LABELS in both components
    - TypeScript compiles and ESLint passes with zero errors
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Worker -> Main thread | Error messages from ONNX runtime flow through postMessage |
| User click -> Worker restart | Retry button terminates and recreates worker |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hut-01 | Spoofing | Error string matching | accept | Error patterns are from local ONNX runtime in same origin; no external input. String includes() checks are sufficient. |
| T-hut-02 | Denial of Service | Retry button rapid clicks | mitigate | Disable retry button when executionStatus is 'running' or 'downloading' to prevent spawning multiple workers |
| T-hut-03 | Information Disclosure | Raw error in collapsible | accept | Raw ONNX errors shown only on user action (toggle); contains no secrets, just runtime debug info |
</threat_model>

<verification>
1. TypeScript compiles: `npx tsc --noEmit` passes with zero errors
2. ESLint passes: `npx eslint src/types/ src/workers/ src/lib/workerBridge.ts src/components/OutputComparison/ src/components/ComparisonTable/` passes
3. Dev server runs: `npm run dev` starts without errors
4. Manual test (GatherBlockQuantized): Download a quantized model, immediately run it on WebGPU. If ERROR_CODE: 9 occurs, verify: user-friendly message appears, "Session Failed" badge shown, "Retry All Models" button visible and functional
5. Manual test (sequence length): Run a model known to trigger sequence length error (SSM/hybrid architecture). Verify: "Not Compatible" badge shown, no retry button, "Try removing this model" guidance shown, raw error collapsible works
</verification>

<success_criteria>
- Both ONNX error patterns are caught and classified before reaching the user
- GatherBlockQuantized errors show "Session Failed" badge + Retry button
- Sequence length cache errors show "Not Compatible" badge + guidance text
- Retry button terminates worker, creates fresh worker, re-runs comparison
- No silent auto-retry -- user always sees error first and chooses to retry
- Error classification reuses existing errorCategory/errorHint/rawError pattern from cloud errors
- Zero TypeScript errors, zero ESLint errors
</success_criteria>

<output>
After completion, create `.planning/quick/260414-hut-fix-onnx-runtime-errors-gatherblockquant/260414-hut-SUMMARY.md`
</output>
