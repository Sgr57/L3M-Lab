# Project Research Summary

**Project:** CompareLocalLLM
**Domain:** Browser-based LLM inference comparison and benchmarking tool
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

CompareLocalLLM occupies a genuinely unique position in the LLM tooling landscape: no existing browser-based tool compares in-browser local inference (WebGPU/WASM via transformers.js) against cloud APIs side-by-side with the same prompt. Chatbot Arena handles cloud-only. WebLLM handles local-only. This app is the only one that bridges both, which is both the core differentiator and the primary source of complexity. The recommended approach is to treat the existing codebase as architecturally correct — the layered thread-isolated design with a typed worker bridge and Zustand state is exactly right — and focus development effort on completing the UI shells that already exist, fixing two critical measurement bugs, and hardening the execution path against known failure modes.

The most important non-obvious finding is that the core metric (tokens per second) is currently broken before any results UI exists. The TextStreamer callback counts chunks, not tokens, making tok/s readings unreliable and comparisons between models meaningless. This must be fixed before building any results display. The second urgent finding is a missing Vite configuration: without COOP/COEP headers, SharedArrayBuffer is unavailable and ONNX Runtime falls back to single-threaded WASM, producing misleadingly slow benchmarks in development. Both fixes are small but load-bearing.

The main risks are execution-path failures: GPU memory leaks accumulate across sequential model runs and can crash the tab without warning after 3-5 models; WebGPU device loss has no recovery path in the current code; and Anthropic has no stable CORS contract (the `anthropic-dangerous-direct-browser-access` header is deliberately named to signal instability). Cloud API CORS fragility is the rule rather than the exception — OpenAI CORS has broken twice in recent months. The mitigation strategy is layered: small delays between runs, adapter health checks, automatic WASM fallback on WebGPU failure, and specific error messaging that distinguishes CORS failures from authentication failures.

## Key Findings

### Recommended Stack

The existing stack (React 19 + Vite 8 + TypeScript 6 + Tailwind v4 + Zustand 5 + Recharts 3 + transformers.js v4) is at current stable versions with no stack-level mistakes. The only required code changes are two additions to `vite.config.ts`: COOP/COEP headers for SharedArrayBuffer availability, and `worker: { format: 'es' }` to explicitly match the `type: 'module'` worker instantiation already in workerBridge.ts. These headers must also be configured on production hosting — GitHub Pages cannot serve custom headers and must be avoided; Vercel, Netlify, and Cloudflare Pages all support them.

The decision to use direct `fetch` calls rather than provider SDKs is correct for a browser POC: the Anthropic SDK adds 100KB+ for a single API call, and all three provider SDKs are designed for Node.js with extra bundling overhead. The `optimizeDeps.exclude` for transformers.js is required and already in place.

**Core technologies:**
- React 19 + Vite 8: UI framework and build tool — current stable, no changes needed beyond header config
- transformers.js v4: Browser LLM inference — v4 rewrites WebGPU runtime in C++, supports 200+ architectures, ~60 tok/s on WebGPU
- Zustand 5: State management — correctly split into ephemeral compare store and persisted settings store; supports `getState()` from worker event handlers outside React
- Recharts 3: Performance charts — React 19 compatible, handles bar and stacked bar charts required by spec
- Direct fetch (no SDKs): Cloud API calls — correct for browser, avoids unnecessary bundle weight

### Expected Features

The tool is ~80% scaffolded. Types, stores, worker commands, and utility functions exist. What is missing is primarily UI implementation of existing shells, plus two critical fixes (token counting, COOP/COEP headers).

**Must have (table stakes):**
- Multi-model selection with HF search — already ~80% done; needs direct `owner/model` ID input and cache status indicator
- Per-model config chips with quantization + backend selector — scaffolded; needs download size estimate
- Cloud model quick-add (GPT-4o-mini, Claude 3.5 Haiku, Gemini 2.0 Flash) — scaffolded; API key gating works
- Prompt input with temperature, max tokens, top-p, repeat penalty — scaffolded; needs multi-line input UI
- Sequential execution with streaming token output — worker supports it; TestProgress component is a shell
- Live progress display during load/download/inference — DownloadProgress and RunProgress types exist; UI needs to render them
- Core performance metrics (TTFT, tok/s, total time, load time, init time) — TestMetrics type complete; tok/s calculation is broken and must be fixed
- Tok/s bar chart and time breakdown stacked bar chart — Recharts ready; PerformanceCharts is a shell
- Sortable comparison table with color-coded rows — ComparisonTable is a shell
- Side-by-side output display — OutputComparison is a shell
- Export to JSON, CSV, Markdown — already fully implemented in exportUtils.ts
- API key management with localStorage persistence — scaffolded in useSettingsStore

