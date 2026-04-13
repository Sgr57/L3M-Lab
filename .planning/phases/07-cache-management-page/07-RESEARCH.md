# Phase 7: Cache Management Page - Research

**Researched:** 2026-04-13
**Domain:** Browser Cache API management, Transformers.js ModelRegistry, React UI patterns
**Confidence:** HIGH

## Summary

This phase adds a `/models` page for managing locally cached LLMs. The most significant research finding is that **Transformers.js v4 (already installed at 4.0.1) includes a `ModelRegistry` API** with built-in methods for cache checking (`is_cached`, `is_cached_files`), cache clearing (`clear_cache`, `clear_pipeline_cache`), file metadata (`get_file_metadata`), and dtype discovery (`get_available_dtypes`). This eliminates the need to hand-roll most cache management logic.

However, the `ModelRegistry` API is per-model (requires knowing model IDs upfront) and cannot enumerate all cached models. For the "list all cached models" feature, the raw Cache API must be used: open `transformers-cache` via `caches.open()`, call `cache.keys()` to get all `Request` objects, and parse the URLs (pattern: `https://huggingface.co/{org}/{model}/resolve/main/{filepath}`) to extract model IDs and group entries by model+quantization.

The usage tracking (lastUsed timestamps) has no existing infrastructure and needs a new persisted Zustand store. The "download without running" feature can reuse the existing `workerBridge.startDownload()` mechanism with minimal adaptation.

**Primary recommendation:** Use raw Cache API `keys()` for enumeration + `ModelRegistry.clear_cache()` for deletion + a new `useModelUsageStore` for lastUsed tracking. Do NOT hand-roll cache deletion logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New route at `/models` alongside `/` (compare) and `/settings`
- Two main sections: cached models table + search/download new models
- Parent rows: model name, total size across all quantizations, most recent last_used timestamp, delete-all button
- Expandable child rows per quantization: quantization label, individual size, individual last_used, delete button
- Sortable columns, filters
- Track `lastUsed` timestamp per model+quantization in a Zustand persisted store
- Update timestamp every time a model is used in a comparison test
- Key: modelId + quantization combination
- Button to remove all models not used in >2 weeks
- Confirmation dialog before bulk delete
- Reuse existing ModelSelector component for HuggingFace model search
- Add "Download" action to pre-cache a model without running a comparison
- Enumerate cache entries from the "transformers-cache" bucket (confirmed: bucket name is `transformers-cache` via codebase -- existing `cacheCheck.ts` uses `CACHE_NAME = 'transformers-cache'`)
- Group entries by model ID + quantization prefix
- Sum Content-Length headers for size calculation per model+quantization
- Delete specific entries by model+quantization prefix

### Claude's Discretion
- Internal component structure and file organization
- Exact Tailwind styling choices (follow existing app patterns)
- Cache enumeration implementation details
- Error handling for cache operations

### Deferred Ideas (OUT OF SCOPE)
- Storage quota dashboard (total used vs browser quota via navigator.storage.estimate())
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand + Recharts (no changes)
- **No backend**: Everything client-side
- **Single worker**: All model operations in one dedicated Web Worker
- **POC scope**: Functional-first, minimal polish
- **Named exports preferred** over default exports (except `App`)
- **Component pattern**: PascalCase with `index.tsx` structure in own directory
- **Store pattern**: camelCase with `use` prefix, Zustand `create<StateType>()(persist(...))` for persisted state
- **Hook pattern**: camelCase with `use` prefix in `src/hooks/`
- **Lib pattern**: camelCase in `src/lib/`
- **No test framework** -- no tests to write

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @huggingface/transformers | 4.0.1 | `ModelRegistry` API for cache management | [VERIFIED: node_modules source code] Already installed; provides `is_cached`, `clear_cache`, `get_file_metadata`, `get_available_dtypes` |
| react-router-dom | 7.14.0 | Add `/models` route | [VERIFIED: package.json] Already installed |
| zustand | 5.0.12 | New `useModelUsageStore` for lastUsed timestamps | [VERIFIED: package.json] Already installed with persist middleware |
| Browser Cache API | N/A | Enumerate all cached model entries | [VERIFIED: MDN docs] Available in all target browsers, requires HTTPS context |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react | 19.2.4 | Component rendering | All components |
| tailwindcss | 4.2.2 | Styling | All UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw Cache API for enumeration | `ModelRegistry` only | ModelRegistry requires known model IDs; cannot discover unknown cached models |
| New persisted store for lastUsed | Extend `useSettingsStore` | Separate store keeps concerns clean; settings is for API keys/params |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── pages/
│   └── ModelsPage.tsx              # New page component
├── components/
│   ├── CachedModelsTable/
│   │   └── index.tsx               # Expandable table with parent/child rows
│   └── ModelDownloader/
│       └── index.tsx               # Search + download (wraps/reuses ModelSelector patterns)
├── stores/
│   └── useModelUsageStore.ts       # New persisted store for lastUsed timestamps
├── lib/
│   └── cacheManager.ts             # Cache enumeration, size calculation, deletion helpers
└── types/
    └── index.ts                    # Add CachedModelInfo, CachedQuantInfo types
