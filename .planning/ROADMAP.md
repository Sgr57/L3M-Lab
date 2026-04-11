# Roadmap: CompareLocalLLM

## Overview

CompareLocalLLM goes from scaffolded shells to a working browser-based LLM benchmark tool in five phases. Foundation fixes ensure metrics are accurate before any UI consumes them. Model selection and settings complete the "configure what to test" surface. Prompt input and test controls wire up the "run a test" trigger. Execution hardening and progress display make sequential runs stable and observable. Results and export deliver the payoff -- side-by-side comparison with charts, tables, and downloadable data.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Critical Fixes** - COOP/COEP headers, accurate token counting, WebGPU badge, app shell with color system
- [x] **Phase 2: Model Selection & Settings** - HuggingFace search, model chips with config, cloud model quick-add, API key management
- [x] **Phase 3: Prompt Input & Test Controls** - Multi-line prompt, generation parameters, pre-download, run/cancel buttons
- [x] **Phase 4: Execution Engine & Progress** - Hardened sequential execution, streaming output, live progress, GPU memory safety, cloud API calls
- [x] **Phase 5: Results & Export** - Summary stats, performance charts, comparison table, output cards, JSON/CSV/Markdown export
- [ ] **Phase 6: Cleanup & Documentation** - Remove dead code, fix visual inconsistency, update tracking docs

## Phase Details

### Phase 1: Foundation & Critical Fixes
**Goal**: Developer tools and metrics infrastructure produce correct data, and the app shell establishes the visual identity
**Depends on**: Nothing (first phase)
**Requirements**: FNDN-01, FNDN-02, FNDN-03, FNDN-04, STNV-01, STNV-05
**Success Criteria** (what must be TRUE):
  1. App runs in dev with SharedArrayBuffer available (cross-origin isolated), verified in browser console
  2. Token count after generation matches actual tokenizer output, not TextStreamer chunk count
  3. NavBar displays app name, navigation links (Compare active, Settings), and a WebGPU support badge that reflects runtime detection
  4. Color coding constants (purple cloud, blue WebGPU, green WASM) are defined once and used consistently across all components
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Vite COOP/COEP headers, worker format 'es', verify NavBar and WebGPU badge
- [x] 01-02-PLAN.md -- Fix token counting bug in inference worker, verify color system

### Phase 2: Model Selection & Settings
**Goal**: Users can fully configure which models to test, including local models from HuggingFace and cloud models gated by API keys
**Depends on**: Phase 1
**Requirements**: MSEL-01, MSEL-02, MSEL-04, MSEL-05, MSEL-06, MSEL-07, MSEL-08, STNV-02, STNV-03, STNV-04
**Success Criteria** (what must be TRUE):
  1. User can search HuggingFace models by name and see autocomplete results showing model ID, pipeline tag, ONNX/transformers.js badges, downloads, and likes
  2. Selected models appear as chips with working quantization selector, backend selector (WebGPU/WASM), cache status, download size estimate, and remove button
  3. Cloud model quick-add buttons appear only when the corresponding API key is present in Settings, and cloud chips are visually distinct (dashed border, purple badge)
  4. User can configure API keys on the Settings page with show/hide toggle and test-connection button per provider
**Note**: MSEL-03 (direct model ID paste) was descoped per D-03 during Phase 2 planning. See v1.0-MILESTONE-AUDIT.md.
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Extend types, create data utilities (HF API sizes, Cache API check, formatSize), add updateConfig store action, verify search and settings
- [x] 02-02-PLAN.md -- Refactor ModelSelector: two-row local chips with size/cache/trash, cloud accordion with expanded provider lists and custom model ID input
- [x] 02-03-PLAN.md -- Build verification and human visual/functional verification of complete Phase 2

### Phase 3: Prompt Input & Test Controls
**Goal**: Users can configure their prompt and generation parameters, then trigger pre-download or comparison runs
**Depends on**: Phase 2
**Requirements**: PRMT-01, PRMT-02, CTRL-01, CTRL-02, CTRL-03, CTRL-04
**Success Criteria** (what must be TRUE):
  1. User can enter a multi-line prompt in a resizable textarea
  2. Generation parameters (temperature, max tokens, top-p, repeat penalty) are displayed inline with editable defaults
  3. Pre-Download button downloads all non-cached local models in parallel without loading into GPU memory
  4. Run Comparison button starts sequential execution of all selected models; both buttons disable during execution with cancel available
  5. Info text below controls shows model count, estimated download size, and estimated time
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md -- Types, stores, collapsible PromptInput, worker WASM override, workerBridge multi-model progress
- [x] 03-02-PLAN.md -- PreDownload component with serial progress, simplified TestControls, ComparePage layout update

