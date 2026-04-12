# Phase 3: Prompt Input & Test Controls - Research

**Researched:** 2026-04-10
**Domain:** React UI components, Zustand state persistence, Web Worker download orchestration
**Confidence:** HIGH

## Summary

Phase 3 refactors existing components (PromptInput, TestControls) and creates a new PreDownload section. The codebase already has working implementations for all features -- this phase restructures them: collapsible parameters panel in PromptInput, extraction of pre-download into its own component with serial multi-model progress tracking, simplification of run controls, and parameter persistence via Zustand persist middleware.

The technical domain is well-understood. All libraries are already installed and patterns established in the codebase. The main complexity lies in extending the `DownloadProgress` type and store state to track multiple models serially, forcing WASM backend during downloads, and wiring persist middleware for generation parameters. No new dependencies are needed.

**Primary recommendation:** Use Zustand `persist` middleware on `useSettingsStore` (which already persists) to also persist generation parameters, rather than adding persist middleware to `useCompareStore` which holds ephemeral run state. Extend `DownloadProgress` (or create a new `MultiModelDownloadProgress` type) to track per-model status across a serial download queue.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Parameters in collapsible panel below textarea, closed by default. Toggle label shows current values summary. Number inputs only, no sliders.
- **D-02:** Parameters persist across page refresh. Either add persist middleware to useCompareStore or move parameters to useSettingsStore.
- **D-03:** Number inputs only. No sliders, no reset-to-defaults button.
- **D-04:** Pre-download is a separate section/component between ModelSelector and Run controls. NOT part of TestControls.
- **D-05:** Section always visible when local models are selected. If all cached: "All models cached" + disabled button. If some uncached: count + total size + active Download button.
- **D-06:** Download is serial. Each model shows progress bar (0-100%). Completed = checkmark, current = active progress bar, queued = "waiting."
- **D-07:** Download forces WASM backend to avoid loading into GPU memory.
- **D-08:** Section shows: number of models to download, estimated total size in MB/GB (from real estimatedSize), and Download button.
- **D-09:** Run controls simplified bar: model count info + Cancel button (when running) + Run Comparison button. No Pre-Download button.
- **D-10:** Info text shows model count and estimated download size only. No estimated time.
- **D-11:** Both Run and Download buttons disabled during execution. Cancel available for both operations.
- **D-12:** Page order: Prompt -> ModelSelector -> Pre-Download -> Run Controls.

### Claude's Discretion
- Visual styling of the collapsible panel toggle (chevron icon, border treatment)
- Whether to use existing DownloadProgress type or extend it for multi-model serial progress
- Implementation of parameter persistence (persist middleware on useCompareStore vs moving parameters to useSettingsStore)
- Pre-download section visibility when zero local models are selected (hide completely or show empty state)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRMT-01 | User can enter a multi-line prompt in a resizable textarea | Existing PromptInput already has this. Textarea with `resize-y` class. No changes needed to textarea itself. |
| PRMT-02 | Generation parameters displayed inline and editable with defaults | Existing ParamInput sub-components work. Refactor into collapsible panel with persist middleware for state. |
| CTRL-01 | Pre-Download downloads non-cached local models without loading into GPU memory | Worker `handleDownload()` must force `device: 'wasm'` regardless of config.backend. New PreDownload component with multi-model progress. |
| CTRL-02 | Run Comparison executes all selected models sequentially | Already works via `startComparison()` in workerBridge.ts. TestControls simplification only. |
| CTRL-03 | Info text shows model count, estimated download size, estimated time | Per D-10, estimated time dropped (unreliable). Info text shows model count + download size using real estimatedSize from configs. |
| CTRL-04 | Both buttons disabled during execution; cancel support available | Already partially implemented. Extend to cover both Download and Run buttons across both components. |

</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.12 | State management + persist middleware | Already in project, persist middleware built-in [VERIFIED: npm ls] |
| react | 19.2.4 | UI components | Already in project [VERIFIED: npm ls] |
| tailwindcss | 4.2.2 | Styling | Already in project [VERIFIED: npm ls] |
| @huggingface/transformers | 4.0.1 | Model download + inference | Already in project [VERIFIED: npm ls] |

### Supporting
No new libraries needed. All functionality achievable with existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand persist for params | localStorage directly | Zustand persist is simpler, consistent with useSettingsStore pattern, handles serialization |
| Custom collapsible panel | headless-ui Disclosure | Adds dependency for trivial toggle state -- existing accordion pattern in ModelSelector is sufficient |

