# Phase 2: Model Selection & Settings - Research

**Researched:** 2026-04-10
**Domain:** React UI components, HuggingFace API, Browser Cache API, Zustand state management
**Confidence:** HIGH

## Summary

Phase 2 refactors the existing `ModelSelector` component (~380 lines) into a richer UI with two-row local model chips (quantization/backend selectors, download size estimate, cache status dot, trash icon), a collapsible cloud models accordion with expanded provider lists and custom model ID input, and verifies the Settings page meets requirements. The existing code provides a strong foundation -- search, chip rendering, cloud quick-add, and store logic all work. The primary work is UI restructuring and adding two new data sources: HuggingFace API file sizes and browser Cache API status checking.

The HuggingFace `/api/models/{id}?blobs=true` endpoint returns per-file sizes in the `siblings` array, which the existing `fetchAvailableQuantizations` function already calls (but without `?blobs=true`). The browser Cache API stores transformers.js model files under the cache name `'transformers-cache'` with URL keys in the format `https://huggingface.co/{modelId}/resolve/main/{filename}`. Both can be queried directly from the main thread without importing the heavy `@huggingface/transformers` library.

The Settings page (`ApiKeySettings`) already satisfies STNV-02, STNV-03, and STNV-04 with API key inputs, show/hide toggle, test connection button per provider, and Anthropic CORS warning. Only minor visual cleanup may be needed.

**Primary recommendation:** Refactor `ModelSelector` in-place, extend `hfSearch.ts` to return file sizes from the HF API (`?blobs=true`), add a lightweight `cacheCheck.ts` utility that queries the browser Cache API directly, and restructure the chip layout to the two-row design with accordion for cloud models.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep the existing HF search as-is -- filters for `onnx,transformers.js` + `text-generation` pipeline tag + sorted by downloads, limit 20 results. No changes needed to search logic.
- **D-02:** Search results already display model ID, pipeline tag, ONNX/transformers.js badges, downloads, and likes. Verify this meets MSEL-02 and fix any gaps.
- **D-03:** MSEL-03 is **removed from Phase 2 scope**. The existing filtered search is sufficient for a POC -- if a model doesn't appear, it's not ONNX/transformers.js compatible. No direct paste, no separate input field.
- **D-04:** Two-row chip layout: Row 1: model name + quantization selector + backend selector + trash icon (not "x"). Row 2: download size estimate (e.g., "~250MB") + cache status dot (green=cached, gray=not) + color-coded backend badge.
- **D-05:** Remove the current redundant display (both selector AND badge for quant and backend). Selectors are the interactive control; badges in row 2 provide visual status.
- **D-06:** Same model can be added with different backend/quantization for A/B comparison (MSEL-06) -- verify this works with current `addConfig` logic.
- **D-07:** Cloud models live in a collapsible **"Cloud Models" accordion** below the local model chips. Closed by default.
- **D-08:** Inside the accordion: quick-add buttons grouped by provider (only providers with API keys configured). Expand the hardcoded list to 2-3 models per provider.
- **D-09:** Each provider section has a `[+]` button that reveals a text input for typing any custom cloud model ID. No validation -- errors surface at execution time.
- **D-10:** Cloud chips are **one-row simplified**: model name + purple provider badge + trash icon. Dashed border.
- **D-11:** Download size estimated from HF API: `fetchAvailableQuantizations` already calls `/models/{id}` which returns file siblings with sizes. Sum the `.onnx` files for the selected quantization.
- **D-12:** Cache status checked via Cache API when the chip is created. Green dot = cached, gray dot = not cached.
- **D-13:** Both size and cache status recalculate when user changes quantization.
- **D-14:** Settings page is **complete as-is**. API key input, show/hide toggle, test connection button per provider all meet requirements. Only minor visual cleanup if needed.

