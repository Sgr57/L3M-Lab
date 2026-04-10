# Architecture Patterns

**Domain:** Browser-based LLM inference comparison tool
**Researched:** 2026-04-10

## Recommended Architecture

The existing codebase already follows the correct high-level pattern: a **layered architecture with thread isolation** where heavy ML inference runs in a Web Worker while React handles UI, connected by a typed message bridge with Zustand as the single source of truth.

The architecture has five distinct layers, listed from user-facing to system-level:

```
[Presentation Layer]  React components, pages, routing
        |
[State Layer]         Zustand stores (useCompareStore, useSettingsStore)
        |
[Orchestration Layer] workerBridge.ts — routes work between worker and cloud APIs
        |                                                |
[Execution Layer]     inference.worker.ts          cloudApis.ts
        |                   (Web Worker thread)        (Main thread, fetch-based)
        |
[Platform Layer]      transformers.js / ONNX Runtime / WebGPU / WASM / Cache API
```

### Current State Assessment

The existing architecture is **fundamentally sound**. The thread separation, typed discriminated union messages, and Zustand-centric state flow are all correct patterns. What follows are refinements, not rewrites.

---

## Component Boundaries

### Layer 1: Presentation (React Components)

| Component | Responsibility | Reads From | Writes To |
|-----------|---------------|------------|-----------|
| `ComparePage` | Layout orchestrator; conditionally renders child components based on execution status | `useCompareStore` (status, results) | Nothing directly |
| `ModelSelector` | Model discovery (HF search), config management (add/remove/edit chips), cloud model quick-add | `useCompareStore` (configs), `useSettingsStore` (apiKeys, webgpuSupported) | `useCompareStore` (addConfig, removeConfig) |
| `PromptInput` | Prompt text + generation parameter editing | `useCompareStore` (prompt, parameters) | `useCompareStore` (setPrompt, setParameter) |
| `TestControls` | Start/cancel/download buttons; guards (no configs = disabled) | `useCompareStore` (status, configs) | `workerBridge` (startComparison, startDownload, cancelExecution) |
| `TestProgress` | Live progress display: current model, phase, streaming text, tok/s | `useCompareStore` (runProgress, downloadProgress) | Nothing |
| `ResultsSummary` | Stat cards: models tested, total time, fastest model | `useCompareStore` (results) | Nothing |
| `PerformanceCharts` | Recharts bar charts for tok/s and time breakdown | `useCompareStore` (results) | Nothing |
| `ComparisonTable` | Sortable table with color-coded rows by model type | `useCompareStore` (results) | Nothing |
| `OutputComparison` | Side-by-side output cards with collapsible text and star rating | `useCompareStore` (results) | `useCompareStore` (updateRating) |
| `ExportBar` | JSON/CSV/Markdown export buttons | `useCompareStore` (all state for export assembly) | File download via `exportUtils` |
| `NavBar` | Navigation + WebGPU support badge | `useSettingsStore` (webgpuSupported) | Nothing |
| `ApiKeySettings` | API key input fields with localStorage persistence | `useSettingsStore` (apiKeys) | `useSettingsStore` (setApiKey) |

**Key boundary rule:** Components NEVER call worker APIs directly. All execution flows through `workerBridge.ts`, which is the sole orchestration point. Components interact with the system exclusively through Zustand stores and bridge functions.

### Layer 2: State (Zustand Stores)

| Store | Scope | Persistence | Role |
|-------|-------|-------------|------|
| `useCompareStore` | Comparison session: prompt, params, configs, results, execution status, progress | None (ephemeral) | Central hub for all comparison data and real-time progress |
| `useSettingsStore` | API keys, WebGPU capability | localStorage via `zustand/persist` | User preferences that survive page reloads |

**Why two stores, not one:** Settings are persisted and rarely change. Comparison state is ephemeral and changes rapidly during execution. Separating them avoids unnecessary re-renders of settings-dependent components when progress updates fire at high frequency.

