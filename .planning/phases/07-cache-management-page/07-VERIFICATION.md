---
phase: 07-cache-management-page
verified: 2026-04-13T16:00:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Navigate to /models page and verify NavBar link"
    expected: "Models link appears between Compare and Settings, clicking navigates to /models"
    why_human: "Visual layout and NavLink active-state styling cannot be verified programmatically"
  - test: "Verify cached models table with browser-cached models"
    expected: "Table shows cached models grouped by model ID, expandable to show per-quantization rows with size and last-used columns"
    why_human: "Requires browser with actual Cache API data (transformers-cache bucket). Cannot simulate Cache API in static analysis."
  - test: "Expand and collapse a model row"
    expected: "Clicking a model row expands child rows showing per-quantization details; chevron rotates 180 degrees; clicking again collapses"
    why_human: "Interactive UI behavior requiring browser rendering"
  - test: "Sort table by Size and Last Used columns"
    expected: "Clicking Size sorts descending, clicking again sorts ascending; Last Used behaves same; Model Name sorts ascending by default"
    why_human: "Sort state and visual indicator arrows require browser interaction"
  - test: "Delete a quantization with confirmation"
    expected: "Trash icon click shows window.confirm dialog; OK removes the quantization row and refreshes the table; Cancel does nothing"
    why_human: "Requires browser confirm dialog interaction and real Cache API deletion"
  - test: "Clean Up button for stale models"
    expected: "Button shows count of stale models, clicking shows confirm dialog with freed size estimate, OK deletes all stale entries and refreshes table"
    why_human: "Requires models with old lastUsed timestamps (or null) in the usage store"
  - test: "Search for ONNX models in ModelDownloader"
    expected: "Typing in the search box shows autocomplete dropdown with model ID, pipeline tag, ONNX badge, download count, and likes"
    why_human: "Requires live HuggingFace API call and browser rendering of dropdown"
  - test: "Select a model and download it"
    expected: "Selecting a model shows quantization pills with size estimates; clicking Download Model triggers download progress bar; after completion CachedModelsTable refreshes"
    why_human: "Requires network access, Web Worker communication, and real Cache API writes"
  - test: "Usage tracking updates on comparison run"
    expected: "After running a local model comparison on the Compare page, the /models page shows an updated Last Used timestamp for that model"
    why_human: "Requires browser runtime: running a comparison, navigating to /models, and verifying store state"
---

# Phase 7: Cache Management Page Verification Report

**Phase Goal:** New /models page for managing cached LLMs — expandable table of cached models grouped by quantization, size tracking via Cache API, last-used timestamps, quick cleanup (unused >2 weeks), search and download new models via existing ModelSelector
**Verified:** 2026-04-13T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cache entries can be enumerated from the transformers-cache bucket | VERIFIED | `enumerateCache()` in `src/lib/cacheManager.ts` opens `CACHE_NAME = 'transformers-cache'`, calls `cache.keys()`, parses HF CDN URLs via regex, uses `Promise.all` for parallel processing |
| 2 | Cache entries are grouped by modelId and quantization with correct sizes | VERIFIED | `groupByModelAndQuant()` groups by modelId, sub-groups by `quantizationFromFilepath()`, sums sizes including shared files |
| 3 | Model deletions use ModelRegistry.clear_cache with raw fallback | VERIFIED | `deleteCachedModel()` calls `ModelRegistry.clear_cache(modelId, { dtype, include_tokenizer: false, include_processor: false })` with try/catch falling back to raw `cache.delete()` |
| 4 | Usage timestamps are persisted across page reloads | VERIFIED | `useModelUsageStore` uses Zustand `persist` middleware with `name: 'model-usage-tracking'` (localStorage) |
| 5 | Usage timestamps update when a model is used in a comparison | VERIFIED | `workerBridge.startComparison` at line 172-176 iterates configs and calls `useModelUsageStore.getState().setLastUsed(config.modelId, config.quantization)` for all non-API backends |
| 6 | NavBar shows a Models link that navigates to /models | VERIFIED | `NavBar/index.tsx` contains `<NavLink to="/models">` with identical className pattern as Compare and Settings links |
| 7 | User sees a table of cached models with model name, total size, and last used columns | VERIFIED | `CachedModelsTable` renders `<table>` with Model Name, Size, Last Used, and Actions column headers |
| 8 | User can expand a model row to see per-quantization details | VERIFIED | `Set<string>` expanded state, `toggleExpand()`, `isExpanded` check renders child rows with `Fragment`, chevron SVG with `rotate-180` class |
| 9 | User can sort the table by model name, size, or last used | VERIFIED | `handleSort()` toggles direction; `sortedModels` sorts via `localeCompare`, numeric comparison, or null-as-Infinity; `ariaSortValue()` returns aria-sort attribute |
| 10 | User can delete a single quantization with confirmation | VERIFIED | `handleDeleteQuant()` calls `window.confirm()`, then `deleteCachedModel(modelId, quantization)` + `removeUsage()` + refreshCounter increment |
| 11 | User can delete all quantizations of a model with confirmation | VERIFIED | `handleDeleteModel()` calls `window.confirm()`, iterates quantizations calling `deleteCachedModel` per quant, then calls `deleteCachedModel(modelId)` for shared files |
| 12 | User can clean up all models unused for >2 weeks with confirmation | VERIFIED | `handleCleanup()` calls `getStaleModelKeys(models, STALE_THRESHOLD_MS)`, `window.confirm()` with count and freed size, deletes all stale entries |
| 13 | User can search HuggingFace for ONNX models and download to pre-cache | VERIFIED | `ModelDownloader` imports `searchModels`, `fetchModelDetails` from `hfSearch.ts` and `startDownload` from `workerBridge.ts`; progress tracked via `useCompareStore.downloadProgress`; completion triggers `onDownloadComplete` |

