# Roadmap: L3M Lab

## Milestones

- [x] **v1.0 MVP** — Phases 1-6 (shipped 2026-04-12)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-6) — SHIPPED 2026-04-12</summary>

- [x] Phase 1: Foundation & Critical Fixes (2/2 plans) — COOP/COEP headers, accurate token counting, WebGPU badge, app shell with color system
- [x] Phase 2: Model Selection & Settings (3/3 plans) — HuggingFace search, model chips with config, cloud model quick-add, API key management
- [x] Phase 3: Prompt Input & Test Controls (2/2 plans) — Multi-line prompt, generation parameters, pre-download, run/cancel buttons
- [x] Phase 4: Execution Engine & Progress (3/3 plans) — Hardened sequential execution, streaming output, live progress, GPU memory safety, cloud API calls
- [x] Phase 5: Results & Export (3/3 plans) — Summary stats, performance charts, comparison table, output cards, JSON/CSV/Markdown export
- [x] Phase 6: Cleanup & Documentation (2/2 plans) — Remove dead code, fix visual inconsistency, update tracking docs

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### Phase 7: Cache Management Page

**Goal:** New /models page for managing cached LLMs — expandable table of cached models grouped by quantization, size tracking via Cache API, last-used timestamps, quick cleanup (unused >2 weeks), search and download new models via existing ModelSelector
**Requirements:** CM-01 (routing), CM-02 (expandable table), CM-03 (sorting), CM-04 (size tracking), CM-05 (lastUsed store), CM-06 (usage tracking integration), CM-07 (delete quant), CM-08 (delete model), CM-09 (bulk cleanup), CM-10 (search + download), CM-11 (confirmation dialogs)
**Depends on:** Phase 2
**Plans:** 3 plans

Plans:
- [x] 07-01-PLAN.md — Foundation: types, usage store, cache manager library, routing, NavBar, workerBridge integration
- [x] 07-02-PLAN.md — CachedModelsTable: expandable table with sorting, deletion, bulk cleanup
- [x] 07-03-PLAN.md — ModelDownloader: search + download component, page wiring, human verification

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation & Critical Fixes | v1.0 | 2/2 | Complete | 2026-04-10 |
| 2. Model Selection & Settings | v1.0 | 3/3 | Complete | 2026-04-10 |
| 3. Prompt Input & Test Controls | v1.0 | 2/2 | Complete | 2026-04-11 |
| 4. Execution Engine & Progress | v1.0 | 3/3 | Complete | 2026-04-11 |
| 5. Results & Export | v1.0 | 3/3 | Complete | 2026-04-11 |
| 6. Cleanup & Documentation | v1.0 | 2/2 | Complete | 2026-04-12 |
| 7. Cache Management Page | v1.1 | 0/3 | Not started | — |
