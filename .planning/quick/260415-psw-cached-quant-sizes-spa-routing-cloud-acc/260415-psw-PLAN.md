---
phase: quick-260415-psw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ModelSelector/index.tsx
  - src/lib/cacheManager.ts
  - vercel.json
autonomous: true
requirements: []

must_haves:
  truths:
    - "Selecting a cached model adds it with the correct quant and then populates the quant dropdown with ALL HF quantizations (not just cached ones)"
    - "Model size calculations (both HF estimates and cache sizes) count only ONNX model weight files, excluding shared files like tokenizer.json and config.json"
    - "Refreshing any route on Vercel (e.g. /models, /settings) returns the SPA with correct COOP/COEP headers"
    - "Cloud models appear as table rows (Provider + Model Name columns) below the Cached Models accordion"
    - "Neither cached nor cloud tables have a '+' action column -- row click is the only add action"
  artifacts:
    - path: "src/components/ModelSelector/index.tsx"
      provides: "Async cached model selection with HF quant fetch, cloud table rows, removed action columns"
    - path: "src/lib/cacheManager.ts"
      provides: "ONNX-only totalSize calculation in groupByModelAndQuant"
    - path: "vercel.json"
      provides: "SPA fallback rewrites + COOP/COEP headers for production"
  key_links:
    - from: "src/components/ModelSelector/index.tsx (handleAddCachedModel)"
      to: "src/lib/hfSearch.ts (fetchModelDetails)"
      via: "async call with modelDetailsCache deduplication"
      pattern: "fetchModelDetails\\(row\\.modelId\\)"
    - from: "vercel.json rewrites"
      to: "index.html"
      via: "Vercel CDN catch-all rewrite"
      pattern: "rewrites.*index\\.html"
    - from: "src/lib/cacheManager.ts (groupByModelAndQuant)"
      to: "src/components/CachedModelsTable/index.tsx"
      via: "totalSize field on CachedModelInfo"
      pattern: "totalSize"
---

<objective>
Four targeted fixes across ModelSelector, cacheManager, and deployment config:

1. Make cached model selection fetch all HF quantizations (matching the HF search flow)
2. Fix totalSize to count only ONNX files (exclude shared files)
3. Add vercel.json for SPA routing with COOP/COEP headers
4. Restyle cloud accordion as table rows and remove "+" action column from both tables

Purpose: Align cached model UX with HF search UX, fix size consistency, enable Vercel production deployment, and clean up model selection UI.
Output: Updated ModelSelector component, fixed cacheManager, new vercel.json.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260415-psw-cached-quant-sizes-spa-routing-cloud-acc/260415-psw-CONTEXT.md
@.planning/quick/260415-psw-cached-quant-sizes-spa-routing-cloud-acc/260415-psw-RESEARCH.md
@src/components/ModelSelector/index.tsx
@src/lib/cacheManager.ts
@src/lib/hfSearch.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/lib/hfSearch.ts:
```typescript
export interface ModelDetails {
  quantizations: Quantization[]
  sizeByQuant: Record<string, number>
}
export async function fetchModelDetails(modelId: string): Promise<ModelDetails>
```

From src/types/index.ts:
```typescript
export interface CachedModelInfo {
  modelId: string
  totalSize: number
  lastUsed: number | null
  quantizations: CachedQuantInfo[]
}
```