```

### Pattern 1: Cache Enumeration via Raw Cache API
**What:** Open `transformers-cache`, call `keys()`, parse URLs to discover all cached models
**When to use:** On page load or refresh to populate the cached models table
**Example:**
```typescript
// Source: [VERIFIED: node_modules/@huggingface/transformers/src/env.js line 276, src/utils/hub.js lines 125-156]
// Cache entries are keyed as: https://huggingface.co/{org}/{model}/resolve/main/{filepath}
// e.g., https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/onnx/model_q4.onnx

const CACHE_NAME = 'transformers-cache'
const HF_URL_REGEX = /^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+)$/

interface CacheEntry {
  modelId: string   // e.g., "HuggingFaceTB/SmolLM2-135M-Instruct"
  filepath: string  // e.g., "onnx/model_q4.onnx"
  url: string       // full URL (cache key)
  size: number      // bytes from Content-Length or blob
}

async function enumerateCachedModels(): Promise<CacheEntry[]> {
  const cache = await caches.open(CACHE_NAME)
  const requests = await cache.keys()
  
  const entries: CacheEntry[] = []
  for (const request of requests) {
    const match = request.url.match(HF_URL_REGEX)
    if (!match) continue
    
    const [, modelId, filepath] = match
    const response = await cache.match(request)
    if (!response) continue
    
    // Prefer Content-Length header; fall back to reading blob size
    const contentLength = response.headers.get('Content-Length')
    const size = contentLength ? parseInt(contentLength, 10) : (await response.clone().blob()).size
    
    entries.push({ modelId, filepath, url: request.url, size })
  }
  return entries
}
```

### Pattern 2: Grouping by Model + Quantization
**What:** Group cache entries into a hierarchical structure for the expandable table
**When to use:** After enumeration, before rendering
**Example:**
```typescript
// Source: [VERIFIED: existing cacheCheck.ts and hfSearch.ts patterns]
// Reuse the quantization matching logic from hfSearch.ts

interface CachedQuantInfo {
  quantization: string        // e.g., "q4", "fp16"
  size: number                // total bytes for this quant
  lastUsed: number | null     // from useModelUsageStore
  files: string[]             // list of cached filepaths
}

interface CachedModelInfo {
  modelId: string
  totalSize: number
  lastUsed: number | null     // most recent across all quants
  quantizations: CachedQuantInfo[]
}

function groupByModelAndQuant(entries: CacheEntry[]): CachedModelInfo[] {
  // Group entries by modelId
  // For each model, sub-group by quantization (inferred from filepath)
  // Sum sizes within each group
  // Merge with lastUsed timestamps from store
}
```

### Pattern 3: Cache Deletion via ModelRegistry
**What:** Use `ModelRegistry.clear_cache()` for safe, official deletion instead of hand-rolling
**When to use:** When user clicks delete on a specific model+quantization or the "delete all" button
**Example:**
```typescript
// Source: [VERIFIED: node_modules ModelRegistry.js and clear_cache.js]
import { ModelRegistry } from '@huggingface/transformers'

// Delete specific quantization
async function deleteModelQuant(modelId: string, dtype: string): Promise<void> {
  const result = await ModelRegistry.clear_cache(modelId, { dtype })
  console.log(`Deleted ${result.filesDeleted} of ${result.filesCached} cached files`)
}