**Score:** 13/13 truths verified (automated checks)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/index.ts` | CachedModelInfo and CachedQuantInfo type exports | VERIFIED | `CacheEntry`, `CachedQuantInfo`, `CachedModelInfo` all present at lines 111-130 |
| `src/stores/useModelUsageStore.ts` | Persisted Zustand store for lastUsed timestamps | VERIFIED | 36 lines, exports `useModelUsageStore` with `setLastUsed`, `getLastUsed`, `removeUsage`, persisted under `model-usage-tracking` |
| `src/lib/cacheManager.ts` | Cache enumeration, grouping, deletion helpers | VERIFIED | 214 lines, exports 5 functions: `enumerateCache`, `quantizationFromFilepath`, `groupByModelAndQuant`, `deleteCachedModel`, `getStaleModelKeys` |
| `src/components/NavBar/index.tsx` | Models NavLink between Compare and Settings | VERIFIED | NavLink with `to="/models"` and text "Models" added between Compare and Settings NavLinks |
| `src/App.tsx` | /models route | VERIFIED | `<Route path="/models" element={<ModelsPage />} />` at line 17 |
| `src/components/CachedModelsTable/index.tsx` | Expandable table with sorting, deletion, cleanup | VERIFIED | 372 lines (min_lines: 100 satisfied), all behaviors implemented |
| `src/pages/ModelsPage.tsx` | Page rendering CachedModelsTable and ModelDownloader | VERIFIED | 17 lines, imports both components, renders with `refreshKey` mechanism |
| `src/components/ModelDownloader/index.tsx` | Search + download component | VERIFIED | 260 lines (min_lines: 80 satisfied), all required imports and behaviors present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/workerBridge.ts` | `src/stores/useModelUsageStore.ts` | `setLastUsed` call in `startComparison` | WIRED | Line 174: `useModelUsageStore.getState().setLastUsed(config.modelId, config.quantization)` inside loop over local configs |
| `src/lib/cacheManager.ts` | `transformers-cache` bucket | `caches.open` | WIRED | `const CACHE_NAME = 'transformers-cache'` at line 4; `caches.open(CACHE_NAME)` at lines 14 and 166 |
| `src/components/CachedModelsTable/index.tsx` | `src/lib/cacheManager.ts` | `enumerateCache`, `groupByModelAndQuant`, `deleteCachedModel`, `getStaleModelKeys` | WIRED | Line 2: named import of all 4 functions; all actively called in component body |
| `src/components/CachedModelsTable/index.tsx` | `src/stores/useModelUsageStore.ts` | `useModelUsageStore` for lastUsed and `removeUsage` on delete | WIRED | Lines 3, 58, 132, 155, 181: import and usage in loadCache, handleDeleteQuant, handleDeleteModel, handleCleanup |
| `src/pages/ModelsPage.tsx` | `src/components/CachedModelsTable/index.tsx` | import and render | WIRED | Line 2 import, line 12 `<CachedModelsTable key={refreshKey} onCacheChanged=... />` |
| `src/components/ModelDownloader/index.tsx` | `src/lib/hfSearch.ts` | `searchModels` and `fetchModelDetails` | WIRED | Lines 3-4: named imports of both functions; called in useEffect (line 52) and handleSelectModel (line 96) |
| `src/components/ModelDownloader/index.tsx` | `src/lib/workerBridge.ts` | `startDownload` | WIRED | Line 6: `import { startDownload } from '../../lib/workerBridge'`; called at line 119 |
| `src/pages/ModelsPage.tsx` | `src/components/ModelDownloader/index.tsx` | import and render | WIRED | Line 3 import, line 13 `<ModelDownloader onDownloadComplete=... />` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CachedModelsTable` | `models` state | `enumerateCache()` -> `groupByModelAndQuant()` in `useEffect([refreshCounter])` | Yes — reads from browser Cache API (`caches.open('transformers-cache').keys()`) | FLOWING |
| `CachedModelsTable` | `staleKeys` | `getStaleModelKeys(models, STALE_THRESHOLD_MS)` computed from real `models` state | Yes — derived from live cache data | FLOWING |
| `ModelDownloader` | `results` state | `searchModels(debouncedQuery)` in `useEffect([debouncedQuery])` | Yes — live fetch to `https://huggingface.co/api/models` | FLOWING |
| `ModelDownloader` | `modelDetails` state | `fetchModelDetails(model.modelId)` in `handleSelectModel` | Yes — live fetch to HuggingFace API with module-level cache | FLOWING |
| `ModelDownloader` | `downloadProgress` | `useCompareStore((s) => s.downloadProgress)` | Yes — written by `workerBridge.handleWorkerEvent` on `download-progress` events from worker | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for browser-only behaviors (Cache API, WebGPU Worker). TypeScript and Vite build serve as automated validation.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit` | Exit 0, no errors | PASS |
| Vite production build | `npx vite build` | Exit 0, 645 modules transformed | PASS |
| Commits documented in SUMMARY exist | `git cat-file -t <hash>` x6 | All 6 commits (866b2dc, 0804771, 1a14929, 372962d, 77732d8, 21ed6d3) exist | PASS |

### Requirements Coverage

Note: There is no separate `REQUIREMENTS.md` file for this phase. Requirements CM-01 through CM-11 are defined inline in `ROADMAP.md` and mapped across the three plans.

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| CM-01 | 07-01 | Routing — /models page accessible via NavBar | SATISFIED | `<Route path="/models">` in App.tsx; `<NavLink to="/models">` in NavBar |
| CM-02 | 07-02 | Expandable table — parent model rows, child quantization rows | SATISFIED | `CachedModelsTable` implements `expanded` Set state with `Fragment` parent/child row rendering |
| CM-03 | 07-02 | Sorting — by model name, size, or last used | SATISFIED | `handleSort()`, `sortedModels` computation, `sortIndicator()`, `ariaSortValue()` all implemented |
| CM-04 | 07-01, 07-02 | Size tracking — via Cache API Content-Length with blob fallback | SATISFIED | `enumerateCache()` reads `Content-Length` header, falls back to `blob().size`; displayed in table |
| CM-05 | 07-01 | lastUsed store — persisted Zustand store for usage timestamps | SATISFIED | `useModelUsageStore` with `persist` middleware, `setLastUsed`/`getLastUsed`/`removeUsage` |
| CM-06 | 07-01 | Usage tracking integration — workerBridge updates lastUsed on comparison | SATISFIED | `workerBridge.startComparison` calls `setLastUsed` for all local model configs |
| CM-07 | 07-02 | Delete quantization — delete individual cached quantization | SATISFIED | `handleDeleteQuant()` with `window.confirm()` and `deleteCachedModel(modelId, quant)` |
| CM-08 | 07-02 | Delete model — delete all cached files for a model | SATISFIED | `handleDeleteModel()` iterates quantizations, then calls `deleteCachedModel(modelId)` for shared files |
| CM-09 | 07-02 | Bulk cleanup — remove all models unused for >2 weeks | SATISFIED | `handleCleanup()` with `getStaleModelKeys(models, STALE_THRESHOLD_MS)` and bulk deletion |
| CM-10 | 07-03 | Search + download — HuggingFace search and pre-cache download | SATISFIED | `ModelDownloader` implements debounced search, quantization selection, `startDownload()` with progress bar |
| CM-11 | 07-02 | Confirmation dialogs — all delete/cleanup operations require confirmation | SATISFIED | All three delete handlers (`handleDeleteQuant`, `handleDeleteModel`, `handleCleanup`) call `window.confirm()` before executing |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/ModelDownloader/index.tsx` | 52 | `searchModels().then()` without `.catch()` — loading state stuck if network error bypasses internal guard | Warning | Search input freezes at "Searching..." on network failure (no user-visible error) |
| `src/components/ModelDownloader/index.tsx` | 87-104 | `handleSelectModel` async without try/catch — unhandled rejection if `fetchModelDetails` throws a TypeError | Warning | Component left in inconsistent state (selectedModel set, modelDetails null, no error shown) |
| `src/components/CachedModelsTable/index.tsx` | 125-188 | Delete handlers use `try/finally` without `catch` — errors silently swallowed | Warning | User sees no feedback if Cache API deletion fails; table may show stale data as if it was deleted |
| `src/pages/ModelsPage.tsx` | 12 | `key={refreshKey}` forces full unmount/remount of `CachedModelsTable` — destroys expanded rows and sort preferences | Info | UX regression: user's expanded rows collapse and sort resets on every cache change |