**Installation:** None required. All packages already installed.

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New/modified files:

```
src/
├── components/
│   ├── PromptInput/index.tsx      # MODIFY: collapsible params panel
│   ├── PreDownload/index.tsx      # NEW: dedicated pre-download section
│   └── TestControls/index.tsx     # MODIFY: simplify (remove pre-download button)
├── stores/
│   ├── useCompareStore.ts         # MODIFY: extend downloadProgress for multi-model
│   └── useSettingsStore.ts        # MODIFY: add parameters with persist
├── workers/
│   └── inference.worker.ts        # MODIFY: force WASM in handleDownload
├── lib/
│   └── workerBridge.ts            # MODIFY: update download progress handling
├── types/
│   └── index.ts                   # MODIFY: extend DownloadProgress type
└── pages/
    └── ComparePage.tsx            # MODIFY: insert PreDownload between ModelSelector and TestControls
```

### Pattern 1: Collapsible Panel (Local State Toggle)

**What:** React `useState` boolean toggle with conditional rendering -- same pattern already used for cloud accordion in ModelSelector.
**When to use:** Closed-by-default UI sections that don't need cross-component state.
**Example:**
```typescript
// Source: existing pattern in src/components/ModelSelector/index.tsx:61,391-403
const [paramsOpen, setParamsOpen] = useState(false)

<button
  type="button"
  className="flex w-full items-center justify-between ..."
  onClick={() => setParamsOpen(!paramsOpen)}
>
  <span>Parameters (temp {parameters.temperature}, tokens {parameters.maxTokens}, ...)</span>
  <svg className={`transition-transform ${paramsOpen ? 'rotate-180' : ''}`}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
</button>
{paramsOpen && (
  <div className="...">
    {/* ParamInput components */}
  </div>
)}
```
[VERIFIED: ModelSelector/index.tsx lines 61, 385-403]

### Pattern 2: Zustand Persist for Parameters

**What:** Move `parameters` and `setParameter` to `useSettingsStore` which already uses persist middleware, OR add a second persist slice to `useCompareStore`.
**Recommended approach:** Move parameters to `useSettingsStore`. Rationale: `useCompareStore` holds ephemeral run data (results, progress, status) that should NOT persist. `useSettingsStore` is already the "user preferences" store. Parameters are a user preference.
**Example:**
```typescript
// Source: existing pattern in src/stores/useSettingsStore.ts
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: { openai: '', anthropic: '', google: '' },
      parameters: { temperature: 0.7, maxTokens: 256, topP: 0.9, repeatPenalty: 1.1 },
      // ...
      setParameter: (key, value) =>
        set((state) => ({
          parameters: { ...state.parameters, [key]: value },
        })),
    }),
    {
      name: 'compare-llm-settings',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        parameters: state.parameters,
      }),
    }
  )
)
```
[VERIFIED: useSettingsStore.ts already uses persist with partialize]

### Pattern 3: Multi-Model Serial Download Progress

**What:** Extend download tracking to show status for each model in a serial queue.
**Current state:** `DownloadProgress` tracks a single model. Store has `downloadProgress: DownloadProgress | null`.
**Needed state:** Track all models in the download queue with per-model status.
**Example:**
```typescript
// New type for multi-model download tracking
interface ModelDownloadStatus {
  configId: string
  modelName: string
  status: 'waiting' | 'downloading' | 'complete' | 'error'
  progress: number   // 0-100
  loaded: number
  total: number
  error?: string
}

interface MultiModelDownloadProgress {
  models: ModelDownloadStatus[]
  currentIndex: number
}
```
[ASSUMED: This type structure is a design recommendation]

### Pattern 4: Force WASM Backend During Download

**What:** Override `config.backend` to `'wasm'` in the worker's `handleDownload()` function.
**Why:** CTRL-01 requires downloads without loading into GPU memory. Using `device: 'webgpu'` during pipeline creation causes GPU memory allocation even if we dispose immediately.
**Example:**
```typescript
// In inference.worker.ts handleDownload()
const generator = await pipeline('text-generation', config.modelId, {
  dtype: config.quantization as 'q4' | 'q8' | 'fp16' | 'fp32',
  device: 'wasm',  // Always WASM for download -- avoids GPU memory allocation
  progress_callback: (progress: Record<string, unknown>) => { /* ... */ },
})
```
[CITED: deepwiki.com/huggingface/transformers.js/8.2-backend-architecture -- device parameter controls execution provider]

