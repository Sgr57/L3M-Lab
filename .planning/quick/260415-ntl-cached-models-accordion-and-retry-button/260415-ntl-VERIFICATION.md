---
phase: 260415-ntl
verified: 2026-04-15T00:00:00Z
status: human_needed
score: 7/7
overrides_applied: 0
human_verification:
  - test: "Open ModelSelector, click 'Cached Models' accordion toggle — accordion expands and shows table (or empty state)"
    expected: "Accordion is closed by default; opens on click; shows one row per model+quant with name, quant badge, size, and relative last-used time (or empty-state message)"
    why_human: "Requires a browser with the Cache API populated; cannot be verified by static analysis"
  - test: "Click a cached model row — config chip appears with correct backend (webgpu or wasm)"
    expected: "New chip appears in ModelSelector with cached:true; backend matches webgpuSupported flag"
    why_human: "Requires runtime DOM interaction and WebGPU/WASM capability detection"
  - test: "Click the same cached model row a second time — no duplicate chip added"
    expected: "Row becomes dimmed/opacity-40, second click is no-op"
    why_human: "Requires DOM interaction to confirm duplicate prevention UX"
  - test: "Trigger a download failure (invalid model ID) — after download-complete, error row remains visible in PreDownload"
    expected: "PreDownload progress list stays open with the error row; 'Retry' button is visible next to the error"
    why_human: "Requires an actual (failing) network download to exercise the error path"
  - test: "Click 'Retry' on a failed row — only that model is re-downloaded"
    expected: "That model's row resets to waiting/downloading; other rows are unaffected"
    why_human: "Requires triggering a real download error first"
  - test: "Click 'Dismiss' after a download error — progress list clears"
    expected: "PreDownload returns to its normal (no-progress) state"
    why_human: "Requires error state to be present first"
---

# Quick Task 260415-ntl: Cached Models Accordion + Retry Button — Verification Report

**Task Goal:** Add cached models accordion to Compare page ModelSelector (before HF search) showing mini table rows with name/quant/size/last-used; add per-model retry button for failed downloads in PreDownload component.
**Verified:** 2026-04-15T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a 'Cached Models' accordion in the ModelSelector before the HF search input | VERIFIED | Accordion JSX at line 264 of ModelSelector/index.tsx; HF search `<div ref={wrapperRef}>` at line 339 — accordion is strictly before it |
| 2 | Accordion shows one row per model+quantization with name, quant, size, and last-used | VERIFIED | Table renders `cachedRows` (flattened one row per modelId+quantization); columns: Model name, Quant badge, Size (formatSize), Last Used (formatRelativeTime or 'Never') |
| 3 | Clicking a cached model row adds it to the comparison configs with the correct backend | VERIFIED | `handleAddCachedModel` builds TestConfig with `backend = webgpuSupported ? 'webgpu' : 'wasm'` and calls `addConfig(config)` (line 165) |
| 4 | Duplicate cached model+quant combos cannot be added twice | VERIFIED | `alreadyAdded` check in both `handleAddCachedModel` (lines 151-154) and the row `onClick` guard (`!alreadyAdded && !disabled`); dimmed row with 'added' label |
| 5 | When a download fails, the error status persists visibly after download-complete | VERIFIED | `workerBridge.ts` download-complete handler checks `hasErrors = dp.models.some(m => m.status === 'error')` and skips `setDownloadProgress(null)` when true (lines 59-61) |
| 6 | User sees a Retry button next to each failed model in the PreDownload progress list | VERIFIED | `PreDownload/index.tsx` lines 131-144: error branch renders `<button>Retry</button>` inside a flex container with the error message |
| 7 | Clicking Retry re-downloads only that single failed model | VERIFIED | Button calls `retryDownload(config)` (line 138); `retryDownload` in workerBridge.ts resets only that config's status and posts `{ type: 'download', configs: [config] }` — single-element array |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/ModelSelector/index.tsx` | Cached Models accordion with mini table rows before HF search | VERIFIED | Contains `cachedAccordionOpen` state (line 64), accordion JSX (line 264), `handleAddCachedModel`, `formatRelativeTime` helper |
| `src/lib/workerBridge.ts` | retryDownload export and error-preserving download-complete handler | VERIFIED | `export function retryDownload` at line 171; download-complete preserves progress when `hasErrors` (lines 59-61) |
| `src/components/PreDownload/index.tsx` | Per-model retry button on error rows and post-download error visibility | VERIFIED | `retryDownload` imported (line 2); Retry button in error branch (lines 131-144); `showProgress` includes `hasDownloadErrors` condition (line 36) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ModelSelector/index.tsx` | `lib/cacheManager.ts` | `enumerateCache` + `groupByModelAndQuant` in useEffect | WIRED | Import at line 7; called at lines 129 and 131 inside the cachedAccordionOpen/executionStatus effect |
| `ModelSelector/index.tsx` | `stores/useCompareStore.ts` | `addConfig` on cached row click | WIRED | `addConfig` subscribed at line 76; called at line 165 inside `handleAddCachedModel` which fires on row click |
| `PreDownload/index.tsx` | `lib/workerBridge.ts` | `retryDownload` import and call on button click | WIRED | Named import at line 2; called at line 138 inside Retry button onClick |
| `lib/workerBridge.ts` | `stores/useCompareStore.ts` | download-complete preserves downloadProgress when errors exist | WIRED | `hasErrors` check at line 59; conditional `setDownloadProgress(null)` at lines 60-62 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `ModelSelector/index.tsx` | `cachedRows` | `enumerateCache()` → `groupByModelAndQuant()` → flatMap | Cache API entries (browser-native); not hardcoded | FLOWING |
| `PreDownload/index.tsx` | `downloadProgress` | Zustand store, written by `updateModelDownloadStatus` in workerBridge | Set by live worker events; not hardcoded | FLOWING |

### Behavioral Spot-Checks

TypeScript compilation: `npx tsc --noEmit` — PASS (zero errors, zero output)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit` | No output (exit 0) | PASS |
| `retryDownload` exported from workerBridge | grep export | Found at line 171 | PASS |
| Accordion placed before HF search input | Line number comparison | Accordion line 264 < wrapperRef line 339 | PASS |
| `hasErrors` guard in download-complete | grep pattern | Lines 59-61 in workerBridge.ts | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CACHED-ACCORDION | 260415-ntl-PLAN.md | Cached models accordion in ModelSelector before HF search | SATISFIED | Accordion JSX at line 264; positioned before `<div ref={wrapperRef}>` at line 339 |
| RETRY-BUTTON | 260415-ntl-PLAN.md | Per-model retry button for failed downloads in PreDownload | SATISFIED | Retry button rendered in error branch, wired to `retryDownload` |

