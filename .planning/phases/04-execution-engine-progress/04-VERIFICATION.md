---
phase: 04-execution-engine-progress
verified: 2026-04-11T14:00:00Z
status: gaps_found
score: 4/5 success criteria verified
overrides_applied: 0
gaps:
  - truth: "The execution pipeline compiles and builds successfully for production"
    status: failed
    reason: "tsc -b (the command used by npm run build) fails with TS1294 errors in cloudApis.ts and TS18048 in inference.worker.ts. tsc --noEmit passes because it uses the root tsconfig.json which does not directly apply tsconfig.app.json's erasableSyntaxOnly constraint."
    artifacts:
      - path: "src/lib/cloudApis.ts"
        issue: "Lines 10-12: constructor parameter properties (public readonly provider, status, rawBody) violate erasableSyntaxOnly: true in tsconfig.app.json (TS1294). The CloudApiError class needs to be rewritten without parameter property shorthand."
      - path: "src/workers/inference.worker.ts"
        issue: "Line 17: env.backends.onnx.webgpu is possibly undefined (TS18048). The attachDeviceLostHandler must add a null check before accessing .webgpu.device."
    missing:
      - "Fix CloudApiError class: remove parameter property shorthand, declare fields explicitly and assign in constructor body"
      - "Fix attachDeviceLostHandler: add null check for env.backends.onnx?.webgpu?.device before awaiting"
---

# Phase 4: Execution Engine & Progress Verification Report

**Phase Goal:** Sequential model execution is stable, observable, and handles failure gracefully -- users see live progress and streaming output for every model run
**Verified:** 2026-04-11T14:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Models execute sequentially with load, warm-up, generate, metrics collection, and dispose -- GPU memory properly released | VERIFIED | `executeModel` in inference.worker.ts implements full pipeline: loadStart, pipeline(), initStart, generator() warm-up, TextStreamer generation, generator.dispose() in try/catch. 50ms inter-model delay in handleRun (line 184). |
| 2 | Live progress shows model name, phase, token count, tok/s, elapsed time with overall progress bar | VERIFIED | TestProgress/index.tsx has `calculateWeightedProgress` with all 6 phase cases, PHASE_LABELS for all phases, token/speed/elapsed stats display. BackendBadge component. Cloud elapsed timer via setInterval at 100ms. |
| 3 | Streaming text output visible in real-time during generation | VERIFIED | TextStreamer with callback_function appends to streamedText; postProgress emits streamedText on every token; TestProgress renders streamedText in JSX (line 167-171). |
| 4 | WebGPU device loss detected and remaining models automatically fall back to WASM | VERIFIED | inference.worker.ts: gpuDeviceLost flag, attachDeviceLostHandler (GPUDevice.lost promise), isDeviceLostError (error pattern matching), runSingleModel retries on WASM. workerBridge.ts: device-lost handler calls setFallbackWarning. FallbackBanner displayed in ComparePage. |
| 5 | Cloud models execute via direct API calls with TTFT/tok/s/total time measured; CORS errors distinguished from auth errors | VERIFIED | cloudApis.ts implements callOpenAI/callAnthropic/callGoogle with performance.now() timing. classifyCloudError handles TypeError (cors), 401/403 (auth), 429 (rate-limit), 408/504 (timeout), 500+ (server). OutputComparison shows ERROR_CATEGORY_LABELS badges. |

**Score:** 5/5 success criteria verified in the codebase