All four were identified and documented in the code review report (`07-REVIEW.md`). None prevent the phase goal from being achieved — they are quality concerns within POC scope.

### Human Verification Required

These behaviors require a running browser session with the Vite dev server.

#### 1. NavBar and Routing

**Test:** Open `http://localhost:5173`, check the nav bar, click "Models"
**Expected:** "Models" link appears between "Compare" and "Settings"; clicking navigates to `/models`; the active link gets the `bg-webgpu-bg text-primary` styling
**Why human:** Visual NavLink styling and routing behavior require browser

#### 2. Cached Models Table Display

**Test:** Open `/models` page with browser that has previously cached models via a comparison run
**Expected:** Table shows model IDs, total sizes, and last-used times; loading spinner shows briefly; empty state shown if no cached models
**Why human:** Requires real browser Cache API data from `transformers-cache` bucket

#### 3. Expand/Collapse Table Rows

**Test:** Click on a model row in the table
**Expected:** Row expands to show child rows for each quantization; chevron rotates 180 degrees; clicking again collapses; clicking the trash icon on a parent row does NOT trigger expand/collapse
**Why human:** Interactive UI behavior

#### 4. Sort Table Columns

**Test:** Click "Size" header, click again; click "Last Used" header; click "Model Name" header
**Expected:** Sort arrows (↑/↓) appear on active column; order changes correctly; Size and Last Used default descending, Model Name defaults ascending; null lastUsed values sort to end
**Why human:** Requires browser with multiple cached models to verify sort order visually

