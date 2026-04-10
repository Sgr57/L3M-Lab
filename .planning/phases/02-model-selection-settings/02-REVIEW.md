---
phase: 02-model-selection-settings
reviewed: 2026-04-10T22:30:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/cacheCheck.ts
  - src/lib/formatSize.ts
  - src/types/index.ts
  - src/lib/hfSearch.ts
  - src/stores/useCompareStore.ts
  - src/components/ModelSelector/index.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-10T22:30:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the model selection and settings UI layer: type definitions, HuggingFace search/detail APIs, browser cache checking, size formatting utility, Zustand comparison store, and the main `ModelSelector` component.

Overall code quality is solid -- types are well-defined, store actions follow immutable patterns, and the component handles async flows with proper cleanup. Three warnings were identified: an unhandled promise rejection in the search effect, a crash-prone edge case in the `formatSize` utility for negative inputs, and a missing `.catch()` on a fire-and-forget promise. Two informational items note minor code smells.

## Warnings

### WR-01: Unhandled promise rejection in search effect

**File:** `src/components/ModelSelector/index.tsx:92`
**Issue:** The `searchModels` promise chain has no `.catch()` handler. If the fetch throws a network error (e.g., offline, DNS failure, CORS issue), the promise rejection is unhandled. While `searchModels` itself returns `[]` on non-ok responses, it does NOT catch network-level `fetch` errors (thrown before a response is received). This would produce an unhandled promise rejection warning in the browser console and leave `loading` stuck at `true`.
**Fix:**
```tsx
searchModels(debouncedQuery)
  .then((models) => {
    if (!cancelled) {
      setResults(models)
      setIsOpen(models.length > 0)
      setLoading(false)
    }
  })
  .catch(() => {
    if (!cancelled) {
      setResults([])
      setLoading(false)
    }
  })
```

### WR-02: `formatSize` crashes on negative input

**File:** `src/lib/formatSize.ts:4`
**Issue:** `Math.log(bytes)` returns `NaN` for negative numbers, causing `Math.floor(NaN)` to produce `NaN`. This leads to `units[NaN]` returning `undefined`, and the function outputs `~NaN undefined`. While the primary caller passes `config.estimatedSize ?? 0`, any future caller passing a negative value (e.g., a delta calculation) would produce garbled output. Additionally, for extremely large values (>= 1 TB), the index `i` would be 4 or higher and `units[i]` would be `undefined`.
**Fix:**
```ts
export function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `~${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
```

### WR-03: `searchModels` silently swallows network errors

**File:** `src/lib/hfSearch.ts:33`
**Issue:** The `fetch` call in `searchModels` has no try/catch. If the network request throws (offline, DNS failure), the error propagates unhandled to the caller. This is unlike `fetchModelDetails` and `fetchAvailableQuantizations` which both wrap their fetch calls in try/catch. The inconsistency means callers of `searchModels` must handle errors themselves, but the current caller (ModelSelector) does not (see WR-01).
**Fix:**
```ts
export async function searchModels(query: string): Promise<HFModelResult[]> {
  if (!query.trim()) return []

  try {
    const params = new URLSearchParams({
      search: query,
      filter: 'onnx,transformers.js',
      pipeline_tag: 'text-generation',
      sort: 'downloads',
      direction: '-1',
      limit: '20',
    })

    const res = await fetch(`${HF_API}?${params}`)
    if (!res.ok) return []

    const data: HFApiModel[] = await res.json()

    return data.map((model) => ({
      modelId: model.modelId ?? model.id,
      name: (model.modelId ?? model.id).split('/').pop() ?? model.id,
      downloads: model.downloads ?? 0,
      likes: model.likes ?? 0,
      pipelineTag: model.pipeline_tag ?? '',
      libraryName: model.library_name ?? '',
      availableQuantizations: [],
    }))
  } catch {
    return []
  }
}
```

## Info

### IN-01: Cloud model configs use misleading `quantization: 'fp16'`

**File:** `src/components/ModelSelector/index.tsx:159`
**Issue:** Cloud API model configs are created with `quantization: 'fp16'` which is semantically meaningless for cloud models -- cloud providers handle their own precision internally. This could mislead future code that branches on quantization. Consider using a sentinel value or making `quantization` optional for API-backend configs in the type definition.
**Fix:** Either make `quantization` optional when `backend === 'api'` in the `TestConfig` type, or add a comment explaining the convention. Minimal change:
```tsx
// Cloud models don't have user-selectable quantization; 'fp16' is a placeholder
quantization: 'fp16',
```

### IN-02: Duplicate quantization-matching logic across two functions

**File:** `src/lib/hfSearch.ts:113-119` and `src/lib/hfSearch.ts:135-166`
**Issue:** `matchQuantization` and `extractQuantizations` contain the same filename-to-quantization matching logic implemented independently. If new quantization patterns are added to one but not the other, they will silently diverge. The `extractQuantizations` function could be refactored to use `matchQuantization` internally.
**Fix:**
```ts
function extractQuantizations(onnxFiles: string[]): Quantization[] {
  const quants = new Set<Quantization>()
  for (const file of onnxFiles) {
    const quant = matchQuantization(file)
    if (quant) quants.add(quant)
  }
  if (quants.size === 0) quants.add('fp32')
  const order: Quantization[] = ['q4', 'q8', 'fp16', 'fp32']
  return order.filter((q) => quants.has(q))
}
```

---

_Reviewed: 2026-04-10T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