**Critical finding (gap):** While all 5 success criteria are behaviorally implemented, the production build (`npm run build` / `tsc -b`) fails with 4 TypeScript errors, meaning the code cannot currently be deployed. The `tsc --noEmit` command (used by the plans' verification steps) passes with exit code 0 because it uses the root tsconfig.json which does not invoke `tsconfig.app.json` with `erasableSyntaxOnly: true` — this discrepancy masked the issue during plan execution.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/index.ts` | CloudErrorCategory type, extended TestResult and RunProgress | VERIFIED | CloudErrorCategory exported line 4; TestResult has fallbackBackend, errorCategory, errorHint, rawError (lines 43-46); RunProgress.phase includes cloud-pending, cloud-complete (line 81) |
| `src/types/worker-messages.ts` | device-lost WorkerEvent variant | VERIFIED | Line 18: `{ type: 'device-lost'; message: string }` |
| `src/stores/useCompareStore.ts` | fallbackWarning state and setFallbackWarning action | VERIFIED | fallbackWarning field (line 18), setFallbackWarning action (line 28, impl line 78), reset includes fallbackWarning: null (line 98) |
| `src/lib/cloudApis.ts` | CloudApiError class and classifyCloudError function | STUB (build-broken) | Class and function exist and are substantively implemented, but CloudApiError uses parameter property syntax that violates erasableSyntaxOnly (TS1294) — build fails |
| `src/workers/inference.worker.ts` | Device loss detection, WASM fallback retry, inter-model delay | STUB (build-broken) | gpuDeviceLost, attachDeviceLostHandler, isDeviceLostError, executeModel all exist. attachDeviceLostHandler accesses env.backends.onnx.webgpu without null check — TS18048 in build |
| `src/components/TestProgress/index.tsx` | Weighted progress bar, cloud timer, backend badge | VERIFIED | calculateWeightedProgress with 6 cases, setInterval cloud timer, BackendBadge component, PHASE_LABELS with all 6 entries |
| `src/components/FallbackBanner/index.tsx` | Persistent warning banner for WebGPU fallback | VERIFIED | Reads fallbackWarning from store, returns null when not set, renders with warning styling |
| `src/components/OutputComparison/index.tsx` | Enhanced error cards with category badge, hint, raw error toggle, fallback indicator | VERIFIED | ERROR_CATEGORY_LABELS map, rawErrorExpanded state, toggleRawError, Show/Hide raw error buttons, r.errorCategory/errorHint/rawError used, r.fallbackBackend fallback indicator |
| `src/pages/ComparePage.tsx` | FallbackBanner placement | VERIFIED | Imports FallbackBanner (line 12), reads fallbackWarning (line 17), renders `{fallbackWarning && <FallbackBanner />}` (line 29) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| src/lib/cloudApis.ts | src/types/index.ts | CloudErrorCategory import | WIRED | Line 1: `import type { GenerationParameters, TestMetrics, CloudErrorCategory } from '../types'` |
| src/stores/useCompareStore.ts | src/types/index.ts | fallbackWarning uses null/string | WIRED | fallbackWarning declared as `string | null` (line 18) |
| src/workers/inference.worker.ts | src/types/worker-messages.ts | posts device-lost WorkerEvent | WIRED | Lines 23-26 in attachDeviceLostHandler, lines 219-223 in runSingleModel both post `{ type: 'device-lost', message: ... }` |
| src/lib/workerBridge.ts | src/stores/useCompareStore.ts | setFallbackWarning on device-lost | WIRED | Line 130-131: `case 'device-lost': store.setFallbackWarning(event.message)` |
| src/lib/workerBridge.ts | src/lib/cloudApis.ts | classifyCloudError on cloud API errors | WIRED | Line 5 imports both CloudApiError and classifyCloudError; used in startComparison error catch block (lines 215-225) |
| src/components/TestProgress/index.tsx | src/stores/useCompareStore.ts | runProgress selector with new phase values | WIRED | Lines 72-74 use selectors for runProgress, executionStatus, maxTokens |
| src/components/FallbackBanner/index.tsx | src/stores/useCompareStore.ts | fallbackWarning selector | WIRED | Lines 4-5: `const fallbackWarning = useCompareStore((s) => s.fallbackWarning)` |
| src/components/OutputComparison/index.tsx | src/types/index.ts | errorCategory, errorHint, rawError, fallbackBackend fields | WIRED | All four new TestResult fields used in JSX (lines 137, 147, 150, 118) |
| src/pages/ComparePage.tsx | src/components/FallbackBanner/index.tsx | import and render | WIRED | Line 12 imports, line 29 renders |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|---------------------|--------|
| TestProgress | runProgress | useCompareStore (set by workerBridge.handleWorkerEvent) | Yes -- worker posts run-progress events with real token counts and timing | FLOWING |
| FallbackBanner | fallbackWarning | useCompareStore (set by setFallbackWarning from device-lost handler) | Yes -- populated when GPU device loss event arrives from worker | FLOWING |
| OutputComparison error cards | r.errorCategory, r.errorHint, r.rawError | TestResult from store.results (populated by startComparison cloud error catch) | Yes -- classifyCloudError returns real classification based on error type/status | FLOWING |
| OutputComparison fallback indicator | r.fallbackBackend | TestResult.fallbackBackend set in runSingleModel when WASM fallback occurs | Yes -- set to 'wasm' string when device loss retry path executes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript noEmit (root config) | `npx tsc --noEmit` | exit 0, no output | PASS |
| TypeScript app config (build config) | `npx tsc --project tsconfig.app.json --noEmit` | exit 2, 4 errors (TS1294 x3, TS18048 x1) | FAIL |
| npm run build | `npm run build` | fails at `tsc -b` step with same 4 errors | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| EXEC-01 | 04-02 | Sequential execution with load, warm-up, generate, metrics, dispose | SATISFIED | executeModel in inference.worker.ts implements full phase sequence including generator.dispose() in try/catch |
| EXEC-02 | 04-03 | Live progress: model name, phase, token count, tok/s, elapsed time | SATISFIED | TestProgress renders all fields from runProgress; PHASE_LABELS covers all 6 phases |
| EXEC-03 | 04-03 | Progress bar showing overall completion | SATISFIED | calculateWeightedProgress formula in TestProgress; percentage bar rendered via style={{ width }} |
| EXEC-04 | 04-03 | Streaming text visible in real-time | SATISFIED | streamedText accumulated in token_callback, sent via postProgress, rendered in TestProgress JSX |
| EXEC-05 | 04-01, 04-02 | GPU memory released between runs (dispose + defensive cleanup) | SATISFIED | dispose() in try/catch (line 339), gpuDeviceLost reset, 50ms inter-model delay |
| EXEC-06 | 04-02 | WebGPU device loss detected with automatic WASM fallback | SATISFIED | Dual detection strategy (GPUDevice.lost + isDeviceLostError), runSingleModel retries on WASM, remaining models forced to WASM |
| EXEC-07 | 04-02 | Cloud models via API calls with TTFT/tok/s/total time | SATISFIED | callOpenAI/callAnthropic/callGoogle measure timing; workerBridge.startComparison orchestrates cloud runs |
| EXEC-08 | 04-01 | Cloud API CORS errors distinguished from auth errors | SATISFIED | classifyCloudError classifies TypeError as cors, 401/403 as auth; ERROR_CATEGORY_LABELS shown in OutputComparison |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/cloudApis.ts | 10-12 | TypeScript parameter property syntax (`public readonly` in constructor) violates `erasableSyntaxOnly: true` | BLOCKER | Build fails (`npm run build`). Feature cannot be deployed. tsc --noEmit masks the error because it uses root tsconfig. |
| src/workers/inference.worker.ts | 17 | `env.backends.onnx.webgpu.device` accessed without null check; `webgpu` is possibly undefined per type definitions | BLOCKER | Build fails with TS18048. Runtime would throw if webgpu backend not initialized. |

### Human Verification Required

#### 1. Browser Functional Test

**Test:** Run `npm run dev` and open http://localhost:5173. Add 2+ local models, click Run Comparison, observe progress bar behavior and streaming output.
**Expected:** Progress bar advances through loading (0-10%), initializing (10-20%), generating (20-100%) for each model's slice. Streaming text appears live. Backend badge shows next to model name.
**Why human:** Visual progress and streaming behavior cannot be verified by static code analysis.

#### 2. Cloud Error Classification

**Test:** Enter an invalid API key in Settings. Add an OpenAI cloud model and Run Comparison.
**Expected:** Error card shows "Auth Failed" badge (401/403) or "CORS Blocked" badge (TypeError), actionable hint text, and "Show raw error" toggle.
**Why human:** Requires live API call and network response to exercise classification path.

#### 3. FallbackBanner Trigger Test

**Test:** In browser console: `import('/src/stores/useCompareStore').then(m => m.useCompareStore.getState().setFallbackWarning('WebGPU device lost -- remaining models switched to WASM'))` (set status to 'running' first).
**Expected:** Yellow warning banner appears between progress bar and results.
**Why human:** Device loss is difficult to trigger programmatically; manual store injection needed.

### Gaps Summary

The Phase 4 execution engine is completely implemented at the behavioral level -- all 5 roadmap success criteria have code that implements them, and all 8 requirements (EXEC-01 through EXEC-08) are covered. The implementation logic is sound.

**However, the production build is broken.** Two errors in two different files block `npm run build`:

1. **CloudApiError class** (`src/lib/cloudApis.ts` lines 10-12): The `public readonly` parameter property shorthand in the constructor violates `erasableSyntaxOnly: true` (TS1294). This is a project constraint documented in CLAUDE.md. The fix is straightforward: declare the fields as class properties and assign them in the constructor body.

2. **attachDeviceLostHandler** (`src/workers/inference.worker.ts` line 17): Accessing `env.backends.onnx.webgpu.device` without checking if `webgpu` is defined first triggers TS18048. The fix is a null check: `env.backends.onnx?.webgpu?.device`.

These were not caught during plan execution because the plans' verification step used `npx tsc --noEmit`, which exits 0 using the root `tsconfig.json` (which references project configs but does not directly enforce `erasableSyntaxOnly: true`). The actual build uses `tsc -b`, which processes `tsconfig.app.json` where the constraint is active.

Both fixes are small and localized (3-5 lines each). They do not require architectural changes.

---

_Verified: 2026-04-11T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