### Anti-Patterns to Avoid
- **Persisting run state:** Do NOT add persist middleware to `useCompareStore` for results/progress/status. These are ephemeral. Only parameters should persist.
- **Re-downloading cached models:** The PreDownload section must filter out models where `config.cached === true`. The worker already filters `backend !== 'api'`, but cached models should not be re-sent to the worker.
- **Inline formatSize in TestControls:** There's already a shared `formatSize()` in `src/lib/formatSize.ts`. The current TestControls has an inline version with a crude GB-based sizeMap. Use the shared one with real `estimatedSize` bytes from configs.
- **Multiple source of truth for parameters:** If moving parameters to `useSettingsStore`, remove them from `useCompareStore` entirely. Do not maintain both.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom localStorage sync | Zustand `persist` middleware | Handles serialization, hydration, merge, and partialize out of the box [VERIFIED: already used in useSettingsStore] |
| Size formatting | Inline GB math in TestControls | `src/lib/formatSize.ts` | Already handles B/KB/MB/GB with proper formatting [VERIFIED: exists at src/lib/formatSize.ts] |
| Accordion/collapsible | External library | useState + conditional render | Already patterned in ModelSelector, trivial toggle [VERIFIED: ModelSelector line 61] |
| Worker communication | Custom events | Existing WorkerCommand/WorkerEvent protocol | Type-safe discriminated unions already handle all message types [VERIFIED: worker-messages.ts] |

**Key insight:** This phase is primarily a refactor/reorganization of existing functionality. Almost nothing needs to be built from scratch.

## Common Pitfalls

### Pitfall 1: Parameter Persistence Hydration Race
**What goes wrong:** Component reads parameters from store before persist middleware has hydrated from localStorage, getting default values that then get overwritten.
**Why it happens:** Zustand persist hydrates asynchronously. On first render, the store has default values.
**How to avoid:** Zustand 5.x handles this via `onRehydrateStorage` callback and the store is synchronously available after hydration. Since `useSettingsStore` already persists and works (API keys hydrate correctly), adding parameters to the same store follows the same proven path. No special handling needed.
**Warning signs:** Parameters reset to defaults on page refresh.
[CITED: zustand.docs.pmnd.rs/reference/middlewares/persist -- hydration behavior]

### Pitfall 2: Download Progress State Drift
**What goes wrong:** PreDownload component shows stale progress because the `downloadProgress` in store only tracks the currently-downloading model, losing history of completed ones.
**Why it happens:** Current `setDownloadProgress(event.data)` replaces the entire progress object with each worker event. For multi-model tracking, we need to maintain the full list.
**How to avoid:** Use the new `MultiModelDownloadProgress` type that holds an array of all model statuses. The `workerBridge` handler should update only the relevant model in the array, not replace the whole object.
**Warning signs:** Completed models disappear from the progress list, or all models show the same progress.

### Pitfall 3: WASM Download Caches Different Files Than WebGPU
**What goes wrong:** Model files downloaded with WASM backend might not be the same files needed for WebGPU execution, leading to re-downloads when running.
**Why it happens:** transformers.js model files are backend-agnostic (ONNX format). The same cached files work for both WASM and WebGPU execution. However, the runtime WASM/WebGPU binaries are different and fetched separately (not model files).
**How to avoid:** This is actually NOT a problem. ONNX model files are the same regardless of backend. The `device` parameter only affects which ONNX Runtime execution provider is used, not which model files are downloaded. The model cache is shared.
**Warning signs:** None expected -- model files are backend-agnostic.
[CITED: deepwiki.com/huggingface/transformers.js/8.2-backend-architecture -- ONNX model files are backend-agnostic]

### Pitfall 4: Cancel During Download Leaves Orphan State
**What goes wrong:** User cancels mid-download, but store still shows `executionStatus: 'downloading'` or has stale download progress.
**Why it happens:** The worker's cancel signal (`cancelled = true`) stops the loop but the current `pipeline()` call is not abortable. The worker will finish the current model's download before checking the cancelled flag.
**How to avoid:** The `workerBridge.cancelExecution()` already sets status to 'cancelled' and clears runProgress. Ensure it also clears downloadProgress. The `download-complete` event from the worker should check if status is already 'cancelled' and not override it back to 'idle'.
**Warning signs:** UI stuck in "downloading" state after cancel, or status flips from cancelled back to idle.

