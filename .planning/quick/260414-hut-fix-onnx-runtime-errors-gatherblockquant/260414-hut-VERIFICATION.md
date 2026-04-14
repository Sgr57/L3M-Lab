---
phase: quick-260414-hut
verified: 2026-04-14T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "GatherBlockQuantized error triggers correct UI"
    expected: "After downloading a quantized model and running it on WebGPU, if ERROR_CODE: 9 occurs the user sees the 'Session Failed' badge, the friendly hint text, and the enabled 'Retry All Models' button"
    why_human: "Requires a real WebGPU model download that triggers the GatherBlockQuantized ONNX failure — cannot reproduce programmatically without GPU hardware and the specific model state"
  - test: "Retry button restarts worker and re-runs comparison"
    expected: "Clicking 'Retry All Models' terminates the old worker, creates a fresh one, and re-runs the full comparison with the same prompt and configs"
    why_human: "Worker lifecycle (terminate + recreate) requires a running browser session to observe"
  - test: "Sequence length cache error triggers non-retryable UI"
    expected: "On a model that triggers 'Unable to determine sequence length from the cache', the 'Not Compatible' badge and 'Try removing this model and running again.' text appear — no Retry button"
    why_human: "Requires a model with SSM/hybrid architecture that actually triggers the DynamicCache limitation"
  - test: "Retry button disabled during active run/download"
    expected: "When executionStatus is 'running' or 'downloading', the Retry button is visually disabled and not clickable"
    why_human: "Requires an active run to be in progress while an error card is visible — browser session only"
---

# Quick Task 260414-hut: Fix ONNX Runtime Errors — Verification Report

