---
phase: 260415-psw
reviewed: 2026-04-15T18:50:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - src/components/ModelSelector/index.tsx
  - src/lib/cacheManager.ts
  - vercel.json
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Code Review Report

**Reviewed:** 2026-04-15T18:50:00Z
**Depth:** quick
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed 3 files covering: async cached-model addition with HF fallback, cache size calculation changes, vercel.json SPA routing with COOP/COEP headers, and cloud accordion table restyling. The cache size calculation (`cacheManager.ts`) and SPA rewrite are correct. One critical issue with COEP headers blocking cloud API fetch calls, two warnings around async error handling and duplicate-addition race conditions, and one info-level note on silent error swallowing.

## Critical Issues

### CR-01: COEP `require-corp` blocks all cloud API fetch calls

**File:** `vercel.json:9`
**Issue:** `Cross-Origin-Embedder-Policy: require-corp` is applied to all routes via `/(.*)`.. This policy requires every cross-origin resource loaded by the page (including `fetch()` responses) to include a `Cross-Origin-Resource-Policy: cross-origin` header. OpenAI, Anthropic, and Google API endpoints do not serve that header. In production on Vercel, every cloud model inference call from `cloudApis.ts` will fail with a network error. COOP `same-origin` alone is fine for SharedArrayBuffer/WebGPU, but COEP `require-corp` is too restrictive for a page that also makes cross-origin API calls.
**Fix:** Use `credentialless` instead of `require-corp`. This still enables `crossOriginIsolated` (required for SharedArrayBuffer) while allowing no-credentials cross-origin fetches to succeed:
```json
{ "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" }
```
Note: `credentialless` is supported in Chrome 96+, Firefox 119+, Safari 17.2+ -- within the project's browser targets (Chrome 115+, Firefox 120+, Safari 17+).

## Warnings

### WR-01: `handleSelectModel` has no error handling

**File:** `src/components/ModelSelector/index.tsx:184`
**Issue:** `handleSelectModel` is async and calls `await fetchModelDetails(model.modelId)` at line 190 with no try/catch. If the HuggingFace API call fails (network error, rate limit, 500), the promise rejection propagates as an unhandled rejection in the React click handler. This contrasts with `handleAddCachedModel` (line 148) which correctly wraps the same call in try/catch with an offline fallback.
**Fix:** Wrap the fetch in try/catch, matching the pattern already used in `handleAddCachedModel`:
```tsx
async function handleSelectModel(model: HFModelResult) {
  const defaultBackend: Backend = webgpuSupported ? 'webgpu' : 'wasm'

  let details = modelDetailsCache.get(model.modelId)
  if (!details) {
    try {
      details = await fetchModelDetails(model.modelId)
      modelDetailsCache.set(model.modelId, details)
    } catch {
      // Could not fetch details; add config with minimal defaults
      details = { quantizations: ['q4' as Quantization], sizeByQuant: {} }
    }
  }
  // ... rest unchanged
}
```

### WR-02: Cached model rows can be added multiple times (no duplicate guard)

**File:** `src/components/ModelSelector/index.tsx:318-319`
**Issue:** Clicking a cached model table row calls `handleAddCachedModel` which immediately fires `addConfig` (line 159) before any async work. There is no check whether a config with the same `modelId + quantization + backend` combination already exists. Rapid clicks or accidental double-clicks will add duplicate entries. The cloud model table (line 375-378) correctly checks `alreadyAdded` before allowing the click -- cached models should do the same.
**Fix:** Add a duplicate guard before `addConfig`, consistent with the cloud model pattern:
```tsx
async function handleAddCachedModel(row: { modelId: string; quantization: string; size: number }): Promise<void> {
  const backend: Backend = webgpuSupported ? 'webgpu' : 'wasm'

  // Guard against duplicate additions (matches cloud model pattern at line 375)
  const alreadyAdded = configs.some(
    (c) => c.modelId === row.modelId && c.quantization === row.quantization && c.backend === backend
  )
  if (alreadyAdded) return

  // ... rest unchanged
}
```

## Info

### IN-01: Silent error swallowing in cacheManager catch blocks

**File:** `src/lib/cacheManager.ts:36,150`
**Issue:** Bare `catch {}` blocks silently discard errors in `enumerateCache` (line 36) and `deleteCachedModel` (line 150). While acceptable for cache-resilience (the fallback behavior is intentional), this makes debugging cache issues difficult in development.
**Fix:** Consider logging at debug level or adding a comment documenting why the error is intentionally ignored:
```ts
} catch {
  // Cache API unavailable or permission denied; return empty list gracefully
  return []
}
```

---

_Reviewed: 2026-04-15T18:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
