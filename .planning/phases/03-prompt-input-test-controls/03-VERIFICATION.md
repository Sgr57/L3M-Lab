---
phase: 03-prompt-input-test-controls
verified: 2026-04-11T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "Verify PromptInput collapsible parameters panel"
    expected: "Below the textarea, a 'Parameters (temp 0.7, tokens 256, top-p 0.9, penalty 1.1)' toggle appears. Clicking it expands to show 4 number inputs. Clicking again collapses."
    why_human: "Visual behavior and animation (chevron rotation) cannot be verified programmatically"
  - test: "Verify parameter persistence across page refresh"
    expected: "Change temperature to 0.5, refresh the page, expand the parameters panel — should show 0.5 (persisted via localStorage)"
    why_human: "localStorage persist behavior requires live browser interaction"
  - test: "Verify PreDownload serial progress display during download"
    expected: "During download: each model shows 'Waiting' initially, then active progress bar with percentage, then checkmark with 'Done' when complete"
    why_human: "Real-time progress display requires actual model download to observe"
  - test: "Verify CTRL-03 info text coverage across the full page"
    expected: "Either TestControls or PreDownload shows model count and estimated download size together as info text. Estimated time is intentionally absent (D-10). Verify the combined UI communicates enough context to the user without estimated time."
    why_human: "CTRL-03 requires estimated time but D-10 explicitly drops it as unreliable — needs developer to accept this deviation or decide to add estimated time"
  - test: "Verify Cancel works for both download and run operations"
    expected: "Clicking Cancel during download stops the download. Clicking Cancel during run stops the run. The worker terminates cleanly in both cases."
    why_human: "Cancellation behavior requires live execution to test"
---

# Phase 3: Prompt Input & Test Controls — Verification Report

**Phase Goal:** Users can configure their prompt and generation parameters, then trigger pre-download or comparison runs
**Verified:** 2026-04-11
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can enter a multi-line prompt in a resizable textarea | VERIFIED | `src/components/PromptInput/index.tsx` has `<textarea ... className="... resize-y ..."` (line 20) |
| 2 | Generation parameters (temperature, max tokens, top-p, repeat penalty) are displayed inline with editable defaults | VERIFIED | Collapsible panel in PromptInput with 4 ParamInput fields, defaults in useSettingsStore (temp 0.7, maxTokens 256, topP 0.9, repeatPenalty 1.1), persisted via `partialize` middleware |
| 3 | Pre-Download button downloads all non-cached local models without loading into GPU memory | VERIFIED | `src/workers/inference.worker.ts` line 52: `device: 'wasm'` hardcoded in `handleDownload`. PreDownload component exists at `src/components/PreDownload/index.tsx` with Download button wired to `startDownload()` |
| 4 | Run Comparison button starts sequential execution; both buttons disable during execution with cancel available | VERIFIED | TestControls: `disabled={!canRun}` on Run button, Cancel shown when `isBusy`. PreDownload: `disabled={isBusy \|\| allCached}` on Download button, Cancel shown when `isDownloading`. `cancelExecution()` terminates worker and clears store. |
| 5 | Info text below controls shows model count, estimated download size, and estimated time | PARTIAL | PreDownload shows model count + `formatSize(totalSize)` (line 64-65). TestControls shows contextual disabled reasons, not a combined "N models / X MB" info line. Estimated time is absent — D-10 explicitly drops it as unreliable without hardware benchmarks. |