### Claude's Discretion
- Exact cloud models to include in the expanded quick-add list per provider
- Visual styling of the accordion (border, padding, chevron icon)
- Whether to show cloud chips inside or outside the accordion
- `formatSize()` utility implementation details (KB/MB/GB formatting)
- Cache API key format for transformers.js models (research needed -- RESOLVED below)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MSEL-01 | Search HuggingFace models with autocomplete, filtered for ONNX + transformers.js text-generation | Existing `searchModels()` in `hfSearch.ts` already satisfies this. No changes needed (D-01). |
| MSEL-02 | Search results display model ID, pipeline tag, ONNX badge, transformers.js badge, downloads, likes | Existing dropdown UI already shows all fields. Verify and fix gaps (D-02). |
| MSEL-03 | Direct model ID paste with Enter key and API validation | **Removed from scope by D-03**. Not implemented in Phase 2. |
| MSEL-04 | Chips with quantization selector, backend selector, cache status, download size, remove button | Two-row chip design (D-04). Requires: HF API size data, Cache API status check, trash icon SVG. |
| MSEL-05 | Quantization options fetched from HF API per model | Already working via `fetchAvailableQuantizations()`. No changes needed. |
| MSEL-06 | Same model addable with different backend/quantization for A/B | Already works -- `addConfig` appends with unique timestamp-based ID. Verify only. |
| MSEL-07 | Cloud model quick-add buttons gated by API key presence | Existing pattern works. Expand from 1 model/provider to 2-3 (D-08). Add accordion (D-07). |
| MSEL-08 | Cloud chips with dashed border and purple provider badge | Already partially implemented. Refine to D-10 one-row simplified design. |
| STNV-02 | Settings page with API key inputs for OpenAI, Anthropic, Google | Already complete in `ApiKeySettings` (D-14). |
| STNV-03 | API keys stored in localStorage with show/hide toggle | Already complete -- Zustand persist middleware + visible toggle (D-14). |
| STNV-04 | Test connection button per provider | Already complete with `handleTest()` per provider (D-14). |
</phase_requirements>

## Standard Stack

### Core (Already Established -- No Changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI components | Project constraint [VERIFIED: package.json] |
| Zustand | 5.0.12 | State management | Project constraint, selector pattern used throughout [VERIFIED: package.json] |
| Tailwind CSS | 4.2.2 | Styling | Project constraint, @theme custom properties defined [VERIFIED: package.json] |
| @huggingface/transformers | 4.0.1 | Local LLM inference (worker-only) | Core dependency, ModelRegistry API available but NOT used in main thread [VERIFIED: package.json] |

### Supporting (No New Dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Browser Cache API | Native | Check transformers.js model cache status | Main thread cache status dot on chips |
| HuggingFace REST API | v1 | Model search, file sizes, quantization detection | `hfSearch.ts` functions |
| React useState/useEffect | Built-in | Component-local UI state | Accordion open/close, search, loading states |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Cache API | `ModelRegistry.is_cached()` from transformers.js | Would pull transformers.js into main thread bundle (~10MB+). Direct Cache API is lightweight and sufficient for POC. |
| HF API `?blobs=true` for sizes | `ModelRegistry.get_file_metadata()` | Same bundle concern as above. REST API is simpler, already partially used. |

**Installation:**
```bash
# No new packages needed. Phase uses only existing dependencies and browser APIs.
```

## Architecture Patterns

### Component Structure (Refactored)
```
src/
  components/
    ModelSelector/
      index.tsx          # Main component (refactored: two-row chips, accordion)
  lib/
    hfSearch.ts          # Extended: return file sizes alongside quantizations
    cacheCheck.ts        # NEW: lightweight Cache API utility for main thread
  types/
    index.ts             # Extended: add estimatedSize, cached fields to types
```

