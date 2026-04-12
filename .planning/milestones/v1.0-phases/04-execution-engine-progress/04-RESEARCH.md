# Phase 4: Execution Engine & Progress - Research

**Researched:** 2026-04-11
**Domain:** Web Worker execution pipeline, WebGPU device management, cloud API error handling, progress tracking
**Confidence:** HIGH

## Summary

Phase 4 hardens the existing sequential execution pipeline in the inference worker, adds weighted progress tracking, implements WebGPU device loss detection with automatic WASM fallback, and classifies cloud API errors with actionable user hints. The existing codebase is well-structured -- `inference.worker.ts` already has load/warmup/generate/dispose phases, `workerBridge.ts` handles cloud and local orchestration, and `TestProgress` already displays all required metrics. The work is additive: enhance the progress bar formula, wrap pipeline calls with device-loss detection, add error classification to cloud APIs, and extend types/store with fallback state.

The most technically nuanced area is WebGPU device loss detection. ONNX Runtime Web exposes the GPU device via `env.webgpu.device` (a Promise) after the first WebGPU session is created. This allows attaching a `GPUDevice.lost` handler inside the worker thread. However, since device loss may manifest as a thrown error during `pipeline()` or `generator()` calls rather than only through the `.lost` promise, the implementation must use a dual-detection strategy: proactive via `.lost` promise AND reactive via try/catch with error message pattern matching.

**Primary recommendation:** Implement device loss detection using both `GPUDevice.lost` promise (attached after first WebGPU pipeline load) and try/catch error classification. Use error message pattern matching (`device lost`, `device hung`, `DXGI_ERROR`) to identify GPU failures when the `.lost` promise races against thrown errors.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Overall progress bar uses weighted phases per model. Each model gets an equal slice. Within each slice: loading=10%, initializing=10%, generating=80%. Generating portion tracks token progress against `maxTokens`.
- **D-02:** Cloud models are included in the overall progress bar. They get their own slice; fills instantly when response arrives.
- **D-03:** TestProgress component already shows model name, phase, token count, tok/s, elapsed time, streaming text. These stay as-is.
- **D-04:** When WebGPU device lost mid-run: show warning banner ("WebGPU device lost -- switching remaining models to WASM"), auto-retry the failed model on WASM, continue all remaining WebGPU models on WASM. No user action needed.
- **D-05:** Warning banner persists until the run completes.
- **D-06:** Fallback noted in test results. TestResult gets `fallbackBackend` field. Results UI shows "WebGPU -> WASM".
- **D-07:** GPU memory release between runs uses `generator.dispose()`. Research to determine if additional cleanup needed.
- **D-08:** While cloud API call in-flight, show live elapsed timer: model name + "Waiting for response..." + timer counting up (100ms interval). When response arrives, show result.
- **D-09:** Cloud progress reuses existing TestProgress component layout.
- **D-10:** Cloud API errors categorized with actionable hints. Categories: CORS blocked, auth failed, rate limited, timeout, unknown. Collapsible "Show raw error" section.
- **D-11:** Error results appear inline in results list alongside successful results. Red-tinted card with error category, hint, collapsible raw details.

### Claude's Discretion
- HTTP status code ranges for error classification
- Exact weights for load/init/generate phases (10/10/80 guideline)
- WebGPU device loss detection mechanism
- Whether to add delay between model dispose and next model load
- Implementation of elapsed timer for cloud calls (setInterval in component vs store-driven)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXEC-01 | Sequential model execution: load, warm-up, generate, collect metrics, dispose | Already implemented in `runSingleModel()`. Needs GPU memory safety hardening. |
| EXEC-02 | Live progress display: model name, phase, tokens, speed, elapsed | Already implemented in `TestProgress` + `postProgress()`. Needs weighted bar formula. |
| EXEC-03 | Progress bar showing overall completion across all models | Currently simple `(currentIndex+1)/totalModels`. Must become weighted formula per D-01. |
| EXEC-04 | Streaming text output visible in real-time | Already implemented via TextStreamer + `streamedText` in RunProgress. No changes needed. |
| EXEC-05 | GPU memory properly released between sequential model runs | `generator.dispose()` exists. Research confirms `session.release()` clears GPU buffer cache. Add small delay as safety margin. |
| EXEC-06 | WebGPU device loss detected with automatic WASM fallback | New capability. Use dual detection: `GPUDevice.lost` promise + try/catch error classification. |
| EXEC-07 | Cloud models executed with TTFT/tok/s/total time measured | Already implemented in `cloudApis.ts`. Needs elapsed timer in UI per D-08. |
| EXEC-08 | CORS errors distinguished from auth errors with clear messaging | New capability. Error classification wrapper around cloud API calls. |
</phase_requirements>

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @huggingface/transformers | 4.0.1 | Local LLM inference via ONNX Runtime | Already installed, provides `pipeline()`, `TextStreamer`, `dispose()` [VERIFIED: package.json] |
| onnxruntime-web | 1.25.0-dev | WebGPU/WASM execution provider | Bundled with transformers.js. GPU buffer cache auto-cleanup on session dispose [VERIFIED: node_modules] |
| zustand | 5.0.12 | State management for progress, fallback, errors | Already installed, stores use selector pattern [VERIFIED: package.json] |
| React | 19.2.4 | UI components for progress, error cards, banners | Already installed [VERIFIED: package.json] |

