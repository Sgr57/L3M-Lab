# CompareLocalLLM

## What This Is

A browser-based POC for comparing local LLM inference (via WebGPU/WASM using transformers.js v4) against cloud models (GPT, Claude, Gemini) side-by-side. Users select multiple models, run the same prompt through all of them, and compare outputs and performance metrics in real time.

## Core Value

Run LLMs entirely in the browser and benchmark them against cloud APIs — same prompt, side-by-side results, quantitative metrics.

## Requirements

### Validated

- [x] Cross-origin isolation (COOP/COEP) enables SharedArrayBuffer — Validated in Phase 1: Foundation & Critical Fixes
- [x] Worker format 'es' matches runtime type:'module' instantiation — Validated in Phase 1: Foundation & Critical Fixes
- [x] Token counting uses tokenizer.encode for accurate metrics — Validated in Phase 1: Foundation & Critical Fixes
- [x] Navigation bar with WebGPU support badge — Validated in Phase 1: Foundation & Critical Fixes
- [x] Consistent color coding: purple (#8250df) cloud, blue (#0969da) WebGPU, green (#1a7f37) WASM — Validated in Phase 1: Foundation & Critical Fixes

### Active

- [ ] HuggingFace model search with autocomplete, filtered for ONNX/transformers.js-compatible text-generation models
- [ ] Direct model ID input via smart detection (contains `/`) with API validation
- [ ] Model chip configuration: quantization selector (from available ONNX variants), backend selector (WebGPU/WASM), cache status, download size estimate
- [ ] Cloud model selection (GPT, Claude, Gemini) gated by API key presence
- [ ] Multi-line prompt input with inline generation parameters (temperature, max tokens, top-p, repeat penalty)
- [ ] Pre-download models in parallel without loading into memory
- [ ] Sequential test execution with live streaming output and progress
- [ ] Performance metrics collection: model size, load time, init time, TTFT, tok/s, total time, token count
- [ ] Results summary with stat cards (models tested, total time, fastest overall, fastest local)
- [ ] Performance charts: tok/s bar chart + time breakdown stacked bars (Recharts)
- [ ] Sortable comparison table with color-coded rows by model type
- [ ] Output comparison cards with collapsible full text and star rating
- [ ] Export results as JSON, CSV, and Markdown
- [ ] Settings page for API key management (localStorage persistence)

### Out of Scope

- Persistent storage / database — all data is ephemeral, exports download to disk
- Mobile-optimized layout — desktop-first POC for technical users
- Dark mode — light mode only
- Animations / transitions — functional-first, no polish overhead
- Future test pages beyond Compare — spec mentions them but they are not in scope
- OAuth / user accounts — no auth needed
- Figma design phase — skipped, build directly from spec

## Context

- **Existing codebase**: React + Vite + TypeScript + Tailwind v4 + Zustand + Recharts + React Router. All 11 components scaffolded as shells, stores and lib utilities partially implemented.
- **Worker**: `inference.worker.ts` is functional — handles download, sequential execution with streaming, timing, cache size estimation, cancel, and dispose.
- **HF Search lib**: `hfSearch.ts` has working API calls with ONNX/transformers.js filtering and quantization extraction from filenames.
- **ModelSelector**: Most developed component (~380 lines) — search, autocomplete, chip management, cloud model quick-add. Needs: direct ID input, cache status, download size, visual alignment.
- **Target audience**: Developers and AI researchers. Functional UX over polished UI.
- **Approach**: Components built one at a time in logical usage order, each fully functional before moving to the next.

## Constraints

- **Tech stack**: Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand + Recharts — already established, no changes
- **Browser APIs**: WebGPU (Chrome 113+), WASM (all modern), Cache API — runtime detection required
- **Single worker**: All model operations in one dedicated Web Worker — no multi-worker
- **No backend**: Everything runs client-side, cloud API calls go direct from browser (CORS-dependent)
- **POC scope**: Functional-first, minimal polish, no premature abstraction

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Direct model ID via smart detection (A+C) | Contains `/` triggers direct add + Enter validation; no extra UI needed | — Pending |
| Components in logical usage order | Enables testing each component as it's completed | — Pending |
| Functionality over polish | POC for technical users; animations and heavy styling deferred | — Pending |
| Existing code is not sacred | Generated shells can be rewritten if a better approach exists | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after Phase 1 completion*
