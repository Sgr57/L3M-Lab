# Quick Task: Fix ONNX Runtime Errors - Research

**Researched:** 2026-04-14
**Domain:** ONNX Runtime WebGPU / transformers.js v4 inference errors
**Confidence:** MEDIUM-HIGH

## Summary

Two distinct ONNX runtime errors occur during browser-based LLM inference. Error 1 (GatherBlockQuantized) is a session-creation failure that happens when running a model on WebGPU immediately after downloading it via WASM in the same worker — even though the worker terminates and recreates between download and run, the ONNX Runtime's internal WebGPU state may not be fully initialized on the first session attempt. Error 2 (sequence length from cache) is a `DynamicCache.get_seq_length()` failure in transformers.js that occurs when a model's ONNX output does not include standard `present*` / `past_key_values.*` tensors — affecting hybrid architectures (Mamba, LFM2, etc.) or models with non-standard KV cache naming.

Both errors are catchable at the `try/catch` level in the worker code. The fix is: (1) catch and surface user-friendly error messages, (2) provide a retry mechanism that terminates and recreates the worker.

**Primary recommendation:** Wrap both error patterns in targeted catch blocks in `inference.worker.ts`, surface user-friendly messages with a "Retry" button that terminates/recreates the worker, and for Error 1 specifically, consider a retry-once strategy within the worker itself since the issue resolves on second attempt.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Implementation Decisions
- Show user-friendly error message with a "Retry" button that restarts the worker
- No silent auto-retry — user should see what happened and choose to retry
- Worker restart on retry (terminate + fresh worker)

### Backend Fallback
- No auto-fallback to WASM when WebGPU fails
- Just restart worker and retry on same backend — refresh usually fixes the GatherBlockQuantized issue
- The retry button handles this case

### Sequence Length Error
- Root cause unknown at decision time — determined during research (see below)
</user_constraints>

## Error 1: GatherBlockQuantized (ERROR_CODE: 9)

### Root Cause Analysis

**Error:** `Can't create a session. ERROR_CODE: 9, ERROR_MESSAGE: Could not find an implementation for GatherBlockQuantized(1) node with name '/model/embed_tokens/Gather_Quant'`

**What happens:**
1. User clicks "Download" — worker loads pipeline with `device: 'wasm'` (line 88 of inference.worker.ts)
2. Download completes, `generator.dispose()` is called (line 110)
3. `download-complete` event fires, workerBridge terminates the worker and sets `worker = null` (line 76 of workerBridge.ts)
4. User clicks "Run" — a NEW worker is created via `getWorker()` (line 14 of workerBridge.ts)
5. New worker calls `pipeline()` with `device: 'webgpu'` — **FAILS** with GatherBlockQuantized error
6. Page refresh, then run again — **WORKS**

**Why it happens:**
- GatherBlockQuantized IS a supported WebGPU operator in onnxruntime-web (confirmed in webgpu-operators.md) [VERIFIED: onnxruntime GitHub docs]
- ERROR_CODE 9 = `NOT_IMPLEMENTED` in ONNX Runtime — it means the execution provider could not find a kernel for the op [VERIFIED: onnxruntime GitHub issues]
- The bundled onnxruntime-web is `1.25.0-dev.20260327-722743c0e2` (a dev/nightly build) [VERIFIED: npm ls]
- The ONNX Runtime WebGPU EP requires WebGPU adapter/device initialization before it can register its kernels. On the very first WebGPU session creation in a new browsing context, the EP may not have its kernel registry fully populated [ASSUMED]
- The first pipeline call after fresh page load initializes the WebGPU adapter and device correctly. But when a worker is terminated and recreated quickly after a WASM-only download session, the new worker's ONNX Runtime module may have stale WebAssembly module memory or incomplete WebGPU kernel registration [ASSUMED]
- Page refresh works because it creates a completely fresh browsing context — new WASM module, fresh WebGPU initialization

**Confidence:** MEDIUM — The exact mechanism (stale WASM module state vs. incomplete WebGPU kernel registration) is not definitively proven, but the behavioral pattern (download-via-WASM then run-via-WebGPU in same tab = failure; refresh = success) is consistent and reproducible.

### Fix Strategy

Since the user decided "no silent auto-retry," the fix is:
1. **Detect the error pattern** in the worker's catch block — match `ERROR_CODE: 9` or `Could not find an implementation for`
2. **Surface a user-friendly message** like: "WebGPU session failed to initialize. This sometimes happens after downloading a model. Click Retry to restart."
3. **Retry button** in UI terminates the worker and recreates it (already the planned approach)
4. The worker bridge already handles worker termination/recreation — the retry just needs to re-send the run command to a fresh worker