### Layer 3: Orchestration (workerBridge.ts)

The bridge is the **most architecturally important** file. It:

1. Lazily instantiates the single Web Worker
2. Routes cloud model configs to main-thread `fetch` calls (cloudApis.ts)
3. Routes local model configs to the worker via `postMessage`
4. Translates worker events into Zustand store mutations
5. Handles errors from both execution paths uniformly

**Current architecture decision (correct):** Cloud API calls run on the main thread because they are I/O-bound (network fetch), not CPU-bound. Moving them to the worker would add unnecessary serialization overhead for no benefit.

### Layer 4: Execution

**inference.worker.ts (Web Worker thread):**
- Receives typed `WorkerCommand` discriminated unions
- Manages the transformers.js pipeline lifecycle: download, load, warm-up, generate, dispose
- Posts typed `WorkerEvent` discriminated unions back to main thread
- Handles sequential execution of multiple local models
- Streams per-token progress via `TextStreamer` callback

**cloudApis.ts (Main thread):**
- Direct HTTP fetch to OpenAI, Anthropic, Google APIs
- Non-streaming (full response, then parse) -- adequate for POC
- Returns unified `CloudResponse` shape

### Layer 5: Platform

| Capability | Technology | Notes |
|------------|-----------|-------|
| GPU inference | WebGPU via transformers.js | Chrome 113+, runtime detection required |
| CPU inference | WASM via transformers.js | Universal fallback |
| Model caching | Cache API (`caches.open('transformers-cache')`) | Transparent to user, survives page reload |
| Model loading | ONNX Runtime Web (bundled in transformers.js) | Handles quantization variants |

---

## Data Flow

### Primary Flow: Run Comparison

```
User clicks "Run" in TestControls
  |
  v
TestControls calls workerBridge.startComparison(prompt, params, configs)
  |
  +-- workerBridge.reset() -> useCompareStore clears previous results
  +-- workerBridge sets executionStatus = 'running'
  |
  +-- Cloud configs: sequential async/await on main thread
  |     |
  |     +-- For each cloud config:
  |           workerBridge.runCloudModel() -> cloudApis.callOpenAI/Anthropic/Google
  |           -> store.addResult()
  |
  +-- Local configs: single postMessage to worker
        |
        Worker receives { type: 'run', prompt, params, configs }
        |
        +-- For each local config (sequential):
              |
              +-- pipeline() load model -> post 'run-started'
              +-- warm-up generation -> post 'run-progress' (phase: initializing)
              +-- TextStreamer generation:
              |     Each token -> post 'run-progress' (phase: generating, streamedText updated)
              +-- dispose() -> post 'run-progress' (phase: disposing)
              +-- post 'run-complete' with full TestResult
        |
        +-- post 'all-complete'
        |
        v
handleWorkerEvent() in workerBridge translates each event to store mutation:
  'run-started'   -> store.setRunProgress(initial)
  'run-progress'  -> store.setRunProgress(updated)
  'run-complete'  -> store.addResult(result)
  'all-complete'  -> store.setExecutionStatus('complete')
  |
  v
React components re-render via Zustand selectors
```

### Secondary Flow: Pre-Download Models

```
User clicks "Download" in TestControls
  |
  v
workerBridge.startDownload(configs)
  -> store.setExecutionStatus('downloading')
  -> worker.postMessage({ type: 'download', configs })
  |
  Worker downloads each model via pipeline() with progress_callback
  -> posts 'download-progress' events (progress %, bytes loaded/total)
  -> dispose() immediately after download (cache only, don't hold in memory)
  -> posts 'download-complete'
  |
  v
handleWorkerEvent() updates store.downloadProgress
  -> TestProgress component shows download bar
```

### State Flow Direction (Strict Unidirectional)

```
User Action -> Component -> workerBridge function -> Worker/API
                                                        |
Worker Event / API Response -> workerBridge handler -> Zustand store mutation
                                                        |
Zustand store -> React selectors -> Component re-render
```

