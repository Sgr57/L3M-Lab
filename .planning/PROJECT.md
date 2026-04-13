# L3M Lab

## What This Is

A browser-based tool for comparing local LLM inference (via WebGPU/WASM using transformers.js v4) against cloud models (GPT, Claude, Gemini) side-by-side. Users select multiple models, run the same prompt through all of them, and compare outputs and performance metrics in real time. Shipped as v1.0 MVP.

## Core Value

Run LLMs entirely in the browser and benchmark them against cloud APIs — same prompt, side-by-side results, quantitative metrics.

## Requirements

### Validated

- ✓ Cross-origin isolation (COOP/COEP) enables SharedArrayBuffer — v1.0
- ✓ Worker format 'es' matches runtime type:'module' instantiation — v1.0
- ✓ Token counting uses tokenizer.encode for accurate metrics — v1.0
- ✓ Navigation bar with WebGPU support badge — v1.0
- ✓ Consistent color coding: purple cloud, blue WebGPU, green WASM — v1.0
- ✓ HuggingFace model search with autocomplete, ONNX/transformers.js filtering — v1.0
- ✓ Model chip configuration: quantization, backend, cache status, download size — v1.0
- ✓ Cloud model selection (GPT, Claude, Gemini) gated by API key — v1.0
- ✓ Settings page for API key management (localStorage persistence) — v1.0
- ✓ Multi-line prompt input with collapsible generation parameters — v1.0
- ✓ Pre-download models with serial per-model progress — v1.0
- ✓ Generation parameters persist via useSettingsStore — v1.0
- ✓ Sequential test execution with live streaming output and progress — v1.0
- ✓ Performance metrics: model size, load time, init time, TTFT, tok/s, total time, token count — v1.0
- ✓ Results summary with stat cards — v1.0
- ✓ Performance charts: tok/s bar chart + time breakdown stacked bars — v1.0
- ✓ Sortable comparison table with color-coded rows — v1.0
- ✓ Output comparison cards with collapsible text and star rating — v1.0
- ✓ Export results as JSON, CSV, and Markdown — v1.0

### Active

(None — next milestone requirements TBD via `/gsd-new-milestone`)

### Out of Scope

- Persistent storage / database — all data is ephemeral, exports download to disk
- Mobile-optimized layout — desktop-first POC for technical users
- Dark mode — light mode only
- Animations / transitions — functional-first, no polish overhead
- Future test pages beyond Compare — spec mentions them but not in scope
- OAuth / user accounts — no auth needed
- Figma design phase — skipped, built directly from spec
- Direct model ID paste (MSEL-03) — descoped per D-03, filtered search sufficient for POC

## Context

- **Shipped**: v1.0 MVP — 7 phases, 18 plans. Phase 7 added /models cache management page
- **Tech stack**: React 19 + Vite + TypeScript + Tailwind CSS v4 + Zustand + Recharts + React Router
- **Architecture**: Single Web Worker for all inference, Zustand stores for state, cloud APIs called direct from browser
- **Browser support**: Chrome 115+ (WebGPU), Firefox 120+ / Safari 17+ (WASM fallback)
- **Known issues**: Anthropic CORS restrictions prevent direct browser calls; GPU memory leak mitigation uses 100ms delay heuristic

## Constraints

- **Tech stack**: Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand + Recharts — established, no changes
- **Browser APIs**: WebGPU (Chrome 113+), WASM (all modern), Cache API — runtime detection required
- **Single worker**: All model operations in one dedicated Web Worker — no multi-worker
- **No backend**: Everything runs client-side, cloud API calls go direct from browser (CORS-dependent)
- **POC scope**: Functional-first, minimal polish, no premature abstraction

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| D-03: Descope MSEL-03 (direct model ID paste) | Filtered search is sufficient for POC; direct paste adds complexity | ✓ Good — no user complaints |
| Components in logical usage order | Enables testing each component as it's completed | ✓ Good — clean dependency chain |
| Functionality over polish | POC for technical users; animations and heavy styling deferred | ✓ Good — shipped fast |
| Existing code is not sacred | Generated shells can be rewritten if better approach exists | ✓ Good — several components fully rewritten |
| D-14: Download-to-file over clipboard copy | More reliable for large outputs, works cross-browser | ✓ Good — used for all exports |
| Unified MODEL_COLORS palette | Chart bars match model chip colors for visual consistency | ✓ Good — fixed in Phase 6 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 after Phase 7 completion*