**Should have (differentiators):**
- Local vs cloud in one interface — the entire premise; no other browser tool does this
- Same-model WebGPU vs WASM comparison — config system already supports it; just needs UX affordance
- Same-model quantization comparison (q4 vs q8 vs fp16) — config system supports it
- Pre-download models before benchmark — worker supports download phase; needs dedicated UI flow separate from Run
- Results stat cards (fastest overall, fastest local, total time) — ResultsSummary is a shell; straightforward aggregation
- Time breakdown stacked bar revealing where time is actually spent — differentiates from tools showing only tok/s

**Defer (v2+):**
- Additional cloud models beyond the initial three
- Prompt sharing via URL parameters
- HuggingFace token for higher search rate limits
- CORS proxy configuration for users who hit persistent OpenAI CORS failures

### Architecture Approach

The five-layer architecture (Presentation -> State -> Orchestration -> Execution -> Platform) is fundamentally correct and requires no rewrites. The critical design rule is that components never touch the worker directly: all execution flows through `workerBridge.ts`, which routes cloud configs to main-thread fetch calls and local configs to the Web Worker via typed discriminated union messages. This boundary is already enforced in the existing code. Cloud API calls deliberately stay on the main thread because they are I/O-bound, not CPU-bound. Sequential model execution is not a design limitation — it is the only safe approach given WebGPU/WASM memory constraints (each loaded model consumes 500MB-2GB).

**Major components:**
1. `inference.worker.ts` (Web Worker thread) — transformers.js pipeline lifecycle: download, load, warm-up, generate, dispose; sequential model execution; token streaming via TextStreamer
2. `workerBridge.ts` (Main thread orchestration) — sole mediator between React components and execution layer; translates worker events into Zustand mutations; routes cloud vs local configs
3. `useCompareStore` / `useSettingsStore` (Zustand) — ephemeral comparison session state vs persisted API keys/capabilities; correctly separated to prevent settings-read components from re-rendering on high-frequency progress updates
4. React components (Presentation) — read-only views over store state; TestControls is the only component that writes to the bridge; all others consume and display

### Critical Pitfalls

1. **GPU memory leak between sequential runs** — `pipeline.dispose()` does not fully release WebGPU buffers; after 3-5 models the tab crashes silently. Fix: add 100ms delay after dispose, check adapter availability before each load, wrap each model run in try/catch that posts an error event rather than crashing the worker. Must address in sequential execution phase.

2. **Token counting uses chunk count, not token count** — `tokenCount++` inside the TextStreamer callback counts decoded text chunks, not actual tokens. BPE merges mean one callback can represent multiple tokens. The core tok/s metric is wrong. Fix: use `output_token_ids` from pipeline result or re-encode output text with the tokenizer after generation completes. Must fix before building results display.

3. **WebGPU device loss with no recovery** — GPU driver crashes or Chrome watchdog kills resolve `GPUDevice.lost` but transformers.js does not surface this. After repeated crashes Chrome permanently disables WebGPU for the session. Fix: check `navigator.gpu?.requestAdapter()` before each pipeline creation; auto-retry failed WebGPU models with WASM backend; update WebGPU badge to reflect runtime state.

4. **Cloud API CORS fragility** — OpenAI CORS support is undocumented and has broken twice in recent months. Anthropic's `anthropic-dangerous-direct-browser-access` header could be revoked at any time. Both failures produce `TypeError: Failed to fetch` with no response body, which the current code does not distinguish from network errors. Fix: detect CORS failures specifically and show provider-specific messaging.