No component ever reads directly from the worker. No component ever writes directly to the worker. The bridge is the sole mediator.

---

## Patterns to Follow

### Pattern 1: Typed Discriminated Union Messages

**What:** All worker communication uses TypeScript discriminated unions with a `type` field.

**Why:** Exhaustive switch/case handling, compile-time safety, self-documenting protocol.

**Example (already implemented correctly):**
```typescript
// Main -> Worker
export type WorkerCommand =
  | { type: 'download'; configs: TestConfig[] }
  | { type: 'run'; prompt: string; params: GenerationParameters; configs: TestConfig[] }
  | { type: 'cancel' }

// Worker -> Main
export type WorkerEvent =
  | { type: 'download-progress'; data: DownloadProgress }
  | { type: 'run-complete'; result: TestResult }
  | { type: 'all-complete' }
  // ... etc
```

**Confidence:** HIGH -- this is the standard pattern in transformers.js examples and the broader Web Worker ecosystem.

### Pattern 2: Singleton Worker with Lazy Initialization

**What:** One worker instance, created on first use, persisted for the app lifetime.

**Why:** Model loading is expensive (seconds to minutes). Re-creating the worker would lose cached pipeline state. A single worker also prevents GPU memory contention.

**Current implementation:** Correct. `getWorker()` in workerBridge.ts lazily creates the worker and stores it in module scope.

**Confidence:** HIGH -- transformers.js official examples use this exact pattern.

### Pattern 3: Bridge as Sole Orchestration Point

**What:** No component calls `worker.postMessage()` directly. All execution goes through `workerBridge.ts`.

**Why:** Centralizes the split between cloud (main thread) and local (worker) execution. Components don't need to know where inference runs. Error handling is unified.

**Current implementation:** Correct. TestControls calls `startComparison()`, `startDownload()`, `cancelExecution()` from the bridge.

**Confidence:** HIGH -- standard separation of concerns.

### Pattern 4: Zustand External Store Access for Worker Events

**What:** Worker event handler calls `useCompareStore.getState()` to mutate state from outside React.

**Why:** Worker events arrive via `onmessage`, which is outside the React lifecycle. Zustand supports this via `getState()` on the store object.

**Current implementation:** Correct. `handleWorkerEvent` uses `useCompareStore.getState()` to access store actions.

**Confidence:** HIGH -- documented Zustand pattern for external event sources.

### Pattern 5: Sequential Model Execution

**What:** Local models run one at a time in the worker, not in parallel.

**Why:** Browser WebGPU/WASM has limited memory (1-4 GB VRAM, 4 GB WASM address space). Running multiple models concurrently would either OOM or cause GPU context contention. Sequential execution with dispose() between runs is the only safe approach.

**Current implementation:** Correct. The worker loops through configs sequentially, loading, running, and disposing each model before the next.

**Confidence:** HIGH -- fundamental browser memory constraint, confirmed by WebGPU and ONNX Runtime documentation.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Moving Cloud API Calls to the Worker

**What:** Running fetch-based cloud API calls inside the Web Worker.

**Why bad:** Adds serialization overhead for the request/response. Cloud calls are I/O-bound, not CPU-bound, so there is no benefit to offloading them. The worker should stay focused on CPU/GPU-intensive local inference.

**Instead:** Keep cloud calls on the main thread (current approach). The bridge orchestrates both paths.

### Anti-Pattern 2: Unbounded Progress Updates

**What:** Posting a `run-progress` message for every single token without any throttling.

**Why bad:** At high token rates (50+ tok/s), this means 50+ postMessage calls per second, each triggering a Zustand state update and React re-render. React 19's automatic batching helps, but at very high frequencies, the main thread can still get congested with serialization and rendering work.

**Instead:** The current implementation posts every token, which is acceptable for the POC scope and typical browser model speeds (5-30 tok/s). If performance becomes an issue with faster models, add a `requestAnimationFrame`-gated throttle in the bridge's event handler:

