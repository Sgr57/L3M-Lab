# Requirements: CompareLocalLLM

**Defined:** 2026-04-10
**Core Value:** Run LLMs entirely in the browser and benchmark them against cloud APIs — same prompt, side-by-side results, quantitative metrics.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FNDN-01**: Vite config includes COOP/COEP headers so WASM runs multi-threaded and benchmarks are accurate
- [ ] **FNDN-02**: Worker explicit format declaration (`worker: { format: 'es' }`) in Vite config
- [ ] **FNDN-03**: Token counting uses actual tokenizer output, not TextStreamer chunk count, so tok/s metric is accurate
- [ ] **FNDN-04**: WebGPU support detected at runtime and surfaced in NavBar as a badge (supported/unsupported)

### Model Selection

- [ ] **MSEL-01**: User can search HuggingFace models with autocomplete dropdown, filtered for ONNX + transformers.js text-generation models
- [ ] **MSEL-02**: Search results display model ID, pipeline tag, ONNX badge, transformers.js badge, download count, and likes
- [ ] **MSEL-03**: User can paste a direct model ID (containing `/`) and add it via smart detection in dropdown or Enter key with API validation
- [ ] **MSEL-04**: Selected models appear as chips with: model name, quantization selector (from available ONNX variants), backend selector (WebGPU/WASM), cache status, estimated download size, remove button
- [ ] **MSEL-05**: Quantization options fetched from HuggingFace API per model (inspecting ONNX filenames)
- [ ] **MSEL-06**: User can add the same model with different backend or quantization for A/B comparison
- [ ] **MSEL-07**: Cloud models (GPT-4o-mini, Claude 3.5 Haiku, Gemini 2.0 Flash) appear as quick-add buttons only when corresponding API key is configured
- [ ] **MSEL-08**: Cloud model chips have dashed border and purple provider badge to visually distinguish from local models

### Prompt & Parameters

- [ ] **PRMT-01**: User can enter a multi-line prompt in a resizable textarea
- [ ] **PRMT-02**: Generation parameters displayed inline and editable: temperature (0.7), max tokens (256), top-p (0.9), repeat penalty (1.1)

### Test Controls

- [ ] **CTRL-01**: Pre-Download button downloads all non-cached local models in parallel without loading into GPU memory (forces WASM backend for download)
- [ ] **CTRL-02**: Run Comparison button executes all selected models sequentially with the current prompt and parameters
- [ ] **CTRL-03**: Info text shows: model count, estimated download size, estimated time
- [ ] **CTRL-04**: Both buttons disabled during execution; cancel support available

### Execution & Progress

- [ ] **EXEC-01**: Sequential model execution: load, warm-up, generate, collect metrics, dispose for each model
- [ ] **EXEC-02**: Live progress display during execution: current model name, phase (downloading/loading/initializing/generating), token count, speed (tok/s), elapsed time
- [ ] **EXEC-03**: Progress bar showing overall completion across all models
- [ ] **EXEC-04**: Streaming text output visible in real-time during generation
- [ ] **EXEC-05**: GPU memory properly released between sequential model runs (dispose + defensive cleanup)
- [ ] **EXEC-06**: WebGPU device loss detected and handled with automatic WASM fallback for remaining models
- [ ] **EXEC-07**: Cloud models executed via direct API calls with same prompt/parameters; TTFT, tok/s, total time measured
- [ ] **EXEC-08**: Cloud API CORS errors detected and distinguished from auth errors with clear user messaging

### Results Display

- [ ] **RSLT-01**: Summary stat cards: models tested count, total time, fastest overall (name + tok/s), fastest local (name + tok/s)
- [ ] **RSLT-02**: Tok/s horizontal bar chart ordered by speed, color-coded: purple (cloud), blue (WebGPU), green (WASM)
- [ ] **RSLT-03**: Time breakdown stacked horizontal bar chart: load + init + generate segments per model, total time label
- [ ] **RSLT-04**: Sortable comparison table with columns: Model, Type, Quant, Backend, Size, Load, TTFT, Tok/s, Total, Tokens, Rating
- [ ] **RSLT-05**: Table rows color-coded: purple tint (cloud), green tint (WASM), default (WebGPU)
- [ ] **RSLT-06**: Best values in table shown in green bold, worst in red
- [ ] **RSLT-07**: Output comparison cards: model name, type badge, backend/quant, key metrics, full response text (collapsible), star rating (1-5 clickable)
- [ ] **RSLT-08**: Output cards color-coded by left border: purple (cloud), blue (WebGPU), green (WASM)
- [ ] **RSLT-09**: Collapsed indicator for remaining outputs: "Show N more outputs"