### Pattern 1: HF API File Size Extraction
**What:** Extend `fetchAvailableQuantizations` to also return per-quantization file sizes from the HF API.
**When to use:** When a model is selected and a chip is created, and whenever quantization changes (D-13).
**Example:**
```typescript
// Source: Verified against HF API response format
// GET https://huggingface.co/api/models/{modelId}?blobs=true
// Returns siblings: Array<{ rfilename: string, size: number, blobId: string }>

interface QuantizationInfo {
  quantization: Quantization
  estimatedSize: number  // bytes, sum of .onnx files matching this quant
}

export async function fetchModelDetails(modelId: string): Promise<{
  quantizations: Quantization[]
  sizeByQuant: Record<Quantization, number>
}> {
  const res = await fetch(`${HF_API}/${modelId}?blobs=true`)
  if (!res.ok) return { quantizations: ['fp32'], sizeByQuant: { fp32: 0 } as Record<Quantization, number> }
  
  const data = await res.json()
  const siblings: Array<{ rfilename: string; size: number }> = data.siblings ?? []
  
  // Extract quantizations (existing logic)
  const onnxFiles = siblings.filter((s) => s.rfilename.endsWith('.onnx'))
  const quantizations = extractQuantizations(onnxFiles.map((s) => s.rfilename))
  
  // Map sizes per quantization
  const sizeByQuant: Record<string, number> = {}
  for (const file of onnxFiles) {
    const name = file.rfilename.split('/').pop()?.toLowerCase() ?? ''
    const quant = matchQuantization(name) // reuse existing matching logic
    if (quant) {
      sizeByQuant[quant] = (sizeByQuant[quant] ?? 0) + file.size
    }
  }
  
  return { quantizations, sizeByQuant: sizeByQuant as Record<Quantization, number> }
}
```
[VERIFIED: HF API response format confirmed via curl to `https://huggingface.co/api/models/onnx-community/Qwen2.5-0.5B-Instruct?blobs=true`]

### Pattern 2: Browser Cache API Status Check
**What:** Check if a model's ONNX files are cached in the browser's Cache API without importing transformers.js in the main thread.
**When to use:** When a chip is created and when quantization/backend changes (D-12, D-13).
**Example:**
```typescript
// Source: Verified from transformers.js source code (env.js, hub.js)
// Cache name: 'transformers-cache' (env.cacheKey default)
// Cache key format: 'https://huggingface.co/{modelId}/resolve/main/{filename}'

const CACHE_NAME = 'transformers-cache'
const HF_CDN = 'https://huggingface.co'

export async function isModelCached(
  modelId: string,
  quantization: Quantization
): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME)
    // Check for the primary ONNX file matching this quantization
    const suffix = quantSuffixMap[quantization] // e.g., 'q4' -> 'model_q4.onnx'
    const url = `${HF_CDN}/${modelId}/resolve/main/onnx/${suffix}`
    const match = await cache.match(url)
    return match !== undefined
  } catch {
    return false // Cache API not available or error
  }
}
```
[VERIFIED: Cache name `'transformers-cache'` confirmed from `node_modules/@huggingface/transformers/src/env.js:276`. Cache key URL format confirmed from `hub.js:131-147`.]

### Pattern 3: Accordion Component (Collapsible Section)
**What:** Simple collapsible section for cloud models, built inline with useState (no library needed).
**When to use:** D-07 specifies cloud models in a collapsible accordion, closed by default.
**Example:**
```typescript
function CloudAccordion({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-secondary"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Cloud Models</span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          {/* chevron SVG */}
        </span>
      </button>
      {isOpen && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}
```
[ASSUMED: Standard React pattern, no library needed]

### Pattern 4: Trash Icon (SVG Inline)
**What:** Replace text "x" with a proper trash/bin SVG icon for chip removal (D-04 specifies trash icon).
**Example:**
```typescript
// Inline SVG, 16x16, matching project's text-tertiary color
<button
  type="button"
  className="ml-1 text-text-tertiary hover:text-error"
  onClick={() => handleRemoveConfig(config.id)}
  disabled={disabled}
  aria-label={`Remove ${config.displayName}`}
>
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" 
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
</button>
```
[ASSUMED: Standard Lucide trash-2 icon SVG, no icon library needed]