```typescript
let pendingProgress: RunProgress | null = null
let rafScheduled = false

function handleProgressThrottled(data: RunProgress) {
  pendingProgress = data
  if (!rafScheduled) {
    rafScheduled = true
    requestAnimationFrame(() => {
      if (pendingProgress) {
        useCompareStore.getState().setRunProgress(pendingProgress)
        pendingProgress = null
      }
      rafScheduled = false
    })
  }
}
```

### Anti-Pattern 3: Storing Derived Data in the Store

**What:** Putting computed values (fastest model, average tok/s, sorted results) in Zustand state.

**Why bad:** Creates synchronization obligations. Every time results change, you must remember to recompute and update all derived values.

**Instead:** Compute derived values in components or custom hooks using Zustand selectors:

```typescript
// Good: derived in selector
const fastestModel = useCompareStore((s) =>
  s.results.reduce((best, r) => r.metrics.tokensPerSecond > best.metrics.tokensPerSecond ? r : best, s.results[0])
)
```

### Anti-Pattern 4: Multiple Workers for Parallel Inference

**What:** Spawning separate workers per model to run them in parallel.

**Why bad:** Each worker with a loaded model consumes 500MB-2GB+. Two models in parallel can exceed browser VRAM limits, causing GPU context loss or OOM crashes. WebGPU does not support concurrent contexts well.

**Instead:** Sequential execution with explicit dispose() between models (current approach). The single-worker constraint in the project spec is architecturally correct.

### Anti-Pattern 5: Bidirectional Store Subscriptions in Worker

**What:** Having the worker subscribe to Zustand store changes (e.g., via Comlink or SharedArrayBuffer).

**Why bad:** Over-engineering for this use case. The worker needs commands, not reactive state. Adding bidirectional state sync between threads introduces race conditions and debugging complexity.

**Instead:** Unidirectional command/event pattern (current approach). Commands flow in, events flow out.

---

## Streaming UI Considerations

### Token Streaming Architecture

The current approach of appending streamed text in the `RunProgress` object and re-setting it via `setRunProgress` is correct for a POC. For production-grade streaming:

**Current flow (adequate for POC):**
```
TextStreamer callback -> postProgress() -> postMessage -> handleWorkerEvent -> setRunProgress({ ...streamedText })
```

**Key observation:** The `streamedText` field grows with every token. At 256 tokens max, this means re-serializing an increasingly large string on each postMessage. For typical model speeds (5-30 tok/s) and max token counts (256), this is not a problem. It would become one at 1000+ tokens or 100+ tok/s.

**Optimization available if needed:** Instead of sending the full accumulated text, send only the delta (new token text) and accumulate on the main thread:

```typescript
// Worker: send delta only
callback_function: (text: string) => {
  post({ type: 'token-delta', configId: config.id, delta: text, tokenCount: ++count })
}

// Bridge: accumulate
case 'token-delta':
  store.setRunProgress(prev => ({
    ...prev,
    streamedText: prev.streamedText + event.delta,
    tokensGenerated: event.tokenCount,
  }))
```

This is not needed now but is a clear upgrade path.

### Component Rendering for Streaming Text

The `TestProgress` component should use fine-grained Zustand selectors to avoid re-rendering unrelated components during streaming:

```typescript
// Good: only re-renders when streamedText changes
const streamedText = useCompareStore((s) => s.runProgress?.streamedText ?? '')

// Bad: subscribes to entire runProgress object, re-renders on every tokensGenerated change too
const progress = useCompareStore((s) => s.runProgress)
```

For the streaming text display itself, a ref-based approach avoids React reconciliation on every token:

```typescript
const textRef = useRef<HTMLPreElement>(null)
useEffect(() => {
  if (textRef.current) {
    textRef.current.textContent = streamedText
  }
}, [streamedText])
```

---

## Scalability Considerations

