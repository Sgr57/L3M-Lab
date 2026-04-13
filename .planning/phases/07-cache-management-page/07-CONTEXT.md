# Phase 7: Cache Management Page - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Source:** Exploration session (/gsd-explore)

<domain>
## Phase Boundary

New `/models` page that provides a centralized interface for managing locally cached LLMs. Replaces the current workflow of manually inspecting the Cache API via browser DevTools.

</domain>

<decisions>
## Implementation Decisions

### Page Structure
- New route at `/models` alongside `/` (compare) and `/settings`
- Two main sections: cached models table + search/download new models

### Cached Models Table (Expandable)
- Parent rows: model name, total size across all quantizations, most recent last_used timestamp, delete-all button
- Expandable child rows per quantization: quantization label, individual size, individual last_used, delete button
- Sortable columns, filters

### Usage Tracking
- Track `lastUsed` timestamp per model+quantization in a Zustand persisted store
- Update timestamp every time a model is used in a comparison test
- Key: modelId + quantization combination

### Quick Cleanup
- Button to remove all models not used in >2 weeks
- Confirmation dialog before bulk delete

### Search & Download
- Reuse existing ModelSelector component for HuggingFace model search
- Add "Download" action to pre-cache a model without running a comparison

### Cache API Integration
- Enumerate cache entries from the "default" bucket
- Group entries by model ID + quantization prefix
- Sum Content-Length headers for size calculation per model+quantization
- Delete specific entries by model+quantization prefix

### Claude's Discretion
- Internal component structure and file organization
- Exact Tailwind styling choices (follow existing app patterns)
- Cache enumeration implementation details
- Error handling for cache operations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Components
- `src/components/ModelSelector/index.tsx` — Existing model search component to reuse
- `src/components/NavBar/index.tsx` — Navigation bar to add /models link

### State Management
- `src/stores/useSettingsStore.ts` — Existing persisted Zustand store pattern
- `src/stores/useCompareStore.ts` — Store pattern reference

### Execution Layer
- `src/lib/workerBridge.ts` — Worker bridge that triggers model usage (where to update lastUsed)
- `src/workers/inference.worker.ts` — Worker that uses Cache API for models

### Types
- `src/types/index.ts` — Existing type definitions

### Routing
- `src/App.tsx` — Router setup for adding new page

</canonical_refs>

<specifics>
## Specific Ideas

- Cache API entries have Content-Length headers available (confirmed via DevTools)
- Cache bucket name is "default"
- Models like SmolLM2-135M-Instruct and DeepSeek-R1-Distill-Qwen-1.5B are examples of cached models
- Each model can have multiple quantizations (q4, q8, fp16, etc.) cached independently

</specifics>

<deferred>
## Deferred Ideas

- Storage quota dashboard (total used vs browser quota via navigator.storage.estimate()) — seeded for after this phase

</deferred>

---

*Phase: 07-cache-management-page*
*Context gathered: 2026-04-13 via exploration session*