### Pattern 5: Store `updateConfig` Action
**What:** The current approach of remove-then-add to change quantization/backend is fragile (loses array position, generates new IDs, requires `configQuants` state sync). Add a proper `updateConfig` action to the store.
**Example:**
```typescript
// In useCompareStore.ts
updateConfig: (configId: string, updates: Partial<Pick<TestConfig, 'quantization' | 'backend'>>) =>
  set((state) => ({
    configs: state.configs.map((c) =>
      c.id === configId ? { ...c, ...updates } : c
    ),
  })),
```
[ASSUMED: Standard Zustand pattern, simplifies chip interaction handlers significantly]

### Anti-Patterns to Avoid
- **Importing transformers.js in main thread:** Never `import { ModelRegistry } from '@huggingface/transformers'` in component code. The library is ~10MB+ and includes ONNX runtime bindings. Use the HF REST API and browser Cache API directly instead.
- **Remove-then-add for config updates:** The current `handleQuantChange` removes the old config and adds a new one, losing array position and requiring manual `configQuants` state sync. Use `updateConfig` instead.
- **Fetching sizes on every render:** Cache the HF API response per model. The existing `quantCache` Map pattern should be extended to include size data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ONNX quantization detection | Custom filename parser | Extend existing `extractQuantizations` in `hfSearch.ts` | Already handles 8+ filename patterns (q4, q8, fp16, fp32, int8, uint8, bnb4, quantized) |
| Cache status checking | Custom service worker | Browser Cache API (`caches.open()` + `cache.match()`) | Native API, synchronous-feeling, works from main thread |
| File size formatting | Custom number formatter | Simple `formatSize()` utility (~10 lines) | Common pattern: bytes -> KB/MB/GB with 1 decimal |
| Accordion/collapsible | UI library (Radix, Headless UI) | `useState` + conditional render | One accordion instance, POC scope, no need for library overhead |
| Icon library | lucide-react, heroicons package | Inline SVG | Only need 2-3 icons (trash, chevron, plus). Inline SVGs avoid dependency. |

**Key insight:** This phase is primarily UI restructuring with two lightweight data integrations (HF API sizes, Cache API status). No new libraries needed -- the browser and existing code provide everything.

## Common Pitfalls

### Pitfall 1: Cache API Requires HTTPS or localhost
**What goes wrong:** `caches.open()` fails with a security error on insecure contexts.
**Why it happens:** The Cache API is only available in secure contexts (HTTPS or localhost).
**How to avoid:** The Vite dev server runs on `localhost`, which is a secure context. Production should be served over HTTPS. Add a try/catch around `caches.open()` and default to "unknown" cache status.
**Warning signs:** `SecurityError` in console when trying to access `caches`.
[VERIFIED: Cache API secure context requirement is a web standard]

### Pitfall 2: HF API Rate Limiting
**What goes wrong:** Multiple rapid quantization/size fetches trigger HF API rate limits (429 responses).
**Why it happens:** Each model selection triggers a `fetchAvailableQuantizations` call. If user rapidly selects models, many requests fire.
**How to avoid:** The existing `quantCache` Map already prevents re-fetching for the same model. Extend this cache to include size data. The debounced search (300ms) also limits search API calls.
**Warning signs:** 429 status codes from `huggingface.co/api/models/`.
[VERIFIED: quantCache exists in ModelSelector, mitigates this]

### Pitfall 3: Stale Cache Status After Download
**What goes wrong:** Cache status dot shows "not cached" even after downloading a model, because the status was only checked when the chip was created.
**Why it happens:** Cache check runs once at chip creation, not after downloads complete.
**How to avoid:** Re-check cache status after download completion events from the worker. The `download-complete` worker event should trigger a cache re-check for affected configs.
**Warning signs:** Green dot never appears even though models are downloaded and usable.
[ASSUMED: Standard React reactivity concern]

