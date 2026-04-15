# Quick Task 260415-ntl: Cached Models Accordion + Retry Button Fix - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Task Boundary

Two changes to the Compare page:
1. New "Cached Models" accordion in ModelSelector (before HF search), showing cached models from browser Cache API for quick selection
2. Per-model retry button in PreDownload when a download fails (error message references "retry" but no button exists)

</domain>

<decisions>
## Implementation Decisions

### Cached Model Display Format
- **Mini table rows**: one row per model+quantization showing name, quant, size, last-used
- Click row to add model to comparison
- Reuse data from `enumerateCache()` + `groupByModelAndQuant()` in cacheManager.ts

### Selection Behavior
- **Auto WebGPU, fallback WASM**: clicking a cached model row auto-adds config with WebGPU backend (or WASM if WebGPU not supported)
- No backend picker dialog — cached models are local by definition
- Model added as `cached: true` immediately

### Retry Button Scope
- **Per-model retry**: small retry icon next to each failed model in the PreDownload progress list
- Retries just that individual model, not all failed models
- Global "Retry Failed" not needed for now

### Claude's Discretion
- Accordion open/closed default state (suggest: closed by default, matching cloud accordion)
- Empty state when no models cached
- Retry mechanism implementation (re-post download command for single model to worker)

</decisions>

<specifics>
## Specific Ideas

- Accordion pattern: copy structure from cloud models accordion (`cloudAccordionOpen` toggle pattern)
- Data source: `enumerateCache()` from cacheManager.ts already provides model list with sizes
- Usage timestamps: from `useModelUsageStore` (already used in CachedModelsTable)
- Retry: workerBridge already has `retryable` flag on error events — wire it to per-model retry action

</specifics>