From ModelSelector module scope (line 54):
```typescript
const modelDetailsCache = new Map<string, ModelDetails>()
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix cacheManager totalSize + create vercel.json</name>
  <files>src/lib/cacheManager.ts, vercel.json</files>
  <action>
**cacheManager.ts -- ONNX-only totalSize (per CONTEXT.md locked decision):**

In `groupByModelAndQuant`, line 113, change:
```typescript
const totalSize = quantizations.reduce((sum, q) => sum + q.size, 0) + sharedSize
```
to:
```typescript
const totalSize = quantizations.reduce((sum, q) => sum + q.size, 0)
```

Also remove the `sharedSize` variable declaration (line 77) and the accumulation block (lines 81-84) since `sharedSize` is no longer used. The `quant === null` check should still `continue` (skip non-ONNX files from being added to any quant group) but without accumulating their size:

```typescript
if (quant === null) {
  continue
}
```

**vercel.json -- SPA routing + COOP/COEP headers (per CONTEXT.md locked decision):**

Create `/vercel.json` (project root) with:
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

This ensures: (a) all routes fall back to index.html for BrowserRouter, (b) COOP/COEP headers are served in production (required for SharedArrayBuffer in Web Workers). Vite config headers only apply to dev/preview, not Vercel CDN.
  </action>
  <verify>
    <automated>cd /Users/emanuele/Projects/CompareLocalLLM && npx tsc --noEmit 2>&1 | head -30 && cat vercel.json | npx --yes json 2>/dev/null && echo "VALID JSON"</automated>
  </verify>
  <done>
- `groupByModelAndQuant` totalSize no longer includes sharedSize; `sharedSize` variable removed
- `vercel.json` exists at project root with rewrites and COOP/COEP headers
- TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Async cached model selection with HF quant fetch</name>
  <files>src/components/ModelSelector/index.tsx</files>
  <action>
**Make handleAddCachedModel async and fetch all HF quants (per CONTEXT.md locked decision):**

Replace the `handleAddCachedModel` function (lines 148-171) with an async version that mirrors `handleSelectModel`'s quant-fetching pattern:

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

  // Fetch ALL HF quants (same as HF search flow), with cache-only fallback
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

Key behavior:
- `addConfig` is sync (Zustand) so the chip renders immediately with the cached quant selected
- `fetchModelDetails` is the same function used by HF search -- returns all HF quants + sizeByQuant
- `modelDetailsCache` (module-level Map) deduplicates network calls if same model was already searched
- Catch block falls back to cached-only quants if offline
- The `onClick` handler in the cached table row (line 308) already works fine with async -- React doesn't await event handler promises, and this is safe since `addConfig` fires synchronously before the await
  </action>
  <verify>
    <automated>cd /Users/emanuele/Projects/CompareLocalLLM && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
- `handleAddCachedModel` is async and calls `fetchModelDetails` from hfSearch.ts
- Quant dropdown for cached models shows all HF quantizations after selection
- Falls back to cached-only quants on network failure
- TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Cloud accordion to table rows + remove action column from both tables</name>
  <files>src/components/ModelSelector/index.tsx</files>
  <action>
**Remove "+" action column from cached models table (per CONTEXT.md locked decision):**

In the cached models table (lines 293-328):
1. Remove the empty header `<th className="pb-1.5 w-8"></th>` (line 300)
2. Remove the action `<td>` containing the "+" span (lines 322-324):
   ```tsx
   <td className="py-1.5 text-right">
     <span className="text-primary text-[11px] font-semibold">+</span>
   </td>
   ```

The row already has `cursor-pointer` and `onClick` -- no additional click handling needed.

**Move cloud accordion BELOW cached accordion (per Claude's discretion: Cached first, Cloud second):**

The cloud accordion JSX (lines 507-616) currently appears AFTER the HF search input and model chips. Move the entire cloud accordion block to appear directly after the cached accordion block (after line 332), before the HF search input. Keep cached accordion first, cloud accordion second, then HF search.

**Restyle cloud accordion content as table rows (per CONTEXT.md locked decision):**

Replace the inner content of the cloud accordion (the provider-grouped flex buttons, lines 527-612) with a flat table matching the cached accordion style. Two columns: Provider, Model Name.

```tsx
{cloudAccordionOpen && (
  <div className="border-t border-border px-4 pb-3 pt-2">
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary">
          <th className="pb-1.5 font-semibold">Provider</th>
          <th className="pb-1.5 font-semibold">Model</th>
        </tr>
      </thead>
      <tbody>
        {(['openai', 'anthropic', 'google'] as CloudProvider[])
          .filter((p) => apiKeys[p])
          .flatMap((provider) =>
            CLOUD_MODELS
              .filter((cm) => cm.provider === provider)
              .map((cm) => {
                const alreadyAdded = configs.some(
                  (c) => c.provider === cm.provider && c.cloudModel === cm.cloudModel
                )
                return (
                  <tr
                    key={cm.cloudModel}
                    className={`border-t border-border/50 ${
                      alreadyAdded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-bg cursor-pointer'
                    }`}
                    onClick={() =>
                      !alreadyAdded && !disabled &&
                      handleAddCloudModel(cm.provider, cm.displayName, cm.cloudModel)
                    }
                  >
                    <td className="py-1.5 pr-2">
                      <span className="rounded bg-cloud-bg px-1.5 py-0.5 text-[10px] font-semibold text-cloud">
                        {cm.provider}
                      </span>
                    </td>
                    <td className="py-1.5 font-medium text-text-primary">
                      {cm.displayName}
                    </td>
                  </tr>
                )
              })
          )}
      </tbody>
    </table>
    {/* Custom model inputs -- per provider, below the table */}
    {(['openai', 'anthropic', 'google'] as CloudProvider[])
      .filter((p) => apiKeys[p])
      .map((provider) => {
        const customInput = customModelInputs[provider]
        return (
          <div key={provider} className="mt-2 first:mt-3">
            {!customInput.open ? (
              <button
                type="button"
                className="text-[11px] text-text-tertiary hover:text-text-secondary"
                onClick={() => setCustomModelInputs((prev) => ({
                  ...prev,
                  [provider]: { ...prev[provider], open: true },
                }))}
                disabled={disabled}
              >
                + Custom {provider} model
              </button>
            ) : (
              <div className="flex gap-1.5">
                <span className="flex items-center rounded bg-cloud-bg px-1.5 py-0.5 text-[10px] font-semibold text-cloud">
                  {provider}
                </span>
                <input
                  type="text"
                  className="flex-1 rounded border border-border bg-bg px-2 py-1 text-[11px] text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none"
                  placeholder="model-id (e.g. gpt-4-turbo)"
                  value={customInput.value}
                  onChange={(e) => setCustomModelInputs((prev) => ({
                    ...prev,
                    [provider]: { ...prev[provider], value: e.target.value },
                  }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustomCloudModel(provider)
                    if (e.key === 'Escape') setCustomModelInputs((prev) => ({
                      ...prev,
                      [provider]: { open: false, value: '' },
                    }))
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="rounded border border-border bg-bg px-2 py-1 text-[11px] text-primary hover:bg-surface"
                  onClick={() => handleAddCustomCloudModel(provider)}
                  disabled={!customInput.value.trim()}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        )
      })}
  </div>
)}
```

The cloud accordion `<div>` wrapper (border, button header with chevron) stays unchanged -- only the inner content changes to table format.

**Add `mb-4` to cloud accordion wrapper** to match cached accordion spacing. The cloud accordion wrapper div should have `className="mb-4 rounded-lg border border-border"` (add `mb-4`).
  </action>
  <verify>
    <automated>cd /Users/emanuele/Projects/CompareLocalLLM && npx tsc --noEmit 2>&1 | head -20 && npx eslint src/components/ModelSelector/index.tsx 2>&1 | tail -5</automated>
  </verify>
  <done>
- Cached models table has no "+" action column (4 columns: Model, Quant, Size, Last Used)
- Cloud accordion appears between cached accordion and HF search input
- Cloud models displayed as table rows with Provider badge + Model Name columns
- No action column on cloud table -- row click adds the model
- Custom model inputs appear below cloud table per provider
- Already-added cloud models have opacity-40 + cursor-not-allowed
- TypeScript and ESLint pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser -> HF API | fetchModelDetails call when selecting cached models (new async path) |
| Vercel CDN -> Browser | COOP/COEP headers affect cross-origin resource loading |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-psw-01 | Denial of Service | handleAddCachedModel async | accept | modelDetailsCache deduplicates calls; rapid clicks safe because addConfig is sync and cache prevents duplicate fetches |
| T-psw-02 | Information Disclosure | COOP/COEP headers | accept | Headers are security-positive (isolate cross-origin); no new attack surface. May break future cross-origin resources but app already works with these headers in dev |
</threat_model>

<verification>
1. `npx tsc --noEmit` -- TypeScript compiles cleanly
2. `npx eslint src/components/ModelSelector/index.tsx src/lib/cacheManager.ts` -- no lint errors
3. `cat vercel.json` -- valid JSON with rewrites and headers sections
4. Visual check: cached accordion has no "+" column, cloud accordion shows table rows
5. Visual check: cloud accordion appears after cached accordion, before HF search
6. Functional check: selecting a cached model populates quant dropdown with all HF quants
</verification>

<success_criteria>
- Cached model quant dropdown shows all HF quantizations after selection (not just cached ones)
- Model size in CachedModelsTable (Models page) excludes shared files (ONNX-only totalSize)
- vercel.json exists with SPA rewrites + COOP/COEP headers
- Cloud accordion renders as table rows below cached accordion
- No "+" action column in either cached or cloud tables
- TypeScript and ESLint pass with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/260415-psw-cached-quant-sizes-spa-routing-cloud-acc/260415-psw-SUMMARY.md`
</output>