5. **Download phase wastes GPU cycles** — the download handler creates a full WebGPU pipeline then immediately disposes it, burning multiple seconds of shader compilation per model. Fix: force `device: 'wasm'` for download-only operations; same cache downloads result, zero GPU overhead.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Critical Fixes
**Rationale:** Two bugs must be fixed before any UI is useful — missing COOP/COEP headers corrupt benchmarks in development; broken token counting corrupts the core metric. Both are small file edits with disproportionate impact. Doing these first prevents building results display on top of broken data.
**Delivers:** Correct multi-threaded WASM performance in dev; accurate tok/s metric; WebGPU badge reflecting runtime state
**Addresses:** COOP/COEP config gap, token counting fix, WebGPU detection display
**Avoids:** Pitfall 4 (wrong tok/s), Pitfall 3 (badge showing stale capability state)

### Phase 2: Input Configuration Surface
**Rationale:** All execution flows through completed inputs. ModelSelector, PromptInput, ApiKeySettings, and TestControls must be complete before any execution testing is possible. These components are largely scaffolded and have no blocking dependencies on execution results.
**Delivers:** Complete "configure a run" workflow — model selection with HF search and direct ID input, quantization/backend per-model chips with cache status, prompt and parameter input, API key management
**Addresses:** Model selector, per-model config chips, cloud model quick-add, prompt input, direct model ID input
**Avoids:** Pitfall 8 (add debounce and 429 handling to hfSearch.ts during this phase); Pitfall 10 (add API key disclosure to Settings)

### Phase 3: Execution Engine and Download Flow
**Rationale:** The worker and bridge already exist but the download phase has a critical GPU waste bug, and the execution path has no GPU memory leak mitigation or WebGPU failure recovery. These must be hardened before the results display is built, since an unstable execution engine produces unreliable results.
**Delivers:** Hardened sequential execution with GPU memory leak mitigation; WASM-forced download phase; WebGPU device loss recovery with auto-WASM fallback; specific CORS error messaging for cloud models; live progress display (TestProgress)
**Addresses:** Sequential execution with streaming output, live progress indicators, pre-download UI flow
**Avoids:** Pitfall 1 (GPU memory leak), Pitfall 3 (WebGPU device loss), Pitfall 2 (OpenAI CORS detection), Pitfall 5 (cache eviction — request storage persistence), Pitfall 9 (wasteful GPU init in download)

### Phase 4: Results Display
**Rationale:** With accurate metrics and stable execution, results components can be built with real data to validate against. All four results components are read-only consumers of the results array and can be built in any order within this phase.
**Delivers:** Complete results view — stat cards, tok/s bar chart, time breakdown stacked bar, sortable color-coded comparison table, side-by-side output display with star rating, export bar
**Addresses:** All results display features from table stakes and differentiators
**Avoids:** Pitfall 7 (label "TTFT (network)" vs "TTFT (compute)" for cloud vs local); Pitfall 13 (document initTime in UI); Pitfall 14 (document parameter mapping differences)

### Phase 5: Polish and Deployment
**Rationale:** Production deployment requires COOP/COEP headers on the hosting platform. Minor robustness improvements and edge case handling belong here.
**Delivers:** Production build verified (WASM files present), COOP/COEP headers on hosting, NavBar final state, consistent color coding
**Avoids:** Pitfall 11 (WASM files in production build — test with `vite build && vite preview` early)

### Phase Ordering Rationale

- Foundation fixes first because benchmark data built on broken metrics is worse than no data
- Input configuration before execution because the execution engine cannot be tested without valid inputs
- Execution hardening before results display because an unstable execution engine produces unreliable results to build against
- Results display as a single phase because all four components are independent consumers of the same data shape
- The architecture's strict unidirectional data flow means each layer can be built and tested independently before the next is connected

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation fixes):** Well-defined edits — two Vite config lines and one token counting algorithm change
- **Phase 2 (Input configuration):** Standard form UI patterns; components are ~80% scaffolded
- **Phase 4 (Results display):** Recharts patterns are well-documented; components are read-only store consumers

