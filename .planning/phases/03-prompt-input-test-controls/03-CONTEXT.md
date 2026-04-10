# Phase 3: Prompt Input & Test Controls - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can configure their prompt and generation parameters, then trigger pre-download or comparison runs. This phase delivers: multi-line prompt textarea, collapsible generation parameters panel with persistence, a dedicated pre-download section with real-time serial progress, and a simplified Run Comparison control bar.

</domain>

<decisions>
## Implementation Decisions

### Prompt & Parameters (PRMT-01, PRMT-02)
- **D-01:** Parameters live in a **collapsible panel** below the textarea, closed by default. Toggle label shows current values summary (e.g., "Parameters (temp 0.7, tokens 256, ...)"). Expanding reveals number inputs — no sliders.
- **D-02:** Parameters **persist across page refresh**. Currently `useCompareStore` has no persist middleware — either add persist middleware to the store or move `parameters` to `useSettingsStore` which already persists.
- **D-03:** Number inputs only (current `ParamInput` component style). No sliders, no reset-to-defaults button.

### Pre-Download Section (CTRL-01)
- **D-04:** Pre-download is a **separate section/component** between ModelSelector and the Run controls. It is NOT part of TestControls. Visually distinct card.
- **D-05:** Section is **always visible** when local models are selected. If all local models are cached: shows "All models cached" with disabled Download button. If some uncached: shows count + total size + active Download button.
- **D-06:** Download is **serial** (one model at a time). Each model shows a progress bar (0-100%) following transformers.js `progress_callback` events. Completed models show checkmark, current model shows active progress bar, queued models show "waiting."
- **D-07:** Download forces **WASM backend** to avoid loading into GPU memory (per CTRL-01 requirement). Current worker code uses `config.backend` directly — must override to WASM during download.
- **D-08:** Section shows: number of models to download, estimated total size in MB/GB (from real `estimatedSize` on configs, not crude sizeMap), and the Download button.

### Run Controls (CTRL-02, CTRL-03, CTRL-04)
- **D-09:** Run controls are a simplified bar: model count info text + Cancel button (when running) + Run Comparison button. No Pre-Download button here — that moved to its own section.
- **D-10:** Info text shows **model count and estimated download size only**. No estimated time — unreliable without benchmarks and varies by hardware.
- **D-11:** Both Run and Download buttons disabled during execution (downloading or running). Cancel available for both operations.

### Page Layout
- **D-12:** Page order: **Prompt** → **ModelSelector** → **Pre-Download** → **Run Controls**. This separates the "configure" phase (prompt + models) from "prepare" (download) from "execute" (run).

### Claude's Discretion
- Visual styling of the collapsible panel toggle (chevron icon, border treatment)
- Whether to use the existing `DownloadProgress` type or extend it for the new multi-model serial progress UI
- Implementation of parameter persistence (persist middleware on useCompareStore vs moving parameters to useSettingsStore)
- Pre-download section visibility when zero local models are selected (hide completely or show empty state)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Components (primary targets)
- `src/components/PromptInput/index.tsx` — Current prompt + params component. Needs collapsible panel refactor.
- `src/components/TestControls/index.tsx` — Current combined controls. Pre-Download button must be extracted to new component.

### Worker & Bridge
- `src/workers/inference.worker.ts` — `handleDownload()` (line 31-89): serial download loop with `progress_callback`. Must be updated to force WASM backend.
- `src/lib/workerBridge.ts` — `startDownload()` and `startComparison()` orchestration. Download event handling needs update for multi-model progress.

### State & Types
- `src/stores/useCompareStore.ts` — Central state. `downloadProgress` currently tracks single model. Needs extension for serial multi-model tracking. Parameters need persistence.
- `src/types/index.ts` — `DownloadProgress` type (line 83-89): single-model progress. May need extension.
- `src/types/worker-messages.ts` — Worker event types for download progress messages.

### Page Layout
- `src/pages/ComparePage.tsx` — Component ordering. New pre-download section inserted between ModelSelector and TestControls.

### Styling
- `src/index.css` — Color system CSS custom properties (@theme block)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PromptInput`: Functional textarea + 4 ParamInput sub-components. Collapsible panel is a refactor, not a rewrite.
- `TestControls`: Has Pre-Download, Run, Cancel buttons + info text. Pre-Download extracts to new component; remaining controls simplify.
- `ParamInput`: Internal sub-component in PromptInput. Well-structured, can stay as-is inside the collapsible panel.
- `useCompareStore`: All state fields exist (prompt, parameters, configs, executionStatus, downloadProgress). Download progress needs multi-model extension.

### Established Patterns
- Zustand stores with selector pattern for state access
- `persist` middleware already used in `useSettingsStore` — same pattern can apply to parameters
- Worker communicates via typed `WorkerCommand`/`WorkerEvent` protocol
- `progress_callback` from transformers.js provides `{ progress, loaded, total }` per download chunk

### Integration Points
- `ComparePage.tsx`: New pre-download component inserted in render order
- `workerBridge.ts`: Download function needs to pass forced WASM backend
- `inference.worker.ts`: `handleDownload` needs WASM override and possibly richer progress events
- `useCompareStore`: `downloadProgress` state needs to track multiple models (list of per-model progress)

</code_context>

<specifics>
## Specific Ideas

- User wants the pre-download section to always be visible when local models exist, showing "All models cached" when nothing to download — no hidden state
- Parameters should show current values in the collapsed toggle label for quick reference without expanding
- Download progress should be real-time with clear per-model status: checkmark (done), progress bar (downloading), "waiting" (queued)
- Download size should use real `estimatedSize` from HF API (already on TestConfig), not the crude sizeMap heuristic currently in TestControls

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-prompt-input-test-controls*
*Context gathered: 2026-04-10*