### Supporting (No New Packages Needed)

This phase requires zero new npm dependencies. All functionality is built with browser APIs and existing libraries.

| Capability | Implementation | Source |
|------------|---------------|--------|
| WebGPU device loss detection | `GPUDevice.lost` promise (native Web API) | [CITED: developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost] |
| ONNX GPU device access | `env.backends.onnx.webgpu.device` (Promise) | [VERIFIED: node_modules/onnxruntime-common/lib/env.ts line 237] |
| Error classification | `response.status` codes + `TypeError` catch | [CITED: fetch spec behavior] |
| Elapsed timer | `setInterval` (native) | Browser API |

**Installation:** None needed -- all dependencies already present.

## Architecture Patterns

### Modified Project Structure (Changes Only)

```
src/
  types/
    index.ts              # Add fallbackBackend to TestResult, CloudErrorCategory type
    worker-messages.ts    # Add 'device-lost' WorkerEvent type
  workers/
    inference.worker.ts   # Add device loss detection, WASM fallback retry, inter-model delay
  lib/
    workerBridge.ts       # Add fallback banner state, cloud elapsed timer, total progress calc
    cloudApis.ts          # Add error classification wrapper (classifyCloudError)
  stores/
    useCompareStore.ts    # Add fallbackWarning state, setFallbackWarning action
  components/
    TestProgress/index.tsx  # Add weighted progress bar calculation, cloud timer display
    FallbackBanner/index.tsx  # NEW: Persistent warning banner for WebGPU fallback
  pages/
    ComparePage.tsx        # Add FallbackBanner render
```

### Pattern 1: Weighted Progress Bar Calculation

**What:** Replace simple `(currentIndex+1)/totalModels` with weighted per-phase formula.
**When to use:** Calculating overall progress percentage in TestProgress.
**Formula:**

```typescript
// Per D-01: Each model gets equal slice. Within each slice: load=10%, init=10%, gen=80%
// Cloud models: fill instantly when response arrives (D-02)

function calculateWeightedProgress(
  currentIndex: number,
  totalModels: number,
  phase: RunProgress['phase'] | 'waiting' | 'cloud-pending' | 'cloud-complete',
  tokensGenerated: number,
  maxTokens: number
): number {
  const completedSlice = (currentIndex / totalModels) * 100
  const modelSlice = 100 / totalModels

  let phaseProgress: number
  switch (phase) {
    case 'loading':
      phaseProgress = 0 // 0-10% of model slice
      break
    case 'initializing':
      phaseProgress = 0.10 // 10-20% of model slice
      break
    case 'generating': {
      const genProgress = maxTokens > 0
        ? Math.min(tokensGenerated / maxTokens, 1)
        : 0
      phaseProgress = 0.20 + (genProgress * 0.80) // 20-100%
      break
    }
    case 'disposing':
      phaseProgress = 1.0
      break
    case 'cloud-pending':
      phaseProgress = 0 // fills to 100% when done
      break
    case 'cloud-complete':
      phaseProgress = 1.0
      break
    default:
      phaseProgress = 0
  }

  return completedSlice + (modelSlice * phaseProgress)
}
```

### Pattern 2: WebGPU Device Loss Detection (Dual Strategy)

**What:** Detect GPU device loss both proactively and reactively.
**When to use:** Around every `pipeline()` call with `device: 'webgpu'`.