**Score: 4/5 truths verified** (SC #5 partially satisfied: model count and download size present across UI, estimated time absent by design)

**Note on CTRL-03 / SC #5:** The REQUIREMENTS.md and roadmap SC both specify "estimated time". Decision D-10 explicitly drops estimated time as unreliable. This deviation is documented in RESEARCH.md (line 54), CONTEXT.md (D-10), and both plan DONE blocks. No override has been recorded in this file yet. A human decision is needed to either accept this deviation (add override) or add estimated time.

**Note on SC #3 (parallel vs serial):** REQUIREMENTS.md CTRL-01 says "downloads all non-cached local models in parallel" but D-06 changed implementation to serial. The worker's `handleDownload` uses a `for` loop, not `Promise.all`. This deviation is fully documented and intentional (transformers.js sequential pipeline behavior, per-model progress tracking). The WASM constraint (GPU memory isolation) is fully met.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/index.ts` | ModelDownloadStatus and MultiModelDownloadProgress types | VERIFIED | Both interfaces present (lines 91-104), `status: 'waiting' \| 'downloading' \| 'complete' \| 'error'` |
| `src/stores/useSettingsStore.ts` | Generation parameters with persist | VERIFIED | `parameters: GenerationParameters` in state, `setParameter` action, `partialize` includes `parameters: state.parameters` |
| `src/stores/useCompareStore.ts` | Multi-model download progress state | VERIFIED | `downloadProgress: MultiModelDownloadProgress \| null`, `updateModelDownloadStatus` action present, no `parameters` field (moved to settings store) |
| `src/components/PromptInput/index.tsx` | Collapsible parameters panel | VERIFIED | `paramsOpen` state, toggle button with rotate-180 chevron, conditional ParamInput render, reads from `useSettingsStore` |
| `src/workers/inference.worker.ts` | WASM-forced download | VERIFIED | `device: 'wasm'` at line 52, `cancelled = false` at `handleDownload` start (line 32), `if (cancelled) break` at line 36 and line 76 |
| `src/lib/workerBridge.ts` | Multi-model download progress handling | VERIFIED | `updateModelDownloadStatus` called in download-progress case (line 27), `ModelDownloadStatus[]` initialized in `startDownload`, `setDownloadProgress(null)` in `cancelExecution` |
| `src/components/PreDownload/index.tsx` | Serial multi-model progress UI | VERIFIED | 134 lines, checkmark SVG (complete), progress bar (downloading), Waiting text (waiting), error state — all present |
| `src/components/TestControls/index.tsx` | Simplified run controls bar | VERIFIED | No `Pre-Download Models` button, no `sizeMap`, `useSettingsStore` for parameters, `Run Comparison` button present |
| `src/pages/ComparePage.tsx` | D-12 layout order | VERIFIED | Line 24: `<PreDownload />` between `<ModelSelector />` and `<TestControls />` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PromptInput/index.tsx` | `useSettingsStore.ts` | `useSettingsStore` selector for parameters and setParameter | WIRED | gsd-tools verified; `useSettingsStore((s) => s.parameters)` and `useSettingsStore((s) => s.setParameter)` |
| `workerBridge.ts` | `useCompareStore.ts` | `updateModelDownloadStatus` action | WIRED | gsd-tools verified; called in `download-progress` case |
| `PreDownload/index.tsx` | `useCompareStore.ts` | `useCompareStore` selector for configs, downloadProgress, executionStatus | WIRED | gsd-tools verified; three selectors present |
| `PreDownload/index.tsx` | `workerBridge.ts` | `startDownload` function import | WIRED | gsd-tools verified; `import { startDownload, cancelExecution }` at line 2 |
| `TestControls/index.tsx` | `useSettingsStore.ts` | `useSettingsStore` selector for parameters | WIRED | gsd-tools verified; `parameters = useSettingsStore((s) => s.parameters)` at line 9 |
| `ComparePage.tsx` | `PreDownload/index.tsx` | import and render in page layout | WIRED | gsd-tools verified; `import { PreDownload }` and `<PreDownload />` at line 24 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PromptInput/index.tsx` | `parameters` | `useSettingsStore` (hydrated from localStorage via persist middleware) | Yes — defaults set, user edits written back via `setParameter` | FLOWING |
| `PreDownload/index.tsx` | `downloadProgress` | `useCompareStore.downloadProgress`, set by `startDownload()` in `workerBridge.ts` | Yes — initialized from `localConfigs.map(...)`, updated by worker events via `updateModelDownloadStatus` | FLOWING |
| `TestControls/index.tsx` | `parameters` | `useSettingsStore` | Yes — same persist store as PromptInput | FLOWING |
| `TestControls/index.tsx` | `configs`, `prompt`, `status` | `useCompareStore` | Yes — user-driven state from ModelSelector and PromptInput | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with zero errors | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Production build succeeds | `npm run build` | 610 modules, dist/ produced, no errors | PASS |
| `device: 'wasm'` in worker handleDownload | `grep "device: 'wasm'" inference.worker.ts` | Found at line 52 | PASS |
| `Pre-Download Models` removed from TestControls | `grep "Pre-Download Models" TestControls/index.tsx` | No matches | PASS |
| `sizeMap` removed from TestControls | `grep "sizeMap" TestControls/index.tsx` | No matches | PASS |
| PreDownload wired in ComparePage | `grep "PreDownload" ComparePage.tsx` | Import at line 4, render at line 24 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PRMT-01 | 03-01 | Multi-line prompt in resizable textarea | SATISFIED | `textarea` with `resize-y` class in PromptInput |
| PRMT-02 | 03-01 | Generation parameters displayed inline and editable with defaults | SATISFIED | Collapsible panel with 4 ParamInput fields, persisted via useSettingsStore |
| CTRL-01 | 03-01, 03-02 | Pre-Download without GPU memory (forces WASM) | SATISFIED | `device: 'wasm'` hardcoded in worker handleDownload; PreDownload component created |
| CTRL-02 | 03-02 | Run Comparison executes all models sequentially | SATISFIED | `startComparison()` in workerBridge executes local configs via worker loop, cloud configs in main thread |
| CTRL-03 | 03-02 | Info text: model count, estimated download size, estimated time | PARTIAL | Model count shown in TestControls (`N models ready`), download size shown in PreDownload (`N models to download · X MB`). Estimated time absent by design (D-10). |
| CTRL-04 | 03-02 | Both buttons disabled during execution; cancel available | SATISFIED | TestControls: `disabled={!canRun}` (covers isBusy, hasUncachedModels, hasPrompt, hasConfigs). PreDownload: `disabled={isBusy \|\| allCached}`. Cancel button in both components. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PromptInput/index.tsx` | 20, 22 | `placeholder` in className and attribute | Info | CSS class name `placeholder-text-tertiary` + HTML `placeholder` attribute — both are intentional Tailwind/HTML usage, not stubs |

No blockers or warnings found. The `placeholder` hits are false positives from grep (CSS utility class name and legitimate HTML placeholder attribute).

### Human Verification Required

#### 1. Collapsible Parameters Panel Visual Behavior

**Test:** Run `npm run dev`, open `http://localhost:5173`, verify the PromptInput shows a "Parameters (temp 0.7, tokens 256, ...)" toggle below the textarea. Click it to expand, verify 4 number inputs appear. Click again to collapse.
**Expected:** Toggle label shows live parameter values. Chevron rotates 180 degrees on expand. Inputs accept number changes within defined min/max bounds.
**Why human:** Visual behavior, chevron animation, and input interaction cannot be verified programmatically.

#### 2. Parameter Persistence

**Test:** Change temperature to `0.5`, refresh the page, expand the parameters panel.
**Expected:** Temperature shows `0.5` after refresh — value was persisted to localStorage via Zustand persist middleware.
**Why human:** Requires live browser interaction with localStorage.

#### 3. PreDownload Serial Progress Display

**Test:** Add a local model (not cached), click Download in the PreDownload section.
**Expected:** Model initially shows "Waiting" dot label. During download: arrow icon + progress bar + percentage. On completion: checkmark icon + "Done" label.
**Why human:** Requires actual model download to trigger progress events.

#### 4. CTRL-03 Estimated Time — Deviation Decision Required

**Test:** Look at the combined UI with at least one model selected.
**Expected:** Somewhere visible, the user should see model count and estimated download size. The REQUIREMENTS.md specifies estimated time, but D-10 drops it.
**Why human:** This is a documented intentional deviation. The developer must decide: (a) accept the deviation and add an override entry to this VERIFICATION.md, or (b) add estimated time logic to TestControls or PreDownload.

If accepting, add to this file's frontmatter:
```yaml
overrides:
  - must_have: "Info text shows: model count, estimated download size, estimated time"
    reason: "Estimated time is unreliable without hardware benchmarks and varies per machine. Model count and download size are shown across PreDownload and TestControls. D-10 explicitly drops estimated time."
    accepted_by: "your-name"
    accepted_at: "2026-04-11T00:00:00Z"
```

#### 5. Cancel Works for Both Download and Run

**Test:** Start a download, click Cancel. Start a run, click Cancel.
**Expected:** Both operations stop cleanly. Worker terminates. Store clears downloadProgress/runProgress.
**Why human:** Requires live execution to test the worker termination path.

### Gaps Summary

No blocking gaps found. All artifacts exist, are substantive, and are wired. TypeScript and build pass cleanly.

The only open item is **CTRL-03 estimated time** — this is a documented deviation from REQUIREMENTS.md that has been accepted at the design level (D-10) but not formally recorded as a verification override. The human verification step for this item determines whether the phase is fully closed or requires a small addition.

The **parallel vs serial** deviation in CTRL-01 is a documented design choice (D-06) with clear rationale (transformers.js sequential pipeline, better per-model progress UX). The GPU isolation requirement (no GPU memory during download) is fully met via `device: 'wasm'`.

---

_Verified: 2026-04-11_
_Verifier: Claude (gsd-verifier)_