### Export

- [ ] **EXPT-01**: Export as JSON (prompt, parameters, configs, metrics, outputs, ratings)
- [ ] **EXPT-02**: Export as CSV with all metrics
- [ ] **EXPT-03**: Copy as Markdown
- [ ] **EXPT-04**: All exports download a file to disk

### Settings & Navigation

- [ ] **STNV-01**: Navigation bar with logo "CompareLocalLLM", links (Compare active, Settings), WebGPU badge
- [ ] **STNV-02**: Settings page with API key inputs for OpenAI, Anthropic, Google
- [ ] **STNV-03**: API keys stored in localStorage with show/hide toggle
- [ ] **STNV-04**: Test connection button per provider
- [ ] **STNV-05**: Consistent color coding throughout: purple (#8250df) cloud, blue (#0969da) WebGPU, green (#1a7f37) WASM

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Execution

- **EXEC-V2-01**: Cloud model streaming (SSE) for real-time token display parity with local models
- **EXEC-V2-02**: RAF-throttled progress updates for faster models (>100 tok/s)
- **EXEC-V2-03**: Worker restart between models as GPU memory leak failsafe

### Enhanced UX

- **UX-V2-01**: Dark mode toggle
- **UX-V2-02**: Responsive layout for tablet
- **UX-V2-03**: Model cache management UI (view cached models, clear cache, storage usage)
- **UX-V2-04**: Grid/List view toggle for output comparison

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Persistent storage / database | Client-side POC, all data ephemeral. Export covers persistence needs |
| LLM-as-a-judge evaluation | Overkill for POC. Manual star rating sufficient |
| Prompt template library | Developers already have prompts. Adds UI complexity for minimal gain |
| Multi-prompt batch testing | Massively increases scope and execution time |
| Elo rating / leaderboard | Requires community participation, meaningless for single-user |
| OAuth / user accounts | No backend, no need for auth |
| Parallel model execution | GPU/CPU contention makes benchmarks unreliable |
| Model fine-tuning | Completely different domain |
| Text diff between outputs | Noisy for free-form text, unhelpful |
| Animations / transitions | Functional-first POC for technical users |
| Mobile layout | Desktop-first, WebGPU barely exists on mobile |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDN-01 | — | Pending |
| FNDN-02 | — | Pending |
| FNDN-03 | — | Pending |
| FNDN-04 | — | Pending |
| MSEL-01 | — | Pending |
| MSEL-02 | — | Pending |
| MSEL-03 | — | Pending |
| MSEL-04 | — | Pending |
| MSEL-05 | — | Pending |
| MSEL-06 | — | Pending |
| MSEL-07 | — | Pending |
| MSEL-08 | — | Pending |
| PRMT-01 | — | Pending |
| PRMT-02 | — | Pending |
| CTRL-01 | — | Pending |
| CTRL-02 | — | Pending |
| CTRL-03 | — | Pending |
| CTRL-04 | — | Pending |
| EXEC-01 | — | Pending |
| EXEC-02 | — | Pending |
| EXEC-03 | — | Pending |
| EXEC-04 | — | Pending |
| EXEC-05 | — | Pending |
| EXEC-06 | — | Pending |
| EXEC-07 | — | Pending |
| EXEC-08 | — | Pending |
| RSLT-01 | — | Pending |
| RSLT-02 | — | Pending |
| RSLT-03 | — | Pending |
| RSLT-04 | — | Pending |
| RSLT-05 | — | Pending |
| RSLT-06 | — | Pending |
| RSLT-07 | — | Pending |
| RSLT-08 | — | Pending |
| RSLT-09 | — | Pending |
| EXPT-01 | — | Pending |
| EXPT-02 | — | Pending |
| EXPT-03 | — | Pending |
| EXPT-04 | — | Pending |
| STNV-01 | — | Pending |
| STNV-02 | — | Pending |
| STNV-03 | — | Pending |
| STNV-04 | — | Pending |
| STNV-05 | — | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 0
- Unmapped: 44

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial definition*