// Delete all quantizations for a model
async function deleteAllModelQuants(modelId: string, dtypes: string[]): Promise<void> {
  for (const dtype of dtypes) {
    await ModelRegistry.clear_cache(modelId, { dtype })
  }
}
```

### Pattern 4: Usage Tracking Store
**What:** New Zustand persisted store tracking lastUsed timestamp per model+quantization
**When to use:** Updated on every model run in workerBridge, read on ModelsPage
**Example:**
```typescript
// Source: [VERIFIED: existing useSettingsStore.ts pattern]
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ModelUsageState {
  lastUsed: Record<string, number>  // key: "modelId::quantization", value: timestamp
  setLastUsed: (modelId: string, quantization: string) => void
  getLastUsed: (modelId: string, quantization: string) => number | null
  removeUsage: (modelId: string, quantization?: string) => void
}

export const useModelUsageStore = create<ModelUsageState>()(
  persist(
    (set, get) => ({
      lastUsed: {},
      setLastUsed: (modelId, quantization) =>
        set((state) => ({
          lastUsed: { ...state.lastUsed, [`${modelId}::${quantization}`]: Date.now() },
        })),
      getLastUsed: (modelId, quantization) =>
        get().lastUsed[`${modelId}::${quantization}`] ?? null,
      removeUsage: (modelId, quantization) =>
        set((state) => {
          const next = { ...state.lastUsed }
          if (quantization) {
            delete next[`${modelId}::${quantization}`]
          } else {
            // Remove all entries for this model
            for (const key of Object.keys(next)) {
              if (key.startsWith(`${modelId}::`)) delete next[key]
            }
          }
          return { lastUsed: next }
        }),
    }),
    { name: 'model-usage-tracking' }
  )
)
```

### Pattern 5: Routing Integration
**What:** Add `/models` route in App.tsx and NavBar link
**When to use:** One-time setup
**Example:**
```typescript
// Source: [VERIFIED: existing App.tsx and NavBar/index.tsx patterns]
// App.tsx -- add route:
<Route path="/models" element={<ModelsPage />} />

// NavBar/index.tsx -- add NavLink (same pattern as existing "Compare" and "Settings"):
<NavLink
  to="/models"
  className={({ isActive }) =>
    `rounded-lg px-3.5 py-1.5 text-[13px] font-medium ${
      isActive ? 'bg-webgpu-bg text-primary' : 'text-text-secondary hover:bg-bg'
    }`
  }
>
  Models
