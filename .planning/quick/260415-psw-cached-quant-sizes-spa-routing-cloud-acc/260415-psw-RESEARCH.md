# Quick Task 260415-psw: Research

**Researched:** 2026-04-15
**Domain:** ModelSelector UX, Cache API sizing, Vercel deployment, UI restructure
**Confidence:** HIGH

## Summary

Four targeted fixes across ModelSelector, cacheManager, and deployment config. All changes are well-scoped with clear code paths. The cached-model quant issue requires an async call in `handleAddCachedModel` that mirrors the HF search flow. The size calculation fix is a one-line filter in `groupByModelAndQuant`. The Vercel SPA fix needs a new `vercel.json` with both rewrites and COOP/COEP headers. The cloud accordion restructure replaces flex buttons with a table matching the cached accordion style.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **ONNX files only**: both HF estimates and cache sizes count only ONNX model weights; exclude shared files (tokenizer.json, config.json) from size totals
- **Cloud table rows like cached**: one row per predefined model with Provider, Model Name columns
- **Remove "+" action column from BOTH cached and cloud tables** -- clicking the row is the action
- **Cached model selection must fetch HF quants** via fetchModelDetails on selection
- **SPA routing**: add vercel.json with SPA fallback

### Claude's Discretion
- Accordion ordering: Cached Models first, Cloud Models second (both before HF search)
- Cloud table columns: Provider + Model Name (no size/last-used)

### Deferred Ideas (OUT OF SCOPE)
None specified.
</user_constraints>

## Fix 1: Cached Model Quant Selection

### Current Problem
`handleAddCachedModel` (ModelSelector lines 148-171) populates `configDetails` from `cachedRows` only:
```typescript
const modelRows = cachedRows.filter((r) => r.modelId === row.modelId)
const quants = modelRows.map((r) => r.quantization as Quantization)
```
This means the quant dropdown only shows cached quantizations (e.g., just `q8`), not all available HF quantizations (e.g., `q4`, `q8`, `fp16`). [VERIFIED: source code lines 163-164]

### How HF Search Does It (the correct flow)
`handleSelectModel` (lines 173-209):
1. Calls `fetchModelDetails(model.modelId)` -- async, returns all HF quants + sizes
2. Uses `modelDetailsCache` (module-level Map) for deduplication
3. Sets `configDetails[config.id]` with full quant list and sizeByQuant

### Fix Strategy
Make `handleAddCachedModel` async and call `fetchModelDetails()`:

```typescript
async function handleAddCachedModel(row: { modelId: string; quantization: string; size: number }): Promise<void> {
  const backend: Backend = webgpuSupported ? 'webgpu' : 'wasm'

  const config: TestConfig = {
    id: `${row.modelId}-${row.quantization}-${backend}-${crypto.randomUUID()}`,
    modelId: row.modelId,
    displayName: row.modelId.split('/').pop() ?? row.modelId,
    quantization: row.quantization as Quantization,
    backend,
    estimatedSize: row.size,
    cached: true,
  }
  addConfig(config)

  // Fetch ALL HF quants (same as search flow), with cache-only fallback
  let details = modelDetailsCache.get(row.modelId)
  if (!details) {
    try {
      details = await fetchModelDetails(row.modelId)
      modelDetailsCache.set(row.modelId, details)
    } catch {
      // Offline fallback: use only cached quants
      const modelRows = cachedRows.filter((r) => r.modelId === row.modelId)
      const quants = modelRows.map((r) => r.quantization as Quantization)
      const sizeByQuant: Record<string, number> = {}
      for (const r of modelRows) sizeByQuant[r.quantization] = r.size
      details = { quantizations: quants, sizeByQuant }
    }
  }

  setConfigDetails((prev) => ({
    ...prev,
    [config.id]: { quants: details!.quantizations, sizeByQuant: details!.sizeByQuant },
  }))
}
```

### Key Considerations

