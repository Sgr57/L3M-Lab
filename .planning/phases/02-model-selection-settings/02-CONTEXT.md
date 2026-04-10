# Phase 2: Model Selection & Settings - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can fully configure which models to test: search and select local HuggingFace models, choose cloud models from any provider with an API key, and manage API keys on the Settings page. This phase delivers the complete "configure what to test" surface.

</domain>

<decisions>
## Implementation Decisions

### Model Search (MSEL-01, MSEL-02)
- **D-01:** Keep the existing HF search as-is — filters for `onnx,transformers.js` + `text-generation` pipeline tag + sorted by downloads, limit 20 results. No changes needed to search logic.
- **D-02:** Search results already display model ID, pipeline tag, ONNX/transformers.js badges, downloads, and likes. Verify this meets MSEL-02 and fix any gaps.

### Direct Model ID Input (MSEL-03)
- **D-03:** MSEL-03 is **removed from Phase 2 scope**. The existing filtered search is sufficient for a POC — if a model doesn't appear, it's not ONNX/transformers.js compatible. No direct paste, no separate input field.

### Local Model Chips (MSEL-04, MSEL-05, MSEL-06)
- **D-04:** Two-row chip layout:
  - Row 1: model name + quantization selector + backend selector + trash icon (not "x")
  - Row 2: download size estimate (e.g., "~250MB") + cache status dot (green=cached, gray=not) + color-coded backend badge
- **D-05:** Remove the current redundant display (both selector AND badge for quant and backend). Selectors are the interactive control; badges in row 2 provide visual status.
- **D-06:** Same model can be added with different backend/quantization for A/B comparison (MSEL-06) — verify this works with current `addConfig` logic.

### Cloud Model Selection (MSEL-07, MSEL-08)
- **D-07:** Cloud models live in a collapsible **"Cloud Models" accordion** below the local model chips. Closed by default to keep the main component clean.
- **D-08:** Inside the accordion: quick-add buttons grouped by provider (only providers with API keys configured). Expand the hardcoded list to 2-3 models per provider (e.g., GPT-4o-mini + GPT-4o for OpenAI).
- **D-09:** Each provider section has a `[+]` button that reveals a text input for typing any custom cloud model ID. No validation — errors surface at execution time.
- **D-10:** Cloud chips are **one-row simplified**: model name + purple provider badge + trash icon. Dashed border to distinguish from local chips (MSEL-08).

### Cache & Download Size (part of MSEL-04)
- **D-11:** Download size estimated from HF API: `fetchAvailableQuantizations` already calls `/models/{id}` which returns file siblings with sizes. Sum the `.onnx` files for the selected quantization.
- **D-12:** Cache status checked via Cache API when the chip is created. Green dot = cached, gray dot = not cached.
- **D-13:** Both size and cache status recalculate when user changes quantization.

### Settings Page (STNV-02, STNV-03, STNV-04)
- **D-14:** Settings page is **complete as-is**. API key input, show/hide toggle, test connection button per provider all meet requirements. Anthropic CORS warning already present. Only minor visual cleanup if needed.

### Claude's Discretion
- Exact cloud models to include in the expanded quick-add list per provider
- Visual styling of the accordion (border, padding, chevron icon)
- Whether to show cloud chips inside or outside the accordion
- `formatSize()` utility implementation details (KB/MB/GB formatting)
- Cache API key format for transformers.js models (research needed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Implementation
- `src/components/ModelSelector/index.tsx` — Current ModelSelector (~380 lines) with search, chips, cloud quick-add. Primary refactor target.
- `src/components/ApiKeySettings/index.tsx` — Settings component with API key management. Complete, minimal changes expected.
- `src/lib/hfSearch.ts` — HF search and quantization extraction. `fetchAvailableQuantizations` returns siblings (needs size extraction).
- `src/pages/SettingsPage.tsx` — Settings page wrapper. Minimal.

### Types & State
- `src/types/index.ts` — TestConfig, HFModelResult, Quantization, Backend, CloudProvider types. May need extension for size/cache fields.
- `src/stores/useCompareStore.ts` — Model configs state (addConfig, removeConfig). Verify A/B comparison works.
- `src/stores/useSettingsStore.ts` — API keys with persist middleware. Read-only dependency for cloud model visibility.

### Styling
- `src/index.css` — Color system CSS custom properties (@theme block): cloud (#8250df), webgpu (#0969da), wasm (#1a7f37)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ModelSelector`: Search input, autocomplete dropdown, chip rendering, cloud quick-add — all scaffolded. Needs refactor for two-row chips, accordion, and size/cache.
- `ApiKeySettings`: Complete component — show/hide, test connection, CORS warning.
- `hfSearch.ts`: `searchModels()` and `fetchAvailableQuantizations()` both work. `fetchAvailableQuantizations` already fetches model detail with file sizes in siblings — just needs to expose size data.
- `useDebouncedValue` hook: Used by search, no changes needed.
- `quantCache`: In-memory Map for caching quantization fetches — can extend to cache size data too.

### Established Patterns
- Zustand stores with selector pattern (`useCompareStore((s) => s.configs)`)
- Component-level state for UI interactions (useState for search query, dropdown open, loading)
- Cloud provider gating via `apiKeys[provider]` check from settings store
- Color-coded badges using Tailwind classes referencing CSS custom properties

### Integration Points
- `useCompareStore.addConfig()` / `removeConfig()`: Used for all model chip operations
- `useSettingsStore.apiKeys`: Gates cloud model visibility
- `TestConfig` type: May need optional `estimatedSize` and `cached` fields
- Cache API: Browser-native, need to determine transformers.js cache key format

</code_context>

<specifics>
## Specific Ideas

- User wants the trash icon (not "x" text) for removing chips
- Cloud model accordion should be closed by default — local model workflow is primary
- The `[+]` custom cloud model ID field is intentionally unvalidated — errors surface at execution time. Keep it simple for POC.
- User prefers keeping the component "not too big" — accordion pattern solves this

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-model-selection-settings*
*Context gathered: 2026-04-10*