Phases likely needing deeper research during planning:
- **Phase 3 (Execution hardening):** GPU memory leak mitigation is a heuristic (100ms delay) that may need empirical tuning. WebGPU device loss recovery with WASM fallback has limited documentation in the transformers.js ecosystem specifically.
- **Phase 5 (Deployment):** Hosting platform header syntax varies; verify Vercel/Netlify `_headers` configuration at time of deployment.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries at current stable versions; rationale confirmed via official changelogs and npm. COOP/COEP requirement is MDN-documented. Known Vite 8 header regression documented in issue tracker. |
| Features | HIGH | Competitive landscape well-documented (Artificial Analysis, LLM Comparator, OpenPlayground, Chatbot Arena all verified). Feature boundaries are clear. Anti-features list is opinionated but well-reasoned. |
| Architecture | HIGH | Existing architecture matches transformers.js official examples exactly. Zustand external store access pattern confirmed in official repo discussions. Sequential execution constraint confirmed by WebGPU and ONNX Runtime documentation. |
| Pitfalls | HIGH | GPU memory leak confirmed in open transformers.js issues (#860). OpenAI CORS outages documented in community forums with specific dates (Oct 2025, Jan 2026). Token counting bug confirmed by TextStreamer issue (#934). WebGPU device loss patterns confirmed by Toji's WebGPU best practices guide. |

**Overall confidence:** HIGH

### Gaps to Address

- **GPU memory leak tuning:** The 100ms delay mitigation is a heuristic. The actual required delay may vary by GPU, model size, and browser version. Validate empirically during Phase 3 with 4+ sequential model runs.
- **transformers.js v4 token count API:** Research identifies two approaches (output_token_ids vs post-generation re-encode). Verify availability of `output_token_ids` in v4's pipeline result object against release notes at implementation time.
- **Anthropic header stability:** No contractual guarantee. Monitor during development; no code mitigation is possible beyond specific error detection.
- **Storage persistence grant rates:** `navigator.storage.persist()` may be denied by Firefox and Safari without a user gesture. The fallback behavior (proceed without persistence, show warning) needs UX design.

## Sources

### Primary (HIGH confidence)
- [@huggingface/transformers npm](https://www.npmjs.com/package/@huggingface/transformers) — v4.0.1 version verification
- [Transformers.js v4 announcement](https://huggingface.co/blog/transformersjs-v4) — WebGPU C++ runtime rewrite
- [transformers.js memory leak issue #860](https://github.com/huggingface/transformers.js/issues/860) — GPU memory leak confirmation
- [transformers.js WebGPU crash issue #1518](https://github.com/huggingface/transformers.js/issues/1518) — session creation failures
- [TextStreamer repeating tokens #934](https://github.com/huggingface/transformers.js/issues/934) — callback behavior, chunk vs token
- [WebGPU Device Loss best practices (Toji)](https://toji.dev/webgpu-best-practices/device-loss.html) — device loss handling
- [MDN SharedArrayBuffer cross-origin isolation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) — COOP/COEP requirements
- [Zustand Web Worker Discussion](https://github.com/pmndrs/zustand/discussions/1745) — getState() from outside React
- [MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — cache eviction behavior
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) — current standard
- [Vite 8 CORS header regression](https://github.com/vitejs/vite/issues/21893) — server.headers not applied to static JS

### Secondary (MEDIUM confidence)
- [Anthropic CORS header (Simon Willison)](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) — anthropic-dangerous-direct-browser-access pattern
- [OpenAI CORS outage Oct 2025](https://community.openai.com/t/chat-completions-api-endpoint-down-blocked-any-web-browser-request/1362527) — CORS breakage documentation
- [OpenAI CORS policy change Jan 2026](https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791) — second CORS outage
- [WebGPU vs WebASM benchmarks (SitePoint)](https://www.sitepoint.com/webgpu-vs-webasm-transformers-js/) — 3-8x performance gap, ~60 tok/s WebGPU
- [Artificial Analysis benchmarking methodology](https://artificialanalysis.ai/methodology/performance-benchmarking) — industry-standard metrics
- [LLM Comparator (Google PAIR)](https://github.com/PAIR-code/llm-comparator) — competitive feature analysis
- [OpenPlayground](https://github.com/nat/openplayground) — competitive feature analysis
- [HuggingFace Hub rate limits](https://huggingface.co/docs/hub/rate-limits) — API rate limiting policies
- [Google Gemini API docs](https://ai.google.dev/gemini-api/docs) — key-in-URL security warning
- [ONNX Runtime WebGPU EP](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) — sequential execution constraint

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