### Phase 4: Execution Engine & Progress
**Goal**: Sequential model execution is stable, observable, and handles failure gracefully -- users see live progress and streaming output for every model run
**Depends on**: Phase 3
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, EXEC-07, EXEC-08
**Success Criteria** (what must be TRUE):
  1. Models execute sequentially with load, warm-up, generate, metrics collection, and dispose for each -- GPU memory is properly released between runs
  2. Live progress shows current model name, phase (downloading/loading/generating), token count, tok/s, and elapsed time with an overall progress bar
  3. Streaming text output is visible in real-time during generation
  4. WebGPU device loss is detected and remaining models automatically fall back to WASM
  5. Cloud models execute via direct API calls with TTFT/tok/s/total time measured; CORS errors are distinguished from auth errors with clear messaging
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md -- Types, store extensions, CloudApiError class, classifyCloudError utility
- [x] 04-02-PLAN.md -- Worker device loss detection, WASM fallback, inter-model delay, workerBridge cloud progress and error classification
- [x] 04-03-PLAN.md -- Weighted progress bar, cloud timer, FallbackBanner, enhanced error cards, ComparePage wiring

### Phase 5: Results & Export
**Goal**: Users can analyze benchmark results through summary stats, charts, sortable tables, and output comparisons -- and export everything
**Depends on**: Phase 4
**Requirements**: RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, RSLT-06, RSLT-07, RSLT-08, RSLT-09, EXPT-01, EXPT-02, EXPT-03, EXPT-04
**Success Criteria** (what must be TRUE):
  1. Summary stat cards show models tested, total time, fastest overall (name + tok/s), and fastest local (name + tok/s)
  2. Tok/s bar chart and time breakdown stacked bar chart render with correct color coding (purple cloud, blue WebGPU, green WASM)
  3. Comparison table is sortable by any column, rows are color-coded by model type, best values in green bold and worst in red
  4. Output comparison cards show model name, type badge, key metrics, collapsible full text, and clickable star rating -- with color-coded left borders and "Show N more" collapse
  5. User can export results as JSON, CSV, or copy as Markdown -- all downloads produce a file on disk
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md -- Shared infrastructure: per-model color palette, label disambiguation utility, shared components, ResultsSummary error filtering
- [x] 05-02-PLAN.md -- Visual refinements: PerformanceCharts per-model colors and custom Y-axis, ComparisonTable per-model accents, OutputComparison per-model borders
- [x] 05-03-PLAN.md -- Export pipeline: error/fallback metadata in CSV/Markdown, Markdown file download, ExportBar button updates

### Phase 6: Cleanup & Documentation
**Goal**: Remove dead code, fix visual inconsistencies, and update tracking documentation to close all tech debt from milestone audit
**Depends on**: Phase 5
**Requirements**: None (tech debt closure, no new requirements)
**Gap Closure**: Closes tech debt from v1.0-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. No dead exported functions remain (copyToClipboard, fetchAvailableQuantizations removed)
  2. TestProgress uses shared BackendBadge component with consistent API/GPU/WASM labels
  3. REQUIREMENTS.md traceability checkboxes reflect actual completion state
  4. ROADMAP.md Phase 2 SC #2 no longer references descoped MSEL-03
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md -- Remove dead code (copyToClipboard, fetchAvailableQuantizations), replace TestProgress local BackendBadge with shared component
- [ ] 06-02-PLAN.md -- Update REQUIREMENTS.md traceability checkboxes and ROADMAP.md phase progress to reflect completion state

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Critical Fixes | 2/2 | Complete | 2026-04-10 |
| 2. Model Selection & Settings | 3/3 | Complete | 2026-04-10 |
| 3. Prompt Input & Test Controls | 2/2 | Complete | 2026-04-10 |
| 4. Execution Engine & Progress | 3/3 | Complete | 2026-04-11 |
| 5. Results & Export | 3/3 | Complete | 2026-04-11 |
| 6. Cleanup & Documentation | 0/2 | Executing | - |