### Pitfall 5: estimatedSize Missing on Some Configs
**What goes wrong:** Pre-download section shows "0 B" or NaN for download size because `estimatedSize` is optional on `TestConfig` and may be undefined.
**Why it happens:** `estimatedSize` comes from HF API file size inspection (phase 2). If the API call failed or returned no size data, it's undefined.
**How to avoid:** Default to 0 when `estimatedSize` is undefined. Show "Unknown size" text when all sizes are 0. The `formatSize` utility already handles 0 gracefully (returns "0 B").
**Warning signs:** Showing "~0 B" as download estimate for real models.

## Code Examples

### Existing Accordion Pattern (to reuse for collapsible params)
```typescript
// Source: src/components/ModelSelector/index.tsx lines 385-403
// Chevron SVG that rotates on toggle:
<svg
  xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
>
  <polyline points="6 9 12 15 18 9" />
</svg>
```
[VERIFIED: src/components/ModelSelector/index.tsx]

### Existing formatSize Utility (use instead of inline calculation)
```typescript
// Source: src/lib/formatSize.ts
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `~${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
```
[VERIFIED: src/lib/formatSize.ts]

### Existing Persist Middleware Pattern
```typescript
// Source: src/stores/useSettingsStore.ts
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // ... state and actions
    }),
    {
      name: 'compare-llm-settings',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
      }),
    }
  )
)
```
[VERIFIED: src/stores/useSettingsStore.ts]

### Current Worker Download Handler (needs WASM override)
```typescript
// Source: src/workers/inference.worker.ts lines 48-50
// CURRENT (uses config.backend -- loads into GPU for webgpu configs):
const generator = await pipeline('text-generation', config.modelId, {
  dtype: config.quantization as 'q4' | 'q8' | 'fp16' | 'fp32',
  device: config.backend as 'webgpu' | 'wasm',  // BUG: should be 'wasm' for download
  // ...
})
```
[VERIFIED: src/workers/inference.worker.ts line 50]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zustand v4 persist with getStorage | Zustand v5 persist with storage option | v5.0.0 (2024) | `useSettingsStore` already uses v5 API correctly [VERIFIED: installed 5.0.12] |
| transformers.js v3 pipeline API | transformers.js v4 pipeline API | v4.0.0 (2026) | project uses v4 correctly with `device` parameter [VERIFIED: installed 4.0.1] |

**Deprecated/outdated:**
- `sizeMap` heuristic in TestControls: Uses crude q4=0.5GB/q8=1GB mapping. Phase 2 added real `estimatedSize` from HF API on TestConfig. Use that instead. [VERIFIED: src/components/TestControls/index.tsx lines 14-17]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MultiModelDownloadProgress type structure with models array and currentIndex | Architecture Patterns, Pattern 3 | Low -- type can be adjusted during implementation without architectural impact |
| A2 | ONNX model files cached by transformers.js are backend-agnostic (shared between WASM and WebGPU) | Pitfalls, Pitfall 3 | Medium -- if files differ by backend, pre-downloading with WASM would cause re-download on WebGPU run. However, ONNX is a format standard and models are the same; only runtime differs. |
| A3 | Worker's pipeline() call is not abortable mid-download | Pitfalls, Pitfall 4 | Low -- worst case, current model finishes downloading before cancel takes effect. Acceptable for POC. |

## Open Questions (RESOLVED)

1. **Parameter persistence: move to useSettingsStore or add persist to useCompareStore?**
   - What we know: `useSettingsStore` already persists, `useCompareStore` does not. Parameters are user preferences (like API keys), not run data.
   - What's unclear: Moving parameters changes import paths in PromptInput and TestControls (and workerBridge's startComparison).
   - Recommendation: Move to `useSettingsStore`. The import path changes are minimal and this keeps ephemeral run state clean. **This is a Claude's Discretion item.**
   - RESOLVED: Parameters moved to `useSettingsStore` with persist middleware. Plan 03-01 Task 1 implements this migration, updating imports in PromptInput and TestControls.

2. **PreDownload visibility with zero local models?**
   - What we know: D-05 says "always visible when local models are selected." What about when NO local models are selected (only cloud)?
   - What's unclear: Should the component hide entirely or show "No local models selected"?
   - Recommendation: Hide entirely when no local models in configs. The section has no purpose without local models. **This is a Claude's Discretion item.**
   - RESOLVED: PreDownload component returns null when `localConfigs.length === 0`. This is within Claude's Discretion per CONTEXT.md -- the section has no functional purpose without local models.

3. **Download cancel behavior for in-flight pipeline() call?**
   - What we know: The worker checks `cancelled` between models but cannot abort a running `pipeline()` call.
   - What's unclear: Should we attempt to use AbortController (if transformers.js supports it) or accept the current behavior?
   - Recommendation: Accept current behavior for POC scope. The current model finishes, then the loop stops. This is adequate.
   - RESOLVED: Accepted current behavior for POC scope. Worker checks `cancelled` flag between models; current model finishes before cancel takes effect. Plan 03-01 Task 2 adds `cancelled = false` reset and `if (cancelled) break` in the download loop.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no test framework installed |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRMT-01 | Multi-line resizable textarea | manual-only | Visual inspection in browser | N/A |
| PRMT-02 | Parameters editable with defaults, persist on refresh | manual-only | Edit params, refresh, verify values | N/A |
| CTRL-01 | Pre-download forces WASM, no GPU memory | manual-only | Open DevTools, verify WASM in worker logs | N/A |
| CTRL-02 | Run Comparison executes sequentially | manual-only | Already functional from prior phases | N/A |
| CTRL-03 | Info text shows model count + download size | manual-only | Visual inspection | N/A |
| CTRL-04 | Buttons disabled during execution, cancel works | manual-only | Click Download/Run, verify disable state + cancel | N/A |

### Wave 0 Gaps
- No test framework installed. All validation is manual-only.
- This is acceptable for a POC with `nyquist_validation: true` but no test framework. Validation relies on visual/interactive manual testing.

### Sampling Rate
- **Per task commit:** `npm run build` (type-check + build succeeds)
- **Per wave merge:** Visual manual testing in browser
- **Phase gate:** All 6 requirements verified manually in browser

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- no auth in this phase |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | Number inputs have min/max attributes on ParamInput. Textarea has no injection risk (value stored in state, not executed). |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via prompt textarea | Tampering | React's JSX auto-escapes. Prompt stored as string, rendered as text node -- no `dangerouslySetInnerHTML`. |
| Parameter out-of-range | Tampering | HTML `min`/`max` attributes + numeric input type. Worker/cloud APIs should also validate. |

No significant security concerns for this phase. All inputs are local browser state.

## Sources

### Primary (HIGH confidence)
- `src/components/PromptInput/index.tsx` -- existing prompt + params component [VERIFIED: read directly]
- `src/components/TestControls/index.tsx` -- existing controls with pre-download button [VERIFIED: read directly]
- `src/stores/useCompareStore.ts` -- current state shape and store pattern [VERIFIED: read directly]
- `src/stores/useSettingsStore.ts` -- existing persist middleware usage [VERIFIED: read directly]
- `src/workers/inference.worker.ts` -- worker download handler with backend bug [VERIFIED: read directly]
- `src/lib/workerBridge.ts` -- bridge pattern and event handling [VERIFIED: read directly]
- `src/types/index.ts` -- DownloadProgress type definition [VERIFIED: read directly]
- `src/types/worker-messages.ts` -- WorkerEvent/WorkerCommand protocol [VERIFIED: read directly]
- `src/lib/formatSize.ts` -- shared size formatting utility [VERIFIED: read directly]
- `src/components/ModelSelector/index.tsx` -- accordion pattern reference [VERIFIED: read directly]

### Secondary (MEDIUM confidence)
- [Zustand persist middleware docs](https://zustand.docs.pmnd.rs/reference/middlewares/persist) -- partialize, hydration behavior [CITED: official docs via WebSearch]
- [Transformers.js backend architecture](https://deepwiki.com/huggingface/transformers.js/8.2-backend-architecture) -- device parameter, WASM vs WebGPU [CITED: DeepWiki via WebFetch]

### Tertiary (LOW confidence)
- None -- all findings verified from codebase or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and verified via npm ls
- Architecture: HIGH -- all patterns exist in codebase, this is a refactor
- Pitfalls: HIGH -- identified from direct code inspection of current implementation gaps

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no moving parts, all libraries pinned)
