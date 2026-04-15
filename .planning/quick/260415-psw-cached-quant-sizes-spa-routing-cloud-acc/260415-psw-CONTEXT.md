# Quick Task 260415-psw: Cached Quant + Sizes + SPA Routing + Cloud Accordion - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Task Boundary

Four changes:
1. Cached model selection must behave like HF search: add with correct quant, fetch all HF quants for dropdown
2. Fix model size calculation — ONNX files only, exclude shared files (tokenizer, config) from both HF and cache sizes
3. Fix Vercel SPA routing — page refresh on /models or /settings returns 404
4. Move cloud accordion below cached accordion, restyle as table rows matching cached accordion style

</domain>

<decisions>
## Implementation Decisions

### Model Size Calculation
- **ONNX files only**: both HF estimates and cache sizes should count only ONNX model weights
- Exclude shared files (tokenizer.json ~1MB, config.json ~1KB) from size totals
- Goal: HF estimate and cached size show same number for same model+quant

### Cloud Accordion Restyle
- **Table rows like cached**: one row per predefined model with Provider, Model Name columns
- Custom model input remains as inline form at bottom of accordion
- **Action column**: remove the "+" action column from BOTH cached and cloud tables. Clicking the row is the action. (User note: "spostiamo la action all'inizio o rimuoviamola del tutto anche sull'altra tabella" → remove from both)

### Cached Model Selection Behavior
- When selecting a cached model with specific quant (e.g. q8), it should be added with that quant
- After adding, quant dropdown must show all available HF quantizations (not just cached ones)
- Requires fetching model details from HF API on selection (same as search flow)

### SPA Routing
- Add vercel.json with SPA fallback (rewrites all routes to /index.html)
- BrowserRouter already in use — just needs deployment config

### Claude's Discretion
- Accordion ordering: Cached Models first, Cloud Models second (both before HF search)
- Cloud table columns: Provider + Model Name (no size/last-used — not applicable to cloud)

</decisions>

<specifics>
## Specific Ideas

- cacheManager.ts: filter out non-ONNX entries (null quantization) from size sums
- hfSearch.ts: already counts only ONNX files — verify it's correct
- handleAddCachedModel: call fetchModelDetails() to get all HF quants, populate configDetails
- vercel.json: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- Cloud accordion: replace flex button layout with table structure matching cached models

</specifics>
