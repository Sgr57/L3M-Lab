---
phase: 06-cleanup-documentation
reviewed: 2026-04-12T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/lib/exportUtils.ts
  - src/lib/hfSearch.ts
  - src/components/TestProgress/index.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-04-12T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed three source files covering export/download utilities, HuggingFace model search, and the test progress UI component. No critical security issues or crash-inducing bugs were found. Two warnings were identified: an unhandled JSON parse error in `hfSearch.ts` that could surface as an unhandled promise rejection, and a missing bounds check in the `stars()` export helper that would throw a `RangeError` on out-of-range input. Two informational items relate to duplicated quantization-matching logic and a minor fallback default that ignores the WASM backend.

## Warnings

### WR-01: Unhandled `res.json()` parse failure in `searchModels`

**File:** `src/lib/hfSearch.ts:36`
**Issue:** `searchModels` checks `res.ok` but does not wrap `res.json()` in a try/catch. If the HuggingFace API returns a 200 response with malformed or non-JSON body (e.g., an HTML error page from a CDN), `res.json()` will throw, resulting in an unhandled promise rejection that propagates to the calling component.

By contrast, `fetchModelDetails` (line 60) correctly wraps its entire body in try/catch.

**Fix:**
```typescript
export async function searchModels(query: string): Promise<HFModelResult[]> {
  if (!query.trim()) return []

  const params = new URLSearchParams({
    search: query,
    filter: 'onnx,transformers.js',
    pipeline_tag: 'text-generation',
    sort: 'downloads',
    direction: '-1',
    limit: '20',
  })

  try {
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

### WR-02: `stars()` helper throws RangeError on out-of-bounds rating

**File:** `src/lib/exportUtils.ts:17`
**Issue:** `'☆'.repeat(5 - rating)` will throw a `RangeError` if `rating > 5` (negative repeat count) or produce unexpected output if `rating < 0` or non-integer. The `StarRating` UI component constrains values to 1-5, but the `stars()` function accepts any `number`. If a future code path sets a rating outside 1-5 (or if persisted data is corrupt), the entire markdown export would crash.

**Fix:**
```typescript
function stars(rating: number | null): string {
  if (rating === null) return 'Not rated'
  const clamped = Math.max(0, Math.min(5, Math.round(rating)))
  return '\u2605'.repeat(clamped) + '\u2606'.repeat(5 - clamped)
}
```

## Info

### IN-01: Duplicated quantization-matching logic between `matchQuantization` and `extractQuantizations`

**File:** `src/lib/hfSearch.ts:91-143`
**Issue:** `matchQuantization` (lines 91-98) and `extractQuantizations` (lines 113-143) contain identical pattern-matching logic for mapping ONNX filenames to quantization types. If a new quantization type is added, both functions must be updated in lockstep or they will diverge.

**Fix:** Refactor `extractQuantizations` to use `matchQuantization` internally:
```typescript
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

### IN-02: Backend fallback defaults to `webgpu`, ignoring `wasm`

**File:** `src/components/TestProgress/index.tsx:118-119`
**Issue:** When a running model's config is not found in the `configs` array, the fallback backend defaults to `isCloud ? 'api' : 'webgpu'`. This means a WASM-backend model would incorrectly display as "webgpu" in the progress indicator if the config lookup fails. In practice this is unlikely since configs should always be present during a run, but the fallback is not fully accurate.

**Fix:** Consider reading the backend from `runProgress` itself if available, or add `'wasm'` detection. Alternatively, accept this as a known limitation since the scenario requires a broken invariant (missing config during active run).

---

_Reviewed: 2026-04-12T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