| Concern | Answer |
|---------|--------|
| Race condition? | No -- `addConfig` is synchronous (Zustand), `configDetails` update happens after. The chip renders immediately with the selected quant; dropdown populates when details arrive. [VERIFIED: Zustand store is sync] |
| `modelDetailsCache` helps? | Yes -- if the same model was already searched via HF, the cache hit avoids a network call. [VERIFIED: line 54, module-level Map] |
| Offline scenario? | `fetchModelDetails` already returns `{ quantizations: ['fp32'], sizeByQuant: {} }` on network error (hfSearch.ts line 82). Better: catch and fall back to cached-only quants as shown above. [VERIFIED: hfSearch.ts catch block] |
| UI flicker? | The config chip appears immediately with the cached quant selected. The dropdown updates asynchronously -- imperceptible since it only affects the `<select>` options, not the selected value. |

## Fix 2: Model Size Calculation -- ONNX Only

### HF Search (hfSearch.ts) -- Already Correct
`fetchModelDetails` filters to ONNX files only:
```typescript
const onnxFiles = siblings.filter((s) => s.rfilename.endsWith('.onnx'))
```
Then `sizeByQuant` sums only ONNX files per quant. [VERIFIED: hfSearch.ts lines 67-79] -- no change needed here.

### Cache Manager (cacheManager.ts) -- Needs Fix
`groupByModelAndQuant` (lines 60-127) currently adds shared files to `totalSize`:

```typescript
// Line 81-84: shared files counted separately
if (quant === null) {
  sharedSize += entry.size
  continue
}

// Line 113: totalSize includes shared files  <-- THE BUG
const totalSize = quantizations.reduce((sum, q) => sum + q.size, 0) + sharedSize
```

The per-quant `size` field (CachedQuantInfo.size) is already correct -- it only includes ONNX files for that quant. But `totalSize` on CachedModelInfo adds `sharedSize` (tokenizer.json, config.json, etc.).

### What Flows to the UI
In ModelSelector line 137, the cached rows use `q.size` (per-quant), NOT `m.totalSize`:
```typescript
m.quantizations.map((q) => ({
  modelId: m.modelId,
  quantization: q.quantization,
  size: q.size,       // <-- This is per-quant, already ONNX-only
  lastUsed: q.lastUsed,
}))
```

**Finding**: The per-quant size shown in the cached accordion is already correct (ONNX-only). The `totalSize` on `CachedModelInfo` includes shared files, but it is not currently displayed in the ModelSelector accordion. However, it IS used on the Models page (cache management table). The fix should still be applied to `totalSize` for consistency.

### Fix
Line 113 in cacheManager.ts -- remove `+ sharedSize`:
```typescript
const totalSize = quantizations.reduce((sum, q) => sum + q.size, 0)
```

This is a one-line change. The `sharedSize` variable and its accumulation can be removed entirely since it is no longer used. [VERIFIED: no other consumers of sharedSize in this function]

### Check Models Page
The Models page (`ModelsPage`) likely uses `totalSize` for the model-level row. Verify it renders correctly after the fix. [ASSUMED -- need to confirm ModelsPage uses CachedModelInfo.totalSize]

## Fix 3: Vercel SPA Routing

