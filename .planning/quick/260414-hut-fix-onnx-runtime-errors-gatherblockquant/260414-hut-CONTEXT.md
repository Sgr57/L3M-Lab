# Quick Task 260414-hut: Fix ONNX Runtime Errors — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Task Boundary

Two ONNX runtime errors to fix:
1. After download completes: "Can't create a session. ERROR_CODE: 9, ERROR_MESSAGE: Could not find an implementation for GatherBlockQuantized(1) node with name '/model/embed_tokens/Gather_Quant'" — page refresh fixes it
2. During run on some models: "Unable to determine sequence length from the cache."

</domain>

<decisions>
## Implementation Decisions

### Error Handling Strategy
- Show user-friendly error message with a "Retry" button that restarts the worker
- No silent auto-retry — user should see what happened and choose to retry
- Worker restart on retry (terminate + fresh worker)

### Backend Fallback
- No auto-fallback to WASM when WebGPU fails
- Just restart worker and retry on same backend — refresh usually fixes the GatherBlockQuantized issue
- The retry button handles this case

### Sequence Length Error
- Root cause unknown — needs investigation during research phase
- Could be model-specific or runtime state issue
- Research should determine cause and appropriate fix

</decisions>

<specifics>
## Specific Ideas

- Error #1 (GatherBlockQuantized): Likely stale ONNX runtime state after download — worker used for download retains corrupted session state. Current code already terminates worker after download, but timing/race condition may cause issue.
- Error #2 (sequence length): May be related to KV cache handling in transformers.js for certain model architectures
- Both errors should surface as user-friendly messages, not raw ONNX errors

</specifics>