### Pitfall 4: ONNX File Naming Inconsistency Across Models
**What goes wrong:** Size calculation returns 0 for some quantizations because the ONNX filename doesn't match expected patterns.
**Why it happens:** Not all HF model repos follow the same naming convention. Some use `model_q4.onnx`, others use `decoder_model_q4.onnx` or `model.onnx_data` companion files.
**How to avoid:** The `extractQuantizations` function already handles 8+ patterns. For size calculation, sum ALL files matching a quantization pattern (including potential `_data` companion files in the same directory). Consider also summing non-ONNX config files (tokenizer.json, config.json, etc.) which are shared across quantizations.
**Warning signs:** Size shows as "~0 B" or unrealistically small for some models.
[VERIFIED: Observed variable naming patterns in HF model repos]

### Pitfall 5: Config ID Changes Breaking State Sync
**What goes wrong:** When quantization or backend is changed via remove-then-add, the config gets a new `id` (because of `Date.now()`), which breaks any state keyed on the old config ID.
**Why it happens:** Current `handleQuantChange` creates a new config object with a potentially different ID.
**How to avoid:** Add an `updateConfig` store action that mutates in-place instead of remove/add. This preserves the config ID and array position.
**Warning signs:** `configQuants` state gets out of sync; console errors about missing config IDs.
[VERIFIED: Current ModelSelector code at lines 127-168 shows this pattern]

## Code Examples