#### 5. Delete Quantization

**Test:** Expand a model row, click trash icon on a child row
**Expected:** `window.confirm` dialog appears with correct model name and quantization; clicking OK removes the row and re-enumerates cache; clicking Cancel does nothing
**Why human:** Requires real `window.confirm` dialog and Cache API deletion

#### 6. Bulk Cleanup

**Test:** If stale models exist (or manipulate `model-usage-tracking` in localStorage to set old timestamps), click "Clean Up (N unused)" button
**Expected:** Confirm dialog shows correct count and freed size estimate; confirming deletes all stale entries and refreshes table
**Why human:** Requires browser localStorage manipulation and real Cache API state

#### 7. Model Search in ModelDownloader

**Test:** Type "SmolLM" in the "Download Models" search box
**Expected:** Autocomplete dropdown appears after ~300ms debounce; shows model IDs with ONNX badge, pipeline tag, download count, likes count
**Why human:** Requires live HuggingFace API call

#### 8. Download a Model

**Test:** Select a model from search results, select a quantization pill, click "Download Model"
**Expected:** Button changes to "Downloading..."; progress bar appears with percentage; after completion, CachedModelsTable refreshes to show the newly cached model
**Why human:** Requires network access, Web Worker, and real Cache API writes

#### 9. Usage Tracking on Comparison Run

**Test:** Go to Compare page, run a comparison with a local model; return to /models
**Expected:** The "Last Used" column for the model shows a recent timestamp (e.g., "just now" or "X minutes ago")
**Why human:** End-to-end flow requiring actual model execution and store state verification

### Gaps Summary

No automated gaps found. All 13 observable truths verified against actual code. All artifacts exist at expected paths, contain substantive implementations, are wired to their data sources, and data flows from real sources (browser Cache API, HuggingFace API, Web Worker). 

The 4 warning-level code quality issues from the code review (`WR-01` through `WR-04`) are documented in `07-REVIEW.md` and represent error-handling gaps within POC scope — they do not block the phase goal.

9 human verification items remain for browser-only behaviors that cannot be validated statically: visual rendering, Cache API reads/writes, live API calls, and Web Worker communication.

---

_Verified: 2026-04-13T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