**Task Goal:** Fix two ONNX runtime errors with user-friendly error handling: (1) GatherBlockQuantized session failure shows error with Retry button that restarts worker; (2) "Unable to determine sequence length from the cache" shows non-retryable model-compat message.
**Verified:** 2026-04-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GatherBlockQuantized/ERROR_CODE:9 errors show user-friendly message with Retry button | VERIFIED | `classifyLocalError` in inference.worker.ts lines 51-57 matches both `ERROR_CODE: 9` and `Could not find an implementation for`, returns `session-init`/retryable=true; OutputComparison lines 152-162 renders "Retry All Models" button when `r.retryable` |
| 2 | Sequence length cache errors show 'model not supported' message without Retry button | VERIFIED | `classifyLocalError` lines 61-67 matches `Unable to determine sequence length from the cache`, returns `model-compat`/retryable=false; OutputComparison lines 163-167 shows guidance text when `!r.retryable` |
| 3 | Clicking Retry terminates the worker, recreates it, and re-runs the same comparison | VERIFIED | OutputComparison button onClick (lines 157-159) calls `cancelExecution()` (workerBridge.ts lines 308-323: terminates worker, sets worker=null) then `startComparison()` which calls `getWorker()` creating a fresh worker |
| 4 | Non-retryable errors guide the user to try a different model | VERIFIED | OutputComparison lines 163-167: `<span className="text-xs text-text-tertiary">Try removing this model and running again.</span>` rendered in the `!r.retryable` branch |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/index.ts` | ErrorCategory type with session-init/model-compat; retryable on TestResult | VERIFIED | Line 4: `'session-init' \| 'model-compat'` present in `ErrorCategory`. Line 47: `retryable?: boolean` on `TestResult` |
| `src/types/worker-messages.ts` | retryable/errorCategory/errorHint on WorkerEvent error variant | VERIFIED | Line 17: `retryable?: boolean; errorCategory?: ErrorCategory; errorHint?: string` present |
| `src/workers/inference.worker.ts` | classifyLocalError helper with both ONNX patterns | VERIFIED | Lines 47-76: `classifyLocalError` classifies `ERROR_CODE: 9` and sequence length error; applied in both `handleDownload` (line 156) and `handleRun` (line 199) catch blocks |
| `src/lib/workerBridge.ts` | Error event handler propagates retryable/category to TestResult | VERIFIED | Lines 126-130: `errorCategory: event.errorCategory`, `errorHint: event.errorHint ?? event.message`, `rawError: event.message`, `retryable: event.retryable` |
| `src/components/OutputComparison/index.tsx` | Retry button for retryable; guidance text for non-retryable | VERIFIED | Lines 151-168: conditional renders Retry button or guidance text based on `r.retryable`; ERROR_CATEGORY_LABELS includes `session-init` and `model-compat` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `inference.worker.ts` | `worker-messages.ts` | WorkerEvent error type with retryable + category | VERIFIED | Worker posts `type: 'error'` with `retryable: classified.retryable` (line 162); WorkerEvent error variant accepts all three optional fields |
| `workerBridge.ts` | `useCompareStore` | addResult with errorCategory, errorHint, rawError, retryable | VERIFIED | `retryable: event.retryable` propagated at line 129 |
| `OutputComparison/index.tsx` | `workerBridge.ts` | Retry button calls cancelExecution + startComparison | VERIFIED | Import at line 4; onClick at lines 157-159 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `OutputComparison/index.tsx` | `r.retryable`, `r.errorCategory`, `r.errorHint` | `useCompareStore` results, populated by `addResult` from workerBridge | Yes — set from classified ONNX error, flows through run-complete or error event | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — error handling paths require browser runtime with a real ONNX session failure to trigger. No runnable entry point can simulate ERROR_CODE: 9 without WebGPU hardware and a specific model load sequence.

### Requirements Coverage

No formal requirement IDs declared in the plan. Task success criteria per plan:

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Both ONNX error patterns caught and classified | VERIFIED | `classifyLocalError` handles both string patterns |
| GatherBlockQuantized shows "Session Failed" badge + Retry button | VERIFIED | `session-init` in ERROR_CATEGORY_LABELS; `r.retryable` branch renders button |
| Sequence length errors show "Not Compatible" badge + guidance | VERIFIED | `model-compat` in ERROR_CATEGORY_LABELS; `!r.retryable` branch renders guidance |
| Retry button terminates worker, creates fresh, re-runs | VERIFIED | `cancelExecution` + `startComparison` on click; `getWorker()` recreates on null |
| No silent auto-retry — user sees error first | VERIFIED | Error stored in result, displayed before any action; button requires click |
| Error classification reuses errorCategory/errorHint/rawError pattern | VERIFIED | Same fields used for cloud errors, now also applied to local ONNX errors |
| Zero TypeScript errors | VERIFIED | `npx tsc --noEmit` passes clean |
| Zero ESLint errors (in modified files) | VERIFIED | Two pre-existing ESLint errors in unmodified `executeModel` code (lines 266, 317 — device-lost retry path and streamer callback) are out of scope |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `inference.worker.ts` | 266 | `no-useless-catch` (pre-existing, device-lost fallback) | Info | Pre-existing, not introduced by this task, out of scope |
| `inference.worker.ts` | 317 | `_tokens` unused parameter (pre-existing, streamer callback) | Info | Pre-existing, not introduced by this task, out of scope |

No new anti-patterns introduced. The `classifyLocalError` string matching uses `includes()` on local ONNX error strings — appropriate for this use case (local runtime, no external input).

### Human Verification Required

#### 1. GatherBlockQuantized Error UI

**Test:** Download a quantized model (q4/q8) on WebGPU backend, then immediately run it. If the ERROR_CODE: 9 session initialization failure occurs, check the output card.
**Expected:** "Session Failed" badge visible, hint text "WebGPU session failed to initialize for this model. This sometimes happens after downloading a model. Click Retry to restart." shown, "Retry All Models" button rendered and clickable.
**Why human:** Requires GPU hardware and a specific timing condition (ONNX kernel registry not ready after download) that cannot be triggered programmatically.

#### 2. Retry Button Worker Lifecycle

**Test:** With a retryable error visible in the output card, click "Retry All Models".
**Expected:** The old worker is terminated (no stale worker state), a fresh worker is created, and the same comparison re-runs with identical prompt, parameters, and model configs.
**Why human:** Worker termination and recreation happens in the browser worker API — not observable without a running browser session.

#### 3. Sequence Length Cache Error Non-Retryable UI

**Test:** Run a model with SSM or hybrid architecture known to trigger "Unable to determine sequence length from the cache" (e.g. a Mamba or RWKV-based model).
**Expected:** "Not Compatible" badge shown, hint text "This model's architecture is not compatible with browser-based text generation. Try a different model or quantization." shown, NO Retry button, instead shows "Try removing this model and running again."
**Why human:** Requires a specific model architecture that triggers the DynamicCache limitation in transformers.js.

#### 4. Retry Button Disabled During Active Operation

**Test:** Have an error result visible from a previous run, then start a new run/download. While it is in progress, check the Retry button state.
**Expected:** Button is visually disabled (opacity-40, cursor-not-allowed) and non-interactive during `running` or `downloading` states.
**Why human:** Requires concurrent active state — browser session only.

### Gaps Summary

No gaps. All four observable truths are fully verified at code level. The implementation correctly classifies both ONNX error patterns, propagates all error metadata through the type chain (worker -> worker-messages -> workerBridge -> store -> component), and renders the appropriate UI affordances. TypeScript compiles cleanly. Human verification items are standard runtime behaviors that cannot be confirmed without a live browser session and the specific hardware/model conditions that trigger these errors.

---

_Verified: 2026-04-14_
_Verifier: Claude (gsd-verifier)_