### Code Pattern

```typescript
// In inference.worker.ts — inside the catch block of executeModel or handleRun
catch (err) {
  const msg = err instanceof Error ? err.message : String(err)

  // Detect ONNX session creation failure (typically after download)
  if (msg.includes('ERROR_CODE: 9') || msg.includes('Could not find an implementation for')) {
    post({
      type: 'error',
      configId: config.id,
      modelName: config.displayName,
      message: 'WebGPU session failed to initialize for this model. Try clicking Retry to restart.',
      retryable: true,  // New field to signal UI should show retry
    })
    return
  }
  // ... existing error handling
}
```

## Error 2: Unable to Determine Sequence Length from the Cache

### Root Cause Analysis (VERIFIED in source)

**Error:** `Unable to determine sequence length from the cache.`

**Source location:** `node_modules/@huggingface/transformers/src/cache_utils.js`, line 37 [VERIFIED: source code grep]

**What happens:**
1. The `DynamicCache.get_seq_length()` method iterates over its own properties looking for keys starting with `past_key_values.`
2. If NO key starts with that prefix, it throws `'Unable to determine sequence length from the cache.'`
3. This is called during the second+ generation step when KV caching kicks in

**Why it fails for some models:**
The `getPastKeyValues()` method in `modeling_utils.js` (line 1068) renames ONNX output tensors:
- Standard: `present.0.key` -> `past_key_values.0.key` (these WORK)
- Mamba: `present_ssm.0` -> `past_ssm.0` (these FAIL — no `past_key_values.` prefix)
- LFM2: `present_conv.0` -> `past_conv.0` (these FAIL — no `past_key_values.` prefix)
- Qwen3.5: `present_recurrent.0` -> `past_recurrent.0` (these FAIL — no `past_key_values.` prefix)

**For hybrid models** that have BOTH attention layers AND recurrent/SSM layers, the cache will contain some `past_key_values.*` entries (from attention layers) AND some `past_ssm.*`/`past_conv.*` entries. These hybrids work fine because `get_seq_length()` finds at least one `past_key_values.*` entry.

**For pure recurrent/SSM models** (if any exist in ONNX format), the cache would contain ONLY `past_ssm.*`/`past_conv.*` entries, and `get_seq_length()` would throw because it finds no `past_key_values.*` keys.

**For models with no KV cache support in their ONNX export:** If the ONNX model doesn't output `present*` tensors at all, the DynamicCache would be empty and `get_seq_length()` would throw. [ASSUMED]

**Also possible:** Some models may have been exported/converted incorrectly, producing ONNX outputs with non-standard naming that doesn't match the `present` -> `past_key_values` rename pattern. [ASSUMED]

**Confidence:** HIGH for the mechanism (verified in source code), MEDIUM for exactly which models trigger it (depends on which models users select).

### Fix Strategy

This is a **transformers.js library bug** for certain model architectures. We cannot fix the library code. The fix is:
1. **Catch the specific error** in the worker
2. **Surface a user-friendly message** like: "This model's architecture is not fully supported for text generation in the browser. Try a different model."
3. Mark the error as non-retryable (retrying the same model will produce the same error)

### Code Pattern

```typescript
// In inference.worker.ts — inside the catch block
catch (err) {
  const msg = err instanceof Error ? err.message : String(err)

  // Detect KV cache incompatibility (model architecture issue)
  if (msg.includes('Unable to determine sequence length from the cache')) {
    post({
      type: 'error',
      configId: config.id,
      modelName: config.displayName,
      message: 'This model\'s architecture is not compatible with browser-based text generation. Try a different model or quantization.',
      retryable: false,  // No point retrying — same model will fail the same way
    })
    return
  }
}
```

## Worker Message Protocol Change

Both errors benefit from adding a `retryable` field to the `WorkerEvent` error type:

```typescript
// In worker-messages.ts
| { type: 'error'; configId?: string; modelName?: string; message: string; retryable?: boolean }
```

The UI can then conditionally show "Retry" vs "Try a different model" based on `retryable`.

## Common Pitfalls