</NavLink>
```

### Anti-Patterns to Avoid
- **Hand-rolling cache deletion logic:** Use `ModelRegistry.clear_cache()` which handles both remote URL keys and local path keys, plus all associated files (config, tokenizer, processor). [VERIFIED: clear_cache.js source handles both `proposedCacheKey` and `localPath` fallback]
- **Reading blob size for every entry:** Use `Content-Length` header first; blob reading is expensive for large ONNX files. Only fall back to blob if header is missing.
- **Putting cache enumeration in a Web Worker:** Cache API is available on the main thread; the worker is reserved for model inference operations per CLAUDE.md ("Single worker: All model operations in one dedicated Web Worker").
- **Extending existing stores:** Don't add lastUsed tracking to `useSettingsStore` or `useCompareStore`; create a dedicated `useModelUsageStore` to maintain separation of concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache deletion per model+dtype | Manual `cache.delete()` for each URL | `ModelRegistry.clear_cache(modelId, { dtype })` | Handles all associated files (onnx, config, tokenizer, processor), handles both cache key formats [VERIFIED: clear_cache.js source] |
| Cache status checking per model | Manual URL matching against cache keys | `ModelRegistry.is_cached(modelId, { dtype })` | Proper early-exit optimization, handles edge cases [VERIFIED: is_cached.js source] |
| Quantization filename matching | New regex/matching logic | Reuse existing `matchQuantization()` pattern from `hfSearch.ts` | Already battle-tested in the codebase [VERIFIED: src/lib/hfSearch.ts lines 91-98] |
| Confirmation dialogs | Custom modal component | Simple `window.confirm()` or inline confirmation state | POC scope -- functional-first per CLAUDE.md |
| Size formatting | New formatting function | Existing `formatSize()` from `src/lib/formatSize.ts` | Already exists and handles B/KB/MB/GB [VERIFIED: src/lib/formatSize.ts] |

**Key insight:** Transformers.js v4's `ModelRegistry` provides clean APIs for per-model cache operations. The only gap is global cache enumeration (listing ALL cached models), which requires the raw Cache API. This hybrid approach (raw API for discovery + ModelRegistry for actions) gives the best of both worlds.

## Common Pitfalls

### Pitfall 1: Content-Length Header Not Always Present
**What goes wrong:** Cached responses may lack `Content-Length` if the server used chunked transfer encoding or if the response was synthesized.
**Why it happens:** Not all HuggingFace CDN responses include `Content-Length`; some use `Transfer-Encoding: chunked`.
**How to avoid:** Always check `Content-Length` first, fall back to `response.clone().blob().then(b => b.size)`. Clone the response to avoid consuming it (Cache API responses are one-shot). [VERIFIED: MDN Cache API docs -- responses are consumed on read]
**Warning signs:** Size shows as 0 or NaN for some models.

### Pitfall 2: Cache Enumeration Performance on Large Caches
**What goes wrong:** Calling `cache.keys()` then `cache.match()` for each key to read `Content-Length` can be slow with hundreds of entries.
**Why it happens:** Each `cache.match()` is an async I/O operation.
**How to avoid:** Enumerate once on page mount, cache results in component state. Show a loading spinner during enumeration. Avoid re-enumerating on every render. Consider batching: enumerate keys first (fast), then load sizes in parallel with `Promise.all()`.
**Warning signs:** Page feels sluggish when opening `/models` with many cached models.

### Pitfall 3: Stale Usage Data After Cache Deletion
**What goes wrong:** After deleting a model from cache, the `useModelUsageStore` still has `lastUsed` entries for it.
**Why it happens:** The cache and usage store are separate systems.
**How to avoid:** When deleting a model+quantization from cache, also call `removeUsage()` on the usage store. When deleting all quantizations of a model, clean up all usage entries for that model.
**Warning signs:** Deleted models still show up in "unused models" cleanup calculations.

### Pitfall 4: ModelSelector Component Coupling
**What goes wrong:** Trying to directly reuse `ModelSelector` as-is for the download feature fails because it's tightly coupled to `useCompareStore` (adds `TestConfig`s, manages comparison configs).
**Why it happens:** `ModelSelector` was designed for the comparison page, not general-purpose model search.
**How to avoid:** Extract the search/autocomplete logic into a reusable hook or lib function. For the Models page, reuse `searchModels()` and `fetchModelDetails()` from `hfSearch.ts` directly, and build a simpler download-only UI. The CONTEXT.md says "Reuse existing ModelSelector component" but the intent is to reuse the search capability, not necessarily the exact component. [VERIFIED: ModelSelector/index.tsx is deeply coupled to useCompareStore]
**Warning signs:** Downloading a model from the Models page adds a TestConfig to the comparison store.

### Pitfall 5: Race Condition Between Download and Enumeration
**What goes wrong:** User starts downloading a model, then the cache table doesn't reflect the newly cached model.
**Why it happens:** Cache enumeration happens on page mount; download completes after that.
**How to avoid:** After download completes, trigger a re-enumeration of the cache. Use a simple state counter or callback to invalidate and refresh the cache list.
**Warning signs:** User downloads a model but has to manually refresh the page to see it in the table.

### Pitfall 6: `ModelRegistry.clear_cache` Requires Network for Unknown Models
**What goes wrong:** `clear_cache()` internally calls `get_files()` which may try to fetch `config.json` from HuggingFace to determine which files to delete.
**Why it happens:** The ModelRegistry needs to know the full file list to delete all of them, and it discovers this by reading `config.json` (which may come from cache or network).
**How to avoid:** If config.json is cached (which it will be for cached models), this works offline. But as a fallback, keep the raw Cache API deletion approach available for edge cases where `ModelRegistry.clear_cache()` fails. [VERIFIED: is_cached.js checks config.json first as early-exit; clear_cache.js calls get_files then deletes]
**Warning signs:** Delete fails when offline for models where config.json was somehow evicted from cache.

## Code Examples

### Cache Enumeration (Full Implementation Pattern)
```typescript
// Source: [VERIFIED: transformers.js env.js cacheKey='transformers-cache', hub.js buildResourcePaths URL structure]

const CACHE_NAME = 'transformers-cache'
const HF_URL_PATTERN = /^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+)$/

