# Phase 4: Execution Engine & Progress - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Sequential model execution is stable, observable, and handles failure gracefully. Users see live progress and streaming output for every model run. This phase hardens the existing execution pipeline (worker + cloud APIs), adds granular progress tracking, WebGPU device loss recovery with WASM fallback, and categorized cloud API error messaging.

</domain>

<decisions>
## Implementation Decisions

### Progress Granularity (EXEC-02, EXEC-03)
- **D-01:** Overall progress bar uses **weighted phases per model**. Each model gets an equal slice of the bar. Within each model's slice: loading=10%, initializing=10%, generating=80%. The generating portion tracks token progress against `maxTokens` for smooth movement.
- **D-02:** **Cloud models are included** in the overall progress bar. They get their own slice; since they're non-streaming, their slice fills instantly when the response arrives.
- **D-03:** TestProgress component already shows model name, phase, token count, tok/s, elapsed time, and streaming text. These stay as-is.

### GPU Failure Recovery (EXEC-05, EXEC-06)
- **D-04:** When WebGPU device is lost mid-run: show a **warning banner** ("WebGPU device lost — switching remaining models to WASM"), **auto-retry the failed model on WASM**, then continue all remaining WebGPU models on WASM. No user action needed.
- **D-05:** Warning banner **persists until the run completes** so the user knows fallback happened.
- **D-06:** Fallback is **noted in test results**. TestResult gets a `fallbackBackend` field. Results UI shows "WebGPU -> WASM" so users know the benchmark wasn't on the intended backend.
- **D-07:** GPU memory release between sequential runs uses `generator.dispose()`. Research phase should investigate if additional defensive cleanup is needed (delay, GC hint, etc.).

### Cloud Execution Feedback (EXEC-07)
- **D-08:** While a cloud API call is in-flight, show a **live elapsed timer** in the TestProgress component: model name + "Waiting for response..." + timer counting up (updating every 100ms via setInterval). When response arrives, update to show the result.
- **D-09:** Cloud progress reuses the existing TestProgress component layout — no separate cloud-specific component needed.

### Error Presentation (EXEC-08)
- **D-10:** Cloud API errors are **categorized with actionable hints**. Categories: CORS blocked, auth failed, rate limited, timeout, unknown. Each category has a user-facing hint (e.g., "Check your API key in Settings" or "Anthropic requires a proxy"). Raw error details available in a **collapsible section** ("Show raw error").
- **D-11:** Error results appear **inline in the results list** alongside successful results, in execution order. Red-tinted card with error category, hint, and collapsible raw details. Keeps the timeline coherent.

### Claude's Discretion
- HTTP status code ranges for error classification (e.g., 401/403 = auth, 429 = rate limit, TypeError/network = CORS)
- Exact weights for load/init/generate phases (10/10/80 is the guideline, Claude may adjust based on research)
- WebGPU device loss detection mechanism (GPUDevice.lost promise vs try/catch on pipeline errors)
- Whether to add a small delay between model dispose and next model load for GPU memory safety
- Implementation of the elapsed timer for cloud calls (setInterval in component vs store-driven)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Execution Files (primary targets)
- `src/workers/inference.worker.ts` — Full execution pipeline: handleDownload, handleRun, runSingleModel with load/warmup/generate/dispose, postProgress. Primary target for GPU device loss detection and fallback logic.
- `src/lib/workerBridge.ts` — Main-thread orchestration: startComparison runs cloud then local, handleWorkerEvent dispatches to store. Needs update for fallback banner state and cloud progress timer.
- `src/lib/cloudApis.ts` — Cloud API calls (OpenAI, Anthropic, Google). Non-streaming. Needs error classification logic (CORS vs auth vs rate limit vs timeout).

### Progress & UI Components
- `src/components/TestProgress/index.tsx` — Live progress display with model name, phase, tokens, speed, elapsed, streaming text. Needs weighted progress bar calculation and cloud timer support.
- `src/pages/ComparePage.tsx` — Renders TestProgress when running. May need fallback warning banner placement.

### State & Types
- `src/stores/useCompareStore.ts` — Central state: executionStatus, runProgress, results, downloadProgress. Needs fallback warning state.
- `src/types/index.ts` — TestConfig, TestResult, TestMetrics, RunProgress, ExecutionStatus. TestResult needs `fallbackBackend` field.
- `src/types/worker-messages.ts` — WorkerCommand/WorkerEvent tagged unions. May need device-loss event type.

### Library Documentation
- transformers.js v4 docs — Research agent must check WebGPU device loss handling, GPUDevice.lost promise behavior, and dispose() cleanup guarantees

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `inference.worker.ts`: Complete sequential execution pipeline with load/warmup/generate/dispose, TextStreamer streaming, token counting via tokenizer.encode, model size estimation from Cache API. Needs hardening, not rewriting.
- `workerBridge.ts`: Cloud execution loop in `startComparison()`, event dispatch in `handleWorkerEvent()`, cancel via worker termination. Needs cloud progress timer and fallback state management.
- `cloudApis.ts`: Three provider functions with timing metrics. Needs error classification wrapper.
- `TestProgress` component: Shows all required live metrics (model, phase, tokens, speed, elapsed, streaming text). Needs weighted progress bar math and cloud timer display.
- `useCompareStore`: All state fields exist (executionStatus, runProgress, results). Needs minor extensions for fallback state.

### Established Patterns
- Zustand stores with selector pattern for state access — all UI components subscribe via selectors
- Worker communicates via typed `WorkerCommand`/`WorkerEvent` protocol — add new event types here
- `postProgress()` helper in worker posts structured progress data — reuse for fallback notifications
- Cloud APIs run sequentially in main thread before local models go to worker
- Cancel via worker.terminate() + fresh worker on next operation

### Integration Points
- `inference.worker.ts`: WebGPU device loss detection wraps around `pipeline()` call. Fallback changes `device` param from 'webgpu' to 'wasm'.
- `workerBridge.ts handleWorkerEvent()`: New event type for device loss notification to update store with fallback warning.
- `cloudApis.ts`: Error classification wraps existing `throw new Error()` calls — parse HTTP status and error body.
- `ComparePage.tsx`: Warning banner component conditionally rendered when fallback state is set.
- `TestProgress`: Progress bar calculation changes from `(currentIndex + 1) / totalModels` to weighted formula.

</code_context>

<specifics>
## Specific Ideas

- Progress bar should feel smooth — the 10/10/80 weighted phases prevent the bar from sitting still during long model loads
- Cloud models included in overall progress gives a true picture of total execution progress
- GPU fallback banner should be persistent (not dismissible) so the user doesn't miss that benchmarks switched backends
- Results must clearly show "WebGPU -> WASM" for fallback runs so benchmark comparisons are honest
- Error cards inline with results keep the execution timeline coherent — you see exactly what happened and when
- Categorized errors with hints are appropriate for the developer audience — they want to know what to fix, not just that it failed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-execution-engine-progress*
*Context gathered: 2026-04-11*