### Pitfall 1: Error Matching is Fragile
**What goes wrong:** String matching on error messages breaks when onnxruntime-web updates change the message format.
**How to avoid:** Match on the stable parts (`ERROR_CODE: 9`, `sequence length from the cache`) rather than full messages. These are in the ONNX spec (error code) and transformers.js source (thrown string) respectively.

### Pitfall 2: Worker Termination Timing
**What goes wrong:** If the retry re-sends the run command before the old worker is fully terminated, `getWorker()` might return the existing worker reference.
**How to avoid:** The existing `cancelExecution()` already sets `worker = null` after `terminate()`. The `getWorker()` function creates a new one only if `worker === null`. This is safe as long as termination is synchronous (it is — `Worker.terminate()` is synchronous per spec).
**Warning signs:** "Session already started" errors from ONNX Runtime.

### Pitfall 3: Retry Button Re-entrant Clicks
**What goes wrong:** User clicks retry multiple times rapidly, spawning multiple workers or duplicate run commands.
**How to avoid:** Disable the retry button while executionStatus is 'running'. The store's `executionStatus` field already gates this.

## Architecture Patterns

### Error Classification Pattern

Classify worker errors into categories for UI treatment:

| Error Pattern | Category | User Message | Retryable |
|---|---|---|---|
| `ERROR_CODE: 9` / `Could not find an implementation` | session-init | "WebGPU session failed to initialize. Click Retry." | Yes |
| `Unable to determine sequence length` | model-compat | "This model is not compatible with browser inference." | No |
| `device lost` / `DXGI_ERROR` | device-lost | (existing handling) | Yes (WASM fallback) |
| Other | unknown | Raw error message | Yes |

### Retry Flow (workerBridge)

```
User clicks Retry
  -> cancelExecution() [terminates worker, sets worker=null]
  -> startComparison(same prompt, same params, same configs)
     -> getWorker() [creates fresh worker]
     -> posts 'run' command
```

This flow already works with the existing code. The only new piece is:
1. A "Retry" button in the UI (in the error result card or the run progress area)
2. The button calls the same `startComparison()` with the previous prompt/params/configs

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Error message parsing | Complex regex patterns | Simple `includes()` checks on stable substrings | ONNX error codes are stable; transformers.js throw strings are literal |
| Worker restart | Custom lifecycle management | Existing `cancelExecution()` + `getWorker()` pattern | Already handles terminate + recreate correctly |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GatherBlockQuantized fails due to stale WebGPU kernel registry in new worker after WASM download | Error 1 Root Cause | Low — the fix (retry with fresh worker) works regardless of exact internal cause |
| A2 | Pure SSM/recurrent models (no attention layers) would fail on get_seq_length() | Error 2 Root Cause | Low — the error catch handles this regardless of which specific models trigger it |
| A3 | Some ONNX-exported models may lack present* output tensors entirely | Error 2 Root Cause | Low — same catch handles this case |

## Sources

### Primary (HIGH confidence)
- `node_modules/@huggingface/transformers/src/cache_utils.js` — Exact source of Error 2 (line 37)
- `node_modules/@huggingface/transformers/src/models/modeling_utils.js` — KV cache rename logic (lines 1068-1103)
- `node_modules/@huggingface/transformers/src/configs.js` — Cache shape generation for hybrid models (lines 329-476)
- [onnxruntime webgpu-operators.md](https://github.com/microsoft/onnxruntime/blob/main/js/web/docs/webgpu-operators.md) — GatherBlockQuantized IS supported in WebGPU EP
- [onnxruntime issue #3130](https://github.com/microsoft/onnxruntime/issues/3130) — ERROR_CODE 9 = NOT_IMPLEMENTED pattern

### Secondary (MEDIUM confidence)
- [transformers.js issue #1469](https://github.com/huggingface/transformers.js/issues/1469) — WebGPU JSEP crash patterns with quantized models
- [transformers.js issue #1518](https://github.com/huggingface/transformers.js/issues/1518) — WebGPU session creation failures (ERROR_CODE: 6, related pattern)
- npm ls output — onnxruntime-web@1.25.0-dev.20260327-722743c0e2 bundled with transformers.js 4.0.1

## Metadata

**Confidence breakdown:**
- Error 1 mechanism: MEDIUM — behavioral pattern clear, internal cause assumed
- Error 2 mechanism: HIGH — verified in transformers.js source code
- Fix approach: HIGH — both errors are catchable, retry/messaging is straightforward
- Error classification pattern: HIGH — aligns with existing device-lost handling

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable — error patterns unlikely to change without major version bump)
