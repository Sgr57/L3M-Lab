# Milestones

## v1.1 Cache Management (Shipped: 2026-04-13)

**Phases completed:** 1 phases, 3 plans, 4 tasks

**Key accomplishments:**

- Expandable cache management table with sorting, per-quantization deletion, bulk stale cleanup, and loading/empty/error states

---

## v1.0 MVP (Shipped: 2026-04-12)

**Phases completed:** 6 phases, 15 plans, 30 tasks

**Key accomplishments:**

- COOP/COEP cross-origin isolation headers and worker ES format added to Vite config; NavBar with WebGPU badge verified complete
- Accurate token counting via token_callback_function and tokenizer.encode post-generation recount, with STNV-05 color system verified
- Extended TestConfig with size/cache fields, created fetchModelDetails (HF API sizes), isModelCached (Cache API), formatSize utility, and updateConfig store action for Plan 02 UI consumption
- Two-row local model chips with size/cache/trash, cloud accordion with 6-model expanded list and custom model ID input, all wired to Plan 01 utilities
- Human-verified Phase 2 UI with 5 feedback-driven fixes: search icons, cache chip, backend badge removal, 12-color A/B identification, and quant selector fallback
- Multi-model download types, persisted generation parameters in settings store, collapsible PromptInput panel, WASM-forced worker downloads, and per-model progress tracking in workerBridge
- Dedicated PreDownload section with serial multi-model progress, simplified run-only TestControls bar, and D-12 layout ordering in ComparePage
- Commit:
- WebGPU device loss detection with automatic WASM fallback in worker, and cloud execution orchestration with error classification and progress phases in workerBridge
- Commit:
- Per-model color identity (D-03), custom SVG Y-axis backend badges (D-07/D-08), LabelList value labels (D-12), and disambiguated labels (D-04) across PerformanceCharts, ComparisonTable, and OutputComparison
- CSV format (D-15, EXPT-02):
- Commit:

---