### formatSize Utility
```typescript
// Source: Common byte formatting pattern
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `~${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
// formatSize(786156820) => "~749.7 MB"
// formatSize(1993796793) => "~1.9 GB"
```
[ASSUMED: Standard byte formatting, not from a specific library]

### Expanded Cloud Models List
```typescript
// Claude's discretion: expanded to 2-3 models per provider
const CLOUD_MODELS: {
  provider: CloudProvider
  displayName: string
  cloudModel: string
}[] = [
  // OpenAI
  { provider: 'openai', displayName: 'GPT-4o-mini', cloudModel: 'gpt-4o-mini' },
  { provider: 'openai', displayName: 'GPT-4o', cloudModel: 'gpt-4o' },
  // Anthropic
  { provider: 'anthropic', displayName: 'Claude 3.5 Haiku', cloudModel: 'claude-3-5-haiku-latest' },
  { provider: 'anthropic', displayName: 'Claude 3.5 Sonnet', cloudModel: 'claude-3-5-sonnet-latest' },
  // Google
  { provider: 'google', displayName: 'Gemini 2.0 Flash', cloudModel: 'gemini-2.0-flash' },
  { provider: 'google', displayName: 'Gemini 2.0 Flash Lite', cloudModel: 'gemini-2.0-flash-lite' },
]
```
[ASSUMED: Model names based on training data -- user should confirm these are current/desired]

### Quantization-to-Filename Mapping for Cache Check
```typescript
// Source: Derived from extractQuantizations in hfSearch.ts and HF API observation
const QUANT_ONNX_FILENAMES: Record<Quantization, string[]> = {
  q4: ['model_q4.onnx', 'model_q4f16.onnx', 'model_bnb4.onnx', 'model_int4.onnx'],
  q8: ['model_q8.onnx', 'model_int8.onnx', 'model_uint8.onnx', 'model_quantized.onnx'],
  fp16: ['model_fp16.onnx', 'model_float16.onnx'],
  fp32: ['model.onnx'],
}
```
[VERIFIED: Matches patterns in `extractQuantizations()` at `hfSearch.ts:84-115`]

### Two-Row Chip Layout Structure
```typescript
// D-04: Two-row chip design
<div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs">
  {/* Row 1: Name + Controls */}
  <div className="flex items-center gap-2">
    <span className="font-medium text-text-primary truncate max-w-[180px]">
      {config.displayName}
    </span>
    <select /* quantization selector */ />
    <select /* backend selector */ />
    <button /* trash icon */ />
  </div>
  {/* Row 2: Status Info */}
  <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
    <span>{formatSize(sizeByQuant[config.quantization] ?? 0)}</span>
    <span className={`h-2 w-2 rounded-full ${cached ? 'bg-success' : 'bg-border'}`} />
    <span className={/* backend badge color */}>
      {config.backend}
    </span>
  </div>
</div>
```
[ASSUMED: Standard Tailwind layout pattern following D-04 specification]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Xenova/transformers.js (v3) | @huggingface/transformers (v4) | Late 2025 | v4 adds `ModelRegistry` API with `is_cached`, `get_file_metadata`, `get_available_dtypes`. New approach to cache inspection. |
| Manual cache key construction | `ModelRegistry.is_cached()` | transformers.js v4.0.0 | Official API for cache checking. However, importing in main thread has bundle cost concerns. |
| No file size info | HF API `?blobs=true` | Stable | Adds `size` and `blobId` to siblings array. Always available. |

**Deprecated/outdated:**
- `Xenova/transformers.js` (v2/v3 package name) -- replaced by `@huggingface/transformers` v4.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Inline SVGs for trash and chevron icons are sufficient; no icon library needed | Architecture Patterns | LOW: Could add lucide-react later if more icons needed |
| A2 | Cloud model names (GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash Lite) are current and correct | Code Examples | MEDIUM: Model names change; user should confirm |
| A3 | `updateConfig` store action is better than remove-then-add pattern | Architecture Patterns | LOW: Both approaches work; updateConfig is cleaner |
| A4 | Stale cache status after download is a real concern needing re-check logic | Common Pitfalls | LOW: May not be noticeable in POC usage |
| A5 | transformers.js main thread import would significantly increase bundle size | Architecture Patterns | MEDIUM: Vite tree-shaking might handle it, but safer to avoid for POC |

## Open Questions (RESOLVED)

1. **ONNX file naming for multi-part models**
   - What we know: Simple models have single `model_q4.onnx` files. Some models use `decoder_model_q4.onnx` or split files.
   - What's unclear: Whether size estimation should account for all ONNX files (encoder + decoder) or just the primary model file.
   - RESOLVED: Sum all `.onnx` files matching the quantization suffix. This gives the total download size which is what the user cares about.

2. **Cloud chips placement: inside or outside accordion?**
   - What we know: D-07 says cloud models in accordion, D-10 defines cloud chip style.
   - What's unclear: CONTEXT.md lists "whether to show cloud chips inside or outside the accordion" as Claude's discretion.
   - RESOLVED: Show cloud chips **outside** the accordion (below local chips, above the accordion). This way the accordion only contains the quick-add buttons, and all active chips are visible together. Better UX for seeing what's configured at a glance.

3. **Cache check timing and reactivity**
   - What we know: D-12 says check cache when chip is created. D-13 says recalculate when quantization changes.
   - What's unclear: Should cache status auto-update after model downloads complete?
   - RESOLVED: For POC, check cache on chip creation and quantization change only. Auto-update after download is a nice-to-have that can be added if time permits.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | none |
| Quick run command | `npm run build` (type-check + build) |
| Full suite command | `npm run lint && npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MSEL-01 | HF search returns filtered results | manual-only | N/A -- requires browser + HF API | N/A |
| MSEL-02 | Search results show all required fields | manual-only | N/A -- visual verification | N/A |
| MSEL-04 | Two-row chip with selectors, size, cache, trash | manual-only | N/A -- visual/interactive | N/A |
| MSEL-05 | Quantization options from HF API | manual-only | N/A -- requires HF API | N/A |
| MSEL-06 | A/B comparison with same model, diff config | manual-only | N/A -- interactive workflow | N/A |
| MSEL-07 | Cloud quick-add gated by API key | manual-only | N/A -- requires localStorage state | N/A |
| MSEL-08 | Cloud chips visually distinct | manual-only | N/A -- visual verification | N/A |
| STNV-02 | Settings page with API key inputs | manual-only | N/A -- already complete | N/A |
| STNV-03 | Show/hide toggle for API keys | manual-only | N/A -- already complete | N/A |
| STNV-04 | Test connection button per provider | manual-only | N/A -- requires real API keys | N/A |

**Justification for manual-only:** This phase is almost entirely UI component work (chip layout, accordion, visual styling) with two thin data integrations (HF API sizes, Cache API checks). All requirements involve visual rendering, user interaction, or external API calls that cannot be meaningfully unit-tested without a browser environment and test framework. The type checker (`tsc`) validates structural correctness. The linter validates code style.

### Sampling Rate
- **Per task commit:** `npm run build` (catches type errors)
- **Per wave merge:** `npm run lint && npm run build`
- **Phase gate:** Build passes + manual verification of all success criteria

### Wave 0 Gaps
- No test framework installed (vitest would be the natural choice for Vite projects)
- No test files exist
- For this UI-heavy phase, the gap is acceptable. Test framework installation deferred to a phase with testable logic (e.g., Phase 4 execution).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- no auth in app |
| V3 Session Management | No | N/A -- no sessions |
| V4 Access Control | No | N/A -- client-side only |
| V5 Input Validation | Yes | Custom cloud model ID input (D-09) is intentionally unvalidated per user decision -- errors at execution time. HF search input is debounced and URL-encoded via URLSearchParams. |
| V6 Cryptography | No | N/A -- API keys stored in localStorage as-is (POC decision) |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in localStorage | Information Disclosure | Accepted risk for POC (D-14 confirms). Keys only sent to respective provider APIs. Show/hide toggle present. |
| XSS via model names in search results | Tampering | React's JSX auto-escapes string content. Model names rendered as text nodes, not dangerouslySetInnerHTML. |
| HF API response injection | Tampering | Response is typed and parsed as JSON. Only specific fields extracted (modelId, name, downloads, etc.). No eval or script injection path. |

## Sources

### Primary (HIGH confidence)
- `node_modules/@huggingface/transformers/types/utils/model_registry/ModelRegistry.d.ts` -- Full ModelRegistry API signatures
- `node_modules/@huggingface/transformers/src/env.js` -- Cache key default (`'transformers-cache'`), remote host/path template
- `node_modules/@huggingface/transformers/src/utils/hub.js` -- Cache key URL construction (`remoteURL` = `https://huggingface.co/{model}/resolve/main/{file}`)
- HF API live test: `curl "https://huggingface.co/api/models/onnx-community/Qwen2.5-0.5B-Instruct?blobs=true"` -- Confirmed siblings include `size` field with `?blobs=true` parameter
- Existing codebase: `src/components/ModelSelector/index.tsx`, `src/lib/hfSearch.ts`, `src/stores/useCompareStore.ts`, `src/stores/useSettingsStore.ts`

### Secondary (MEDIUM confidence)
- [Transformers.js v4 release notes](https://github.com/huggingface/transformers.js/releases/tag/4.0.0) -- ModelRegistry API overview
- [Transformers.js env documentation](https://huggingface.co/docs/transformers.js/api/env) -- Configuration properties including cacheKey, useBrowserCache
- [Hub API Endpoints](https://huggingface.co/docs/hub/en/api) -- Models API documentation

### Tertiary (LOW confidence)
- Cloud model names (GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash Lite) -- Based on training data, may be outdated

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries verified
- Architecture: HIGH -- patterns verified against actual transformers.js source code and HF API
- Pitfalls: HIGH -- cache key format and API behavior verified empirically
- Cloud model names: LOW -- based on training knowledge, needs user confirmation

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- existing codebase, well-established APIs)