```typescript
// In inference.worker.ts
import { env } from '@huggingface/transformers'

let gpuDeviceLost = false

// Attach .lost handler AFTER first WebGPU pipeline load
async function attachDeviceLostHandler(): Promise<void> {
  try {
    // Access ONNX Runtime's GPU device after session creation
    const device = await env.backends.onnx.webgpu.device
    if (device) {
      device.lost.then((info: GPUDeviceLostInfo) => {
        if (info.reason !== 'destroyed') {
          gpuDeviceLost = true
          post({
            type: 'device-lost',
            message: `WebGPU device lost: ${info.message}`,
          })
        }
      })
    }
  } catch {
    // If we can't access the device, rely on try/catch detection
  }
}

// Error pattern matching for reactive detection
function isDeviceLostError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    msg.includes('device lost') ||
    msg.includes('device hung') ||
    msg.includes('dxgi_error') ||
    msg.includes('gpu device') ||
    msg.includes('context lost') ||
    gpuDeviceLost // flag set by .lost promise
  )
}
```

### Pattern 3: Cloud API Error Classification

**What:** Categorize fetch errors into actionable categories.
**When to use:** Wrapping all cloud API calls.

```typescript
// [VERIFIED: fetch spec behavior from MDN and whatwg/fetch]
type CloudErrorCategory = 'cors' | 'auth' | 'rate-limit' | 'timeout' | 'server' | 'unknown'

interface ClassifiedError {
  category: CloudErrorCategory
  hint: string
  rawError: string
  provider: string
}

function classifyCloudError(err: unknown, provider: string, status?: number): ClassifiedError {
  const rawError = err instanceof Error ? err.message : String(err)

  // TypeError: Failed to fetch = network/CORS (fetch never rejects on HTTP errors)
  if (err instanceof TypeError) {
    return {
      category: 'cors',
      hint: provider === 'anthropic'
        ? 'Anthropic API has CORS restrictions. A browser proxy may be needed.'
        : `Network error reaching ${provider} API. Check your connection or CORS settings.`,
      rawError,
      provider,
    }
  }

  // HTTP status-based classification
  if (status) {
    if (status === 401 || status === 403) {
      return {
        category: 'auth',
        hint: `Check your ${provider} API key in Settings.`,
        rawError,
        provider,
      }
    }
    if (status === 429) {
      return {
        category: 'rate-limit',
        hint: `${provider} rate limit exceeded. Wait a moment and try again.`,
        rawError,
        provider,
      }
    }
    if (status === 408 || status === 504) {
      return {
        category: 'timeout',
        hint: `${provider} request timed out. Try a shorter prompt or try again.`,
        rawError,
        provider,
      }
    }
    if (status >= 500) {
      return {
        category: 'server',
        hint: `${provider} server error. Try again later.`,
        rawError,
        provider,
      }
    }
  }

  return { category: 'unknown', hint: 'An unexpected error occurred.', rawError, provider }
}
```

### Pattern 4: Cloud Elapsed Timer (Component-Driven)

**What:** Live timer showing elapsed time while cloud API call is in-flight.
**Recommendation:** Use `setInterval` inside the TestProgress component rather than pumping timer updates through the store. This keeps the store clean and avoids 10 updates/second hitting Zustand.

```typescript
// In TestProgress component
const [cloudElapsed, setCloudElapsed] = useState(0)
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

useEffect(() => {
  if (runProgress?.phase === 'cloud-pending') {
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      setCloudElapsed(Date.now() - start)
    }, 100)
  } else {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setCloudElapsed(0)
  }
  return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
}, [runProgress?.phase, runProgress?.configId])
```

### Anti-Patterns to Avoid