### Current State
- `BrowserRouter` in App.tsx -- requires server-side fallback to `/index.html` for all routes [VERIFIED: App.tsx line 12]
- Vite dev server has COOP/COEP headers configured (vite.config.ts lines 6-8, 16-18) [VERIFIED]
- No `vercel.json` exists [VERIFIED: glob found no matches]
- Vite `preview` also has headers, but Vercel production ignores vite.config.ts headers entirely [CITED: https://vercel.com/docs/project-configuration/vercel-json]

### Required vercel.json

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### Why Headers Must Be in vercel.json
Vite config headers only apply to `vite dev` and `vite preview`. On Vercel production, the static files are served by Vercel's CDN -- it reads headers from `vercel.json` only. Without COOP/COEP in vercel.json, SharedArrayBuffer will be unavailable in production, breaking Web Worker functionality. [CITED: Vercel docs -- headers are separate from rewrites and apply to all matched routes]

### Pitfall: Asset Requests
The `/(.*})` rewrite pattern could theoretically catch `.js`, `.css`, etc. However, Vercel's rewrite behavior gives precedence to existing static files in the build output. The rewrite only fires when no static file matches the path. This is the standard Vercel SPA pattern. [CITED: https://github.com/vercel/vercel/discussions/5448]

## Fix 4: Cloud Accordion to Table

### Current Structure (lines 507-616)
- Outer accordion wrapper with "Cloud Models" header (same as cached accordion)
- Inner loop over providers with API keys
- Each provider: label + flex-wrap of button pills + optional custom model input
- Each button pill: displayName + "added" badge or "+" indicator

### Target Structure
Match the cached accordion table format:
- `<table>` with columns: Provider, Model Name (no Size/Last Used per CONTEXT.md)
- One `<tr>` per predefined cloud model
- Row click adds the model (same as cached table)
- "already added" rows get `opacity-40 cursor-not-allowed` treatment
- Custom model input: as a final row spanning both columns, or below the table

### Column Design

| Column | Content | Width |
|--------|---------|-------|
| Provider | Badge with provider name (e.g., "openai") | Auto |
| Model | Display name (e.g., "GPT-4o-mini") | Flex |

### Action Column Removal (BOTH tables)
Per CONTEXT.md: remove the `<th className="pb-1.5 w-8"></th>` header and the `<td>` with the "+" span from the cached table (lines 300, 322-324). The entire row is clickable already. Apply the same no-action-column approach to the cloud table.

### Custom Model Input in Table Context
Options:
1. **After table, inside accordion** -- a separate `<div>` below the `</table>` per provider that has the input form. Cleanest separation.
2. **As a `<tr>` spanning columns** -- `<td colSpan={2}>` with the input form. Keeps everything in the table.

Recommendation: Option 1 (after table) -- the custom input form has different layout needs (text input + button) that don't map well to table columns. Keep it as a div below the table, grouped under its provider section.

### Provider Grouping Within the Table
Two approaches:
1. **Flat table with provider column** -- all models in one table, provider shown per row
2. **Grouped by provider** -- provider name as a section header row (`<tr>` with `colSpan`)

Recommendation: Flat table with provider column badge. Simpler, matches the cached table's flat structure. The CLOUD_MODELS array is already ordered by provider, so visual grouping happens naturally.

## Common Pitfalls

### Pitfall 1: Async onClick in Table Row
Making `handleAddCachedModel` async means the `onClick` handler returns a Promise. React does not await event handler promises. This is fine -- no error boundary issues. But if the user clicks rapidly, multiple `fetchModelDetails` calls could fire. The `modelDetailsCache` prevents duplicate network requests, so this is safe. [VERIFIED: module-level cache deduplicates]

### Pitfall 2: configDetails Key Mismatch
The `configDetails` state is keyed by `config.id`, which includes a UUID. If the same cached model is added twice, each gets a separate configDetails entry. This is correct behavior. [VERIFIED: crypto.randomUUID() in config.id generation]

### Pitfall 3: COOP/COEP Breaking Third-Party Resources
The `require-corp` COEP header means ALL cross-origin resources must include `Cross-Origin-Resource-Policy: cross-origin` or be loaded via `crossorigin` attribute. Since this app already works in dev with these headers, production should be fine. But if future CDN resources are added, they must support CORP. [ASSUMED -- based on how COEP works]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ModelsPage uses CachedModelInfo.totalSize for display | Fix 2 | If ModelsPage doesn't use totalSize, the fix is still correct but the visible impact is only on the Models page cache management table |
| A2 | COEP won't break any current production resources | Fix 3 | If broken, specific resources would fail to load -- easy to debug via console errors |

## Sources

### Primary (HIGH confidence)
- Source code: ModelSelector/index.tsx, hfSearch.ts, cacheManager.ts, cacheCheck.ts, App.tsx, vite.config.ts
- [Vercel rewrites documentation](https://vercel.com/docs/rewrites)
- [Vercel vercel.json configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel SPA discussion](https://github.com/vercel/vercel/discussions/5448)