| Concern | Current (POC) | At Scale (if needed later) |
|---------|---------------|---------------------------|
| Token streaming rate | Direct postMessage per token, works at 5-30 tok/s | RAF-throttled updates, delta-only messages |
| Number of models per comparison | Sequential, 3-6 models typical | Same pattern works for 20+ models; UI pagination needed |
| Model download size | Progress via callback, works for models up to ~2GB | Chunked download with resume support (transformers.js handles this) |
| Result set size | All in memory via Zustand, fine for single session | Still fine -- max realistic size is ~20 results at ~1KB each |
| Cloud API concurrency | Sequential in for-loop | Could parallelize with Promise.all -- independent API calls |
| Worker memory | Load-run-dispose per model, safe | Same pattern; no optimization needed |

---

## Suggested Build Order (Dependencies Between Components)

Based on the data flow analysis, components should be built in this order to enable incremental testing:

### Phase 1: Input Pipeline (no execution needed to test)
1. **PromptInput** -- standalone, writes to store
2. **ModelSelector** -- depends on hfSearch.ts and settings store, but testable independently
3. **ApiKeySettings** -- standalone, writes to settings store

These three components form the complete input surface. A user can configure a full comparison run after this phase.

### Phase 2: Execution Core (requires input pipeline)
4. **TestControls** -- depends on configs + prompt being present, calls workerBridge
5. **TestProgress** -- depends on execution being in progress, reads runProgress/downloadProgress

This phase requires the worker and bridge to be functional. After this phase, a user can run a comparison and see live progress.

### Phase 3: Results Display (requires execution to produce data)
6. **ResultsSummary** -- depends on results array being populated
7. **PerformanceCharts** -- depends on results with metrics
8. **ComparisonTable** -- depends on results, adds sorting
9. **OutputComparison** -- depends on results, adds rating interaction

These components are read-only views over the results array. They can be built in any order within this phase.

### Phase 4: Polish and Export
10. **ExportBar** -- depends on results, produces file downloads
11. **NavBar** -- standalone, can be built at any time but is low priority

### Dependency Graph

```
ApiKeySettings (standalone)
  |
  v
ModelSelector (needs: apiKeys from settings store, hfSearch.ts)
  |
  v
PromptInput (standalone, but logically pairs with ModelSelector)
  |
  v
TestControls (needs: configs + prompt in store, workerBridge)
  |
  v
TestProgress (needs: execution in progress)
  |
  v
ResultsSummary, PerformanceCharts, ComparisonTable, OutputComparison (need: results)
  |
  v
ExportBar (needs: results + exportUtils)
```

---

## Sources

- [Web Worker Communication Patterns - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) -- HIGH confidence
- [Transformers.js Web Worker Pattern - DeepWiki](https://deepwiki.com/huggingface/transformers.js-examples/6.1-tokenizer-playground) -- HIGH confidence
- [Streaming Multiple AI Models in React - Robin Wieruch](https://www.robinwieruch.de/react-ai-sdk-multiple-streams/) -- MEDIUM confidence (different stack but same UI pattern)
- [WebGPU Usage - ONNX Runtime](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) -- HIGH confidence
- [Web Worker Message Performance](https://nolanlawson.com/2016/02/29/high-performance-web-worker-messages/) -- MEDIUM confidence (older but fundamentals unchanged)
- [Run AI Models in Browser with WebGPU and WASM](https://maddevs.io/writeups/running-ai-models-locally-in-the-browser/) -- MEDIUM confidence
- [Zustand Web Worker Discussion](https://github.com/pmndrs/zustand/discussions/1745) -- HIGH confidence (official repo)
- [WebLLM Architecture](https://github.com/mlc-ai/web-llm) -- MEDIUM confidence (different library, same domain constraints)
- [WebAssembly for LLM Inference in Browsers](https://dasroot.net/posts/2026/01/webassembly-llm-inference-browsers-onnx-webgpu/) -- MEDIUM confidence
- [Optimizing Transformers.js for Production Web Apps](https://www.sitepoint.com/optimizing-transformers-js-production/) -- MEDIUM confidence