export interface CacheEntry {
  modelId: string
  filepath: string
  url: string
  size: number
}

export async function enumerateCache(): Promise<CacheEntry[]> {
  try {
    const cache = await caches.open(CACHE_NAME)
    const requests = await cache.keys()
    
    const entries = await Promise.all(
      requests.map(async (req): Promise<CacheEntry | null> => {
        const match = req.url.match(HF_URL_PATTERN)
        if (!match) return null
        
        const [, modelId, filepath] = match
        const response = await cache.match(req)
        if (!response) return null
        
        const cl = response.headers.get('Content-Length')
        const size = cl ? parseInt(cl, 10) : (await response.clone().blob()).size
        
        return { modelId, filepath, url: req.url, size }
      })
    )
    
    return entries.filter((e): e is CacheEntry => e !== null)
  } catch {
    return []
  }
}
```

### Quantization Detection from Filepath
```typescript
// Source: [VERIFIED: existing hfSearch.ts lines 91-98 matchQuantization function]
// Reuse the same matching logic for consistency

function quantizationFromFilepath(filepath: string): string | null {
  const name = filepath.split('/').pop()?.toLowerCase() ?? ''
  if (name === 'model.onnx') return 'fp32'
  if (name.includes('fp16') || name.includes('float16')) return 'fp16'
  if (name.includes('q4') || name.includes('int4') || name.includes('bnb4')) return 'q4'
  if (name.includes('q8') || name.includes('int8') || name.includes('uint8') || name === 'model_quantized.onnx') return 'q8'
  return null  // non-ONNX files (config.json, tokenizer.json) don't have a quant
}
```

### Deletion with ModelRegistry
```typescript
// Source: [VERIFIED: node_modules ModelRegistry.js clear_cache method, clear_cache.js implementation]
import { ModelRegistry } from '@huggingface/transformers'

export async function deleteCachedModel(
  modelId: string,
  dtype?: string
): Promise<{ filesDeleted: number; filesCached: number }> {
  try {
    const result = await ModelRegistry.clear_cache(modelId, dtype ? { dtype } : {})
    return { filesDeleted: result.filesDeleted, filesCached: result.filesCached }
  } catch {
    // Fallback: raw cache API deletion
    return await rawCacheDelete(modelId, dtype)
  }
}

async function rawCacheDelete(modelId: string, dtype?: string): Promise<{ filesDeleted: number; filesCached: number }> {
  const cache = await caches.open(CACHE_NAME)
  const requests = await cache.keys()
  let deleted = 0
  let found = 0
  
  for (const req of requests) {
    if (req.url.includes(modelId.replace('/', '%2F')) || req.url.includes(modelId)) {
      if (dtype) {
        // Only delete entries matching this quantization
        const filepath = req.url.split('/resolve/main/').pop() ?? ''
        const fileQuant = quantizationFromFilepath(filepath)
        if (fileQuant && fileQuant !== dtype) continue
      }
      found++
      if (await cache.delete(req)) deleted++
    }
  }
  return { filesDeleted: deleted, filesCached: found }
}
```

### Usage Tracking Integration Point
```typescript
// Source: [VERIFIED: existing workerBridge.ts startComparison function, line 161]
// In workerBridge.ts, after starting a comparison run, update lastUsed for each local model:

import { useModelUsageStore } from '../stores/useModelUsageStore'