- **Pumping timer updates through Zustand:** 10 updates/sec to the store causes unnecessary re-renders across all subscribers. Keep the timer local to TestProgress.
- **Awaiting `GPUDevice.lost` directly:** The promise may never resolve. Always use `.then()` callback, never `await`.
- **Assuming CORS errors have status codes:** When CORS blocks a response, the browser throws TypeError with NO status code. Classification must handle this as a separate branch from HTTP status errors.
- **Creating a new GPUAdapter/Device manually:** ONNX Runtime manages the device internally. Use `env.backends.onnx.webgpu.device` to access it, never create your own.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GPU device management | Custom WebGPU device lifecycle | ONNX Runtime's internal device + `env.backends.onnx.webgpu.device` for monitoring | ONNX Runtime manages buffer caching, device creation, session binding. Interfering causes buffer-device mismatches [CITED: onnxruntime issue #26107] |
| GPU memory cleanup | Manual buffer.destroy() calls | `pipeline.dispose()` which calls `session.release()` | ONNX RT v1.25 auto-clears GPU buffer cache when last session is disposed [VERIFIED: onnxruntime issue #21574, fix merged in PR #22490] |
| Token counting | TextStreamer chunk count | `tokenizer.encode()` for final count | Already implemented in worker per FNDN-03. Chunk count != token count due to multi-byte tokens |
| Progress bar animation | Manual CSS transitions | Tailwind `transition-all duration-300` | Already used in TestProgress component [VERIFIED: codebase] |

**Key insight:** The GPU memory lifecycle is managed by ONNX Runtime Web. `dispose()` -> `session.release()` -> GPU buffer cache cleared when no active sessions remain. Adding a small delay (50-100ms) between dispose and next model load provides a safety margin for the GPU driver to reclaim memory, but is not strictly required.

## Common Pitfalls

### Pitfall 1: GPU Buffer Cache Retention
**What goes wrong:** After `dispose()`, GPU memory appears still allocated because ONNX RT caches popular buffer sizes for reuse.
**Why it happens:** ONNX Runtime Web maintains an internal GPU buffer pool to avoid expensive re-allocations.
**How to avoid:** The fix for this (clearing cache when last session is disposed) was merged in onnxruntime PR #22490 and is included in the installed version (1.25.0-dev). Verify by checking that `generator.dispose()` is awaited before loading next model.
**Warning signs:** GPU memory usage in Chrome task manager doesn't decrease between models. [VERIFIED: github.com/microsoft/onnxruntime/issues/21574]

### Pitfall 2: TypeError Misclassification as CORS
**What goes wrong:** Network timeouts, DNS failures, and disconnects all throw `TypeError: Failed to fetch`, same as CORS blocks.
**Why it happens:** The Fetch spec intentionally hides CORS failure details for security. All network-level failures produce the same error type.
**How to avoid:** For Anthropic specifically, always classify TypeError as CORS (documented restriction). For OpenAI/Google, check if API key is present first -- if missing, hint at auth. If present, hint at network/CORS with provider-specific guidance.
**Warning signs:** Users reporting "CORS error" when their internet is actually down. [CITED: whatwg/fetch issue #443]

### Pitfall 3: Device Loss During Generate vs During Load
**What goes wrong:** Device loss during `pipeline()` (loading) has different recovery behavior than during `generator()` (inference).
**Why it happens:** During load, the session hasn't completed creation -- there's nothing to dispose. During generate, tensors may be left in GPU memory.
**How to avoid:** Wrap both `pipeline()` and `generator()` in try/catch. On device loss during load, skip dispose (session never created). On device loss during generate, attempt dispose in a try/catch (may fail, that's OK). In both cases, retry on WASM.
**Warning signs:** Unhandled promise rejection after device loss, or double-dispose errors. [CITED: toji.dev/webgpu-best-practices/device-loss.html]

### Pitfall 4: Cloud Progress Total Model Count Mismatch
**What goes wrong:** Cloud models run in `workerBridge.ts` main thread, local models run in worker. `totalModels` for the worker only counts local models. Progress bar shows wrong total.
**Why it happens:** Current code splits cloud/local configs and sends only `localConfigs` to the worker. Worker's `totalModels` doesn't include cloud models.
**How to avoid:** Track total model count (cloud + local) in the store or pass it to the worker. The weighted progress calculation must account for ALL models in the run, not just the subset the worker knows about. Compute progress in `workerBridge.ts` or the component, where both counts are available.
**Warning signs:** Progress bar jumps from 0% to 40% when cloud models complete before local models start.

### Pitfall 5: Race Between `.lost` Promise and Error Throw
**What goes wrong:** The `.lost` promise and the error thrown by ONNX Runtime may resolve in unpredictable order.
**Why it happens:** The WebGPU spec guarantees `.lost` settles before other promises, but ONNX Runtime's error propagation adds latency.
**How to avoid:** Use the `gpuDeviceLost` boolean flag set by `.lost` handler. Check this flag in the catch block of pipeline/generator calls. If the flag is set OR the error matches device-loss patterns, treat as device loss.
**Warning signs:** Inconsistent detection -- sometimes caught as device loss, sometimes as generic error. [CITED: gpuweb/gpuweb issue #5244]

## Code Examples

### Modifying cloudApis.ts for Error Classification

```typescript
// Source: existing cloudApis.ts pattern + error classification research

// Change: cloud API functions must return the HTTP status to enable classification.
// Current pattern: throw new Error(`OpenAI API error: ${res.status} ${err}`)
// New pattern: throw a structured error or return the status alongside the throw.

// Option A (recommended): Modify throw to include parseable status
export class CloudApiError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    public readonly rawBody: string,
    message: string
  ) {
    super(message)
    this.name = 'CloudApiError'
  }
}

// In callOpenAI:
if (!res.ok) {
  const err = await res.text()
  throw new CloudApiError('openai', res.status, err, `OpenAI API error: ${res.status}`)
}

// In workerBridge.ts runCloudModel catch:
catch (err) {
  if (err instanceof CloudApiError) {
    classified = classifyCloudError(err, err.provider, err.status)
  } else {
    classified = classifyCloudError(err, config.provider ?? 'unknown')
  }
  // Store classified error in result
}
```

### Worker Fallback Loop

```typescript
// Source: inference.worker.ts modification for EXEC-06

async function runSingleModel(
  config: TestConfig,
  prompt: string,
  params: GenerationParameters,
  currentIndex: number,
  totalModels: number
): Promise<TestResult> {
  let effectiveBackend = config.backend as 'webgpu' | 'wasm'
  let fallbackBackend: string | undefined

  // If GPU was previously lost this run, force WASM
  if (gpuDeviceLost && effectiveBackend === 'webgpu') {
    effectiveBackend = 'wasm'
    fallbackBackend = 'wasm'
  }

  try {
    return await executeModel(config, prompt, params, currentIndex, totalModels, effectiveBackend)
  } catch (err) {
    if (effectiveBackend === 'webgpu' && isDeviceLostError(err)) {
      gpuDeviceLost = true
      post({
        type: 'device-lost',
        message: 'WebGPU device lost -- switching remaining models to WASM',
      })

      // Retry this model on WASM
      try {
        const result = await executeModel(config, prompt, params, currentIndex, totalModels, 'wasm')
        result.fallbackBackend = 'wasm'
        return result
      } catch (retryErr) {
        // WASM also failed -- return error result
        throw retryErr
      }
    }
    throw err
  }
}
```

### Type Extensions

```typescript
// Source: types/index.ts additions

export interface TestResult {
  config: TestConfig
  metrics: TestMetrics
  output: string
  rating: number | null
  timestamp: number
  error?: string
  fallbackBackend?: Backend       // NEW: set when model fell back from WebGPU to WASM
  errorCategory?: CloudErrorCategory  // NEW: categorized cloud error
  errorHint?: string              // NEW: actionable hint for the error
  rawError?: string               // NEW: raw error string for "Show raw error"
}

export type CloudErrorCategory = 'cors' | 'auth' | 'rate-limit' | 'timeout' | 'server' | 'unknown'

// types/worker-messages.ts addition
export type WorkerEvent =
  | { type: 'device-lost'; message: string }
  // ... existing events
```

### Store Extension for Fallback Warning

```typescript
// Source: useCompareStore.ts additions

interface CompareState {
  // ... existing fields
  fallbackWarning: string | null  // NEW: e.g. "WebGPU device lost -- remaining models using WASM"

  setFallbackWarning: (warning: string | null) => void
  // ... existing actions
}

// In reset():
set({ fallbackWarning: null, /* ...existing resets */ })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ONNX RT kept GPU buffer cache after session release | GPU buffer cache auto-cleared on last session dispose | Oct 2024 (PR #22490) | `dispose()` now truly frees GPU memory [VERIFIED: onnxruntime issue #21574] |
| transformers.js v3 required manual ONNX wasm path config | v4 bundles ONNX Runtime with zero config | Mar 2025 | No `ort.env.wasm.wasmPaths` setup needed [VERIFIED: installed v4.0.1] |
| WebGPU device loss was poorly spec'd | `GPUDevice.lost` promise is stable spec | 2024+ | Reliable detection mechanism in all supporting browsers [CITED: MDN GPUDevice.lost] |

**Deprecated/outdated:**
- `env.backends.onnx.webgpu.adapter` property is deprecated. Use `GPUDevice.adapterInfo` instead. [VERIFIED: onnxruntime-common env.ts line 221]
- `env.backends.onnx.webgpu.powerPreference` is deprecated. Create your own adapter if needed. [VERIFIED: onnxruntime-common env.ts line 192]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 50-100ms delay between dispose and next model load is sufficient safety margin | Don't Hand-Roll | LOW -- worst case GPU reclamation is slower on some hardware; retry will still work |
| A2 | ONNX Runtime error messages contain "device lost" or "device hung" strings when GPU fails | Architecture Patterns (isDeviceLostError) | MEDIUM -- if error messages differ, detection may miss some cases; the `gpuDeviceLost` flag from `.lost` promise is the primary mechanism |
| A3 | `env.backends.onnx.webgpu.device` is accessible after first WebGPU pipeline load in a worker thread | Architecture Patterns | LOW -- verified the type exists in source; runtime behavior in worker confirmed by onnxruntime docs stating device is accessible after session creation |

## Open Questions (RESOLVED)

1. **Inter-model delay duration**
   - What we know: `dispose()` + `session.release()` triggers GPU buffer cache cleanup in ONNX RT 1.25. The GPU driver then reclaims memory asynchronously.
   - What's unclear: Optimal delay for diverse GPU hardware (integrated vs discrete, different driver versions).
   - Recommendation: Start with 50ms delay (`await new Promise(r => setTimeout(r, 50))`). This is conservative enough for most hardware without adding noticeable user-facing latency. Can be tuned empirically.

2. **Anthropic CORS behavior stability**
   - What we know: `anthropic-dangerous-direct-browser-access: true` header is currently supported. STATE.md flags this as a research concern.
   - What's unclear: Whether Anthropic will continue supporting this header long-term.
   - Recommendation: Classify Anthropic TypeError as CORS with a specific hint about the proxy requirement. This matches reality regardless of header support status.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed (no test framework detected) |
| Config file | None |
| Quick run command | `npx tsc --noEmit` (type checking only) |
| Full suite command | `npx tsc --noEmit && npx eslint .` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXEC-01 | Sequential execution with dispose | manual | Dev tools GPU memory monitor | N/A |
| EXEC-02 | Live progress display metrics | manual | Visual inspection during run | N/A |
| EXEC-03 | Weighted progress bar | manual + type check | `npx tsc --noEmit` (type correctness) | N/A |
| EXEC-04 | Streaming text output | manual | Already working, visual verification | N/A |
| EXEC-05 | GPU memory release | manual | Chrome task manager GPU process | N/A |
| EXEC-06 | WebGPU device loss -> WASM fallback | manual | `device.destroy()` in console or about:gpucrash | N/A |
| EXEC-07 | Cloud API timing metrics | manual | Run comparison with cloud model | N/A |
| EXEC-08 | Error classification | manual + type check | `npx tsc --noEmit` + test with bad API key | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit && npx eslint .`
- **Phase gate:** Full type check + manual run through all execution scenarios

### Wave 0 Gaps
- No test framework installed -- all validation is manual + type checking
- This is acceptable for a POC project per CLAUDE.md constraints

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- API keys are user-provided, stored in localStorage |
| V3 Session Management | no | N/A -- no sessions |
| V4 Access Control | no | N/A -- client-side only |
| V5 Input Validation | yes | Validate API response structure before accessing nested properties |
| V6 Cryptography | no | N/A -- no crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in error messages | Information Disclosure | Strip API keys from error messages before display. Never include raw request headers in UI. |
| Cloud API response injection | Tampering | Already mitigated: responses are displayed as text, not interpreted as HTML/JS. React auto-escapes. |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: node_modules] @huggingface/transformers 4.0.1 installed, onnxruntime-web 1.25.0-dev installed
- [VERIFIED: node_modules/onnxruntime-common/lib/env.ts] `env.webgpu.device` Promise API for GPU device access
- [VERIFIED: node_modules/@huggingface/transformers/src/pipelines/_base.js] `dispose()` calls `model.dispose()` which calls `session.release()`
- [VERIFIED: codebase] All six primary target files read and analyzed

### Secondary (MEDIUM confidence)
- [CITED: developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost] GPUDevice.lost Promise API and GPUDeviceLostInfo structure
- [CITED: toji.dev/webgpu-best-practices/device-loss.html] Device loss recovery strategies, causes, testing
- [CITED: github.com/microsoft/onnxruntime/issues/21574] GPU buffer cache cleanup fix in PR #22490
- [CITED: whatwg/fetch issue #443] CORS preflight failure produces TypeError with no status code

### Tertiary (LOW confidence)
- [ASSUMED: A2] Exact error message strings from ONNX Runtime on device loss

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies verified in node_modules, no new packages needed
- Architecture: HIGH -- existing code thoroughly analyzed, patterns grounded in verified APIs
- Pitfalls: HIGH -- each pitfall traced to specific issues/specs with citations
- WebGPU device loss detection: MEDIUM -- API is well-documented but ONNX RT integration path has assumption A2/A3

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable APIs, no fast-moving dependencies)
