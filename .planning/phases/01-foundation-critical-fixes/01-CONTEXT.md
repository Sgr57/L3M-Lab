# Phase 1: Foundation & Critical Fixes - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Developer tools and metrics infrastructure produce correct data, and the app shell establishes the visual identity. This phase delivers: COOP/COEP headers for SharedArrayBuffer, worker format declaration, accurate token counting, WebGPU badge (already done), NavBar (already done), and color system centralization (already defined in CSS).

</domain>

<decisions>
## Implementation Decisions

### Token Counting (FNDN-03)
- **D-01:** After generation completes, use tokenizer to count actual tokens in the output (not TextStreamer chunk count). Recalculate tok/s from final token count and total generation time.
- **D-02:** Research phase MUST check if transformers.js v4 exposes specific APIs for accurate token counting (e.g., token IDs in generation output, built-in count on result object, or tokenizer.encode). Use the best available method rather than assuming tokenizer.encode is the only option.
- **D-03:** Real-time tok/s during streaming can remain approximate (chunk-based). Only final metrics need to be accurate.

### Vite Configuration (FNDN-01, FNDN-02)
- **D-04:** Add COOP/COEP headers to Vite dev server config for SharedArrayBuffer support.
- **D-05:** Add `worker: { format: 'es' }` to Vite config for explicit worker format.

### Claude's Discretion
- NavBar visual identity: Current implementation is functional. Claude may refine spacing, font weight, or badge appearance if it improves the POC shell, but no major redesign needed.
- Color system JS constants: Claude decides whether to create a shared `colors.ts` now or defer to Phase 5 when Recharts actually needs JS color values. CSS custom properties in `index.css` are the source of truth either way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Implementation
- `src/workers/inference.worker.ts` -- Current worker with TextStreamer token counting bug (lines 173-189)
- `src/index.css` -- Color system defined as CSS custom properties (@theme block)
- `src/components/NavBar/index.tsx` -- Existing NavBar with logo, links, WebGPU badge
- `src/lib/webgpuDetect.ts` -- WebGPU detection utility (already working)
- `src/hooks/useWebGPU.ts` -- WebGPU detection hook (already working)
- `vite.config.ts` -- Current Vite config missing COOP/COEP headers and worker format

### Library Documentation
- transformers.js v4 docs -- Research agent must check for token counting APIs, TextStreamer behavior, and generation output format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NavBar` component: Fully functional with logo, Compare/Settings links, WebGPU badge. Minor polish only.
- `webgpuDetect.ts` + `useWebGPU.ts`: WebGPU detection chain is complete and working.
- `index.css` @theme block: All color tokens defined (cloud/webgpu/wasm + chart variants + semantic colors).
- `useSettingsStore`: Already stores `webgpuSupported` state with persistence middleware.

### Established Patterns
- Zustand stores with selector pattern for state access
- Web Worker communicates via typed message protocol (`WorkerCommand` / `WorkerEvent`)
- TextStreamer used for streaming generation output with callback

### Integration Points
- `vite.config.ts`: COOP/COEP headers and worker format go here
- `inference.worker.ts` `runSingleModel()`: Token counting fix targets this function
- `App.tsx`: Already calls `useWebGPU()` and renders NavBar -- no changes expected

</code_context>

<specifics>
## Specific Ideas

- User wants the researcher to investigate transformers.js v4 APIs specifically, not assume tokenizer.encode is the only approach. The library may have built-in mechanisms for accurate token counting.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-critical-fixes*
*Context gathered: 2026-04-10*