// Inside startComparison(), after iterating configs:
for (const config of configs) {
  if (config.backend !== 'api') {
    useModelUsageStore.getState().setLastUsed(config.modelId, config.quantization)
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Cache API enumeration + deletion | `ModelRegistry` API in transformers.js v4 | 2025 (v4.0.0 release) | Eliminates hand-rolled deletion logic; proper file discovery |
| `cacheCheck.ts` manual URL matching | `ModelRegistry.is_cached()` | v4.0.0 | More reliable cache checking; handles edge cases |
| No per-model cache management | Full `clear_cache` + `is_cached_files` API | v4.0.0 | Production-quality cache management |

**Deprecated/outdated:**
- The existing `src/lib/cacheCheck.ts` uses a hand-rolled approach that the new `ModelRegistry.is_cached()` supersedes. However, since it works and is simple, migrating it is not in scope for this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Content-Length` header is present on most HuggingFace CDN cached responses | Code Examples / Pitfall 1 | Would need blob-size fallback for all entries (slower); mitigation already described |
| A2 | `ModelRegistry.clear_cache()` works offline when config.json is cached | Pitfall 6 | Would need raw Cache API fallback; mitigation already described |
| A3 | Cache API `keys()` returns all entries in a single call without pagination | Architecture Patterns | If browser limits this, would need iterative approach; unlikely given MDN docs [CITED: developer.mozilla.org/en-US/docs/Web/API/Cache] |

## Open Questions

1. **Shared files between quantizations (tokenizer, config)**
   - What we know: Multiple quantizations of the same model share `config.json`, `tokenizer.json`, `tokenizer_config.json` files in cache. These are cached under the same URL regardless of dtype.
   - What's unclear: When deleting one quantization, `ModelRegistry.clear_cache()` with `include_tokenizer: true` (default) will also delete shared tokenizer files, which may affect other cached quantizations.
   - Recommendation: When deleting a single quantization, call `clear_cache(modelId, { dtype, include_tokenizer: false, include_processor: false })` to preserve shared files. Only delete shared files when removing the last quantization of a model. [VERIFIED: clear_cache.js accepts include_tokenizer and include_processor options]

2. **ModelSelector reuse strategy**
   - What we know: The existing `ModelSelector` is tightly coupled to `useCompareStore`. The CONTEXT.md says "Reuse existing ModelSelector component."
   - What's unclear: Whether "reuse" means literally embedding the component or extracting its search logic.
   - Recommendation: Reuse the search functions (`searchModels`, `fetchModelDetails` from `hfSearch.ts`) and build a simpler download-focused UI for the Models page. This avoids coupling the Models page to comparison state while reusing the actual search capability.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | N/A |
| Quick run command | `npx tsc --noEmit` (type checking only) |
| Full suite command | `npx tsc --noEmit && npx eslint src/` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| N/A | TypeScript compiles without errors | type-check | `npx tsc --noEmit` | N/A (built-in) |
| N/A | ESLint passes | lint | `npx eslint src/` | N/A (built-in) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit && npx eslint src/`
- **Phase gate:** Full type-check + lint green before `/gsd-verify-work`

### Wave 0 Gaps
None -- existing TypeScript + ESLint infrastructure covers all verifiable requirements. No test framework to set up (POC scope).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (no auth in this phase) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Validate model IDs from cache URL parsing; sanitize search queries via existing `searchModels()` |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for Browser Cache API

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cache poisoning via modified entries | Tampering | Cache API is origin-scoped and HTTPS-only; same-origin policy prevents cross-origin access [CITED: developer.mozilla.org/en-US/docs/Web/API/Cache] |
| Size probing via cache timing | Information Disclosure | Acceptable risk for POC; cache content is user's own models |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: node_modules source code] `@huggingface/transformers@4.0.1` -- `ModelRegistry.js`, `clear_cache.js`, `is_cached.js`, `cache.js`, `hub.js`, `env.js` -- all read directly from installed package
- [VERIFIED: codebase] `src/lib/cacheCheck.ts`, `src/lib/hfSearch.ts`, `src/stores/useSettingsStore.ts`, `src/stores/useCompareStore.ts`, `src/components/ModelSelector/index.tsx`, `src/components/NavBar/index.tsx`, `src/App.tsx`, `src/lib/workerBridge.ts`, `src/workers/inference.worker.ts`, `src/types/index.ts`

### Secondary (MEDIUM confidence)
- [CITED: developer.mozilla.org/en-US/docs/Web/API/Cache] Cache API specification -- methods, browser compatibility, secure context requirement
- [CITED: huggingface.co/blog/transformersjs-v4] Transformers.js v4 release blog -- ModelRegistry API overview
- [CITED: github.com/huggingface/transformers.js/releases/tag/4.0.0] Release notes for v4.0.0

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in node_modules source
- Architecture: HIGH -- Cache API patterns verified against MDN docs and transformers.js source code
- Pitfalls: HIGH -- derived from reading actual implementation source code (clear_cache.js, is_cached.js, hub.js)
- Cache URL patterns: HIGH -- verified from env.js (`remoteHost`, `remotePathTemplate`) and hub.js (`buildResourcePaths`)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable -- Cache API is a mature standard; transformers.js v4 is pinned)