### Anti-Patterns Found

No blockers or stubs detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

### Human Verification Required

All 7 automated truths are verified by static analysis. The following behaviors require a running browser to confirm the UX:

**1. Cached accordion renders and populates correctly**

**Test:** Open Compare page in Chrome 113+. Click the "Cached Models" toggle button in ModelSelector.
**Expected:** Accordion expands; if no cached models, shows "No models cached yet." message. If models are cached, shows a mini table with columns Model / Quant / Size / Last Used.
**Why human:** Cache API state is runtime-only; cannot be populated or inspected statically.

**2. Clicking a cached row adds a config chip**

**Test:** With at least one cached model, click its row.
**Expected:** A new config chip appears in ModelSelector with the correct model name, `cached: true` badge shown as "Cached", and backend set to webgpu (or wasm if WebGPU not available).
**Why human:** Requires browser DOM interaction and WebGPU detection.

**3. Duplicate prevention UI**

**Test:** Click the same cached model row twice.
**Expected:** First click adds chip; second click does nothing; row is visually dimmed (opacity-40) with "added" label.
**Why human:** Requires DOM interaction.

**4. Download error persists and shows Retry button**

**Test:** Add a local model with an invalid model ID (e.g. "invalid/model-test"), click Download. Wait for failure.
**Expected:** After the download-complete event, the PreDownload progress list remains visible. The failed model row shows "!" indicator, error message, and a "Retry" button.
**Why human:** Requires triggering a real network request that fails.

**5. Retry re-downloads only the failed model**

**Test:** With an error row visible, click "Retry".
**Expected:** That model's row resets to waiting → downloading. Other rows in the list are unchanged.
**Why human:** Requires error state + live network behavior.

**6. Dismiss button clears error state**

**Test:** With error row(s) visible, click "Dismiss".
**Expected:** The PreDownload progress section disappears; UI returns to normal Download button state.
**Why human:** Requires error state to be present.

### Gaps Summary

No gaps. All 7 observable truths are verified by static analysis. TypeScript compiles cleanly. The 6 human verification items above are UX/runtime behaviors that require a live browser session — they are not gaps in the implementation.

---

_Verified: 2026-04-15T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
