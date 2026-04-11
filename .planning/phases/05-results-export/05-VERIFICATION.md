---
phase: 05-results-export
verified: 2026-04-11T18:45:00Z
status: human_needed
score: 12/13 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "Tok/s bar chart and time breakdown stacked bar chart render with correct color coding (purple cloud, blue WebGPU, green WASM)"
    reason: "User explicitly chose per-model unique colors over backend colors in DISCUSSION-LOG (D-03). Backend type is communicated via BackendBadge chip on Y-axis labels. The original SC2 wording reflects the pre-discussion default; the post-discussion decision is the authoritative spec. No backend-color constant exists anywhere in the codebase."
    accepted_by: "developer"
    accepted_at: "2026-04-11T16:25:00Z"
gaps: []
human_verification:
  - test: "View OutputComparison with at least one error result"
    expected: "Error result card should NOT show misleading '0.0 tok/s', '0 tokens', '0 ms' metrics in the card header -- metrics div should be hidden when r.error is set"
    why_human: "The code unconditionally renders r.metrics.tokensPerSecond/tokenCount/totalTime regardless of r.error (line 124-128 of OutputComparison/index.tsx). This is a UI correctness issue (WR-02 from code review) that requires running the app to confirm the bad user experience."
  - test: "Run the full comparison, then click each of the three export buttons"
    expected: "Each button (Export Markdown, Export CSV, Export JSON) should trigger a file download to disk -- no clipboard operations"
    why_human: "File download behavior (Blob URL + anchor click) cannot be verified without running the browser"
  - test: "Add two models with the same displayName, run comparison, check all results components"
    expected: "Labels show disambiguation suffix (e.g. 'Llama (Q4)' vs 'Llama (Q8)') in PerformanceCharts Y-axis, ComparisonTable Model column, and OutputComparison card headers"
    why_human: "getDisambiguatedLabels logic is verified structurally but the runtime Map lookup at each render site needs visual confirmation"
---

# Phase 5: Results & Export Verification Report

**Phase Goal:** Users can analyze benchmark results through summary stats, charts, sortable tables, and output comparisons -- and export everything
**Verified:** 2026-04-11T18:45:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Summary stat cards show models tested, total time, fastest overall (name + tok/s), fastest local -- error results excluded | VERIFIED | `ResultsSummary/index.tsx:20-28`: `successfulResults = results.filter((r) => !r.error)`, all 4 stat card values computed from `successfulResults` |
| 2 | Tok/s bar chart and time breakdown stacked bar chart render with per-model colors (SC2 backend-color spec superseded by D-03) | VERIFIED (override) | `PerformanceCharts/index.tsx:13`: imports `getModelColor, hexToRgba`; `Cell fill={getModelColor(configs, entry.configId)}` for all bars; no BACKEND_COLORS constant anywhere |
| 3 | Comparison table is sortable by any column, rows have per-model color accent, best values green bold, worst in red | VERIFIED | `ComparisonTable/index.tsx:47-70`: `getSortValue` + `sorted` useMemo; `border-l-[3px]` with `borderLeftColor: getModelColor()`; `text-success font-semibold` / `text-error` on tok/s and total |
| 4 | Output comparison cards: model name, type badge, key metrics, collapsible text, star rating, color-coded left borders, Show N more | VERIFIED | `OutputComparison/index.tsx`: TypeBadge, StarRating (size="lg"), `border-l-[3px]` with `getModelColor`, `INITIAL_VISIBLE=3`, show/hide toggle; WARNING: metrics shown unconditionally for errors (WR-02) |
| 5 | JSON export serializes full ComparisonRun including all TestResult fields | VERIFIED | `exportUtils.ts:97-99`: `JSON.stringify(run, null, 2)` on typed ComparisonRun |
| 6 | CSV export has 17 columns including Fallback Backend, Error Category, Error Hint, Raw Error | VERIFIED | `exportUtils.ts:68`: header confirmed 17 columns; rows include `r.fallbackBackend ?? ''`, `r.errorCategory ?? ''`, quoted errorHint and rawError |
| 7 | Markdown export downloads as .md file (not clipboard) and includes Errors & Fallbacks section | VERIFIED | `ExportBar/index.tsx:21-23`: `handleExportMarkdown` calls `downloadFile(md, 'comparison-results.md', 'text/markdown')`; `exportUtils.ts:54-62`: conditional Errors & Fallbacks section |
| 8 | All three export buttons trigger file downloads -- no clipboard-only button | VERIFIED | `ExportBar/index.tsx`: three handlers (handleExportMarkdown, handleExportCSV, handleExportJSON) all call `downloadFile()`; no `copyToClipboard` import |
| 9 | PerformanceCharts excludes error results from charts | VERIFIED | `PerformanceCharts/index.tsx:50`: `successfulResults = results.filter((r) => !r.error)`; `speedData` and `timeData` built from `successfulResults` |
| 10 | ComparisonTable error rows have red tint, show "Error" in metric columns, best/worst excludes errors | VERIFIED | `ComparisonTable/index.tsx:94-105`: `bestWorst` filters `!r.error`; `bg-error/5` on error rows; `<span className="text-error">Error</span>` in 6 metric cells |
| 11 | Chart Y-axis shows model name + BackendBadge chip (API/GPU/WASM) via custom SVG tick | VERIFIED | `PerformanceCharts/index.tsx:17-44`: `CustomYAxisTick` renders `<text x={-8} textAnchor="end">` for name and `<rect x={2}>` for badge; `width={180}` on YAxis |
| 12 | Time breakdown LabelList shows full total time string (e.g. 2.3s) on generation bar | VERIFIED | `PerformanceCharts/index.tsx:77-80`: `totalTimeFormatted` field in timeData; `<LabelList dataKey="totalTimeFormatted" position="right">` on generation Bar |
| 13 | All components use disambiguated labels from getDisambiguatedLabels | VERIFIED | All 3 visualization components: `labels = useMemo(() => getDisambiguatedLabels(configs), [configs])`; `labels.get(r.config.id) ?? r.config.displayName` at each model name render site |

**Score:** 12/13 truths verified (1 override applied, 0 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/modelColors.ts` | MODEL_COLORS palette, getModelColor, hexToRgba | VERIFIED | Exports all 3; 10-color palette with exact hex values from UI-SPEC |
| `src/lib/disambiguate.ts` | getDisambiguatedLabels with quant/backend/both paths | VERIFIED | Conditional disambiguation: quant-unique -> quant suffix; backend-unique -> backend suffix; else both |
| `src/components/shared/TypeBadge.tsx` | TypeBadge with text-xs sizing | VERIFIED | `text-xs font-semibold`; cloud/local-wasm/local labels |
| `src/components/shared/BackendBadge.tsx` | BackendBadge with API/GPU/WASM labels | VERIFIED | BADGE_LABELS record: api->'API', webgpu->'GPU', wasm->'WASM'; `text-xs font-semibold` |
| `src/components/shared/StarRating.tsx` | StarRating with size sm/lg prop | VERIFIED | `size?: 'sm' \| 'lg'`; sm -> `text-sm`, lg -> `text-lg`; uses `<button type="button">` |
| `src/components/ResultsSummary/index.tsx` | Error-filtered stat cards, correct typography | VERIFIED | `successfulResults.length === 0` guard; `font-semibold` values, `text-xs` labels, `gap-4` grid |
| `src/components/PerformanceCharts/index.tsx` | Per-model colors, custom Y-axis, LabelList, error filtering | VERIFIED | All criteria met; no BACKEND_COLORS or Legend import |
| `src/components/ComparisonTable/index.tsx` | Per-model border accent, shared components, error handling, sort preserved | VERIFIED | `border-l-[3px]` with getModelColor; shared TypeBadge/BackendBadge/StarRating; getSortValue + sorted useMemo intact; no local badge definitions |
| `src/components/OutputComparison/index.tsx` | Per-model borders, shared components, disambiguation, Copy Output | VERIFIED | `getModelColor` for borderLeftColor; TypeBadge/StarRating from shared; `Copy Output` text; no BORDER_COLORS |
| `src/lib/exportUtils.ts` | Enhanced CSV (17 cols), Markdown with Errors & Fallbacks, all functions | VERIFIED | 17-column CSV header; conditional Errors & Fallbacks section; all 6 exports present |
| `src/components/ExportBar/index.tsx` | Three download buttons, no clipboard, font-semibold | VERIFIED | handleExportMarkdown/CSV/JSON all use downloadFile; `font-semibold` on all buttons; no copyToClipboard import |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/modelColors.ts` | `src/types/index.ts` | `import type { TestConfig }` | WIRED | Line 1: `import type { TestConfig } from '../types'` |
| `src/lib/disambiguate.ts` | `src/types/index.ts` | `import type { TestConfig, Backend }` | WIRED | Line 1: `import type { TestConfig, Backend } from '../types'` |
| `src/components/PerformanceCharts/index.tsx` | `src/lib/modelColors.ts` | `import { getModelColor, hexToRgba }` | WIRED | Line 13: confirmed; used at Cell fill for all bar types |
| `src/components/ComparisonTable/index.tsx` | `src/lib/disambiguate.ts` | `import { getDisambiguatedLabels }` | WIRED | Line 4: confirmed; `labels.get(r.config.id)` in model column |
| `src/components/OutputComparison/index.tsx` | `src/lib/modelColors.ts` | `import { getModelColor }` | WIRED | Line 3: confirmed; `getModelColor(configs, r.config.id)` in borderLeftColor |
| `src/components/ExportBar/index.tsx` | `src/lib/exportUtils.ts` | `downloadFile(..., 'comparison-results.md', ...)` | WIRED | Lines 7-9 import; line 22 `downloadFile(md, 'comparison-results.md', 'text/markdown')` |
| `src/lib/exportUtils.ts` | `src/types/index.ts` | `r.fallbackBackend \| r.errorCategory` in CSV/Markdown | WIRED | Lines 54, 58, 88-89: all optional TestResult fields accessed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ResultsSummary/index.tsx` | `successfulResults` | `useCompareStore((s) => s.results)` filtered | Zustand store populated by run | FLOWING |
| `PerformanceCharts/index.tsx` | `speedData`, `timeData` | `useCompareStore` results + configs | Store populated by execution engine | FLOWING |
| `ComparisonTable/index.tsx` | `sorted` | `useCompareStore` results + configs | Store populated by execution engine | FLOWING |
| `OutputComparison/index.tsx` | `visibleResults` | `useCompareStore` results | Store populated by execution engine | FLOWING |
| `ExportBar/index.tsx` | `getRun()` | `useCompareStore` + `useSettingsStore` | All store data from prior run | FLOWING |

### Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit` exits 0 | PASS |
| CSV header has 17 columns | Counted 17 comma-delimited headers | PASS |
| ExportBar has no `copyToClipboard` import | grep found nothing | PASS |
| No local TypeBadge/BackendBadge/StarRating in ComparisonTable/OutputComparison | grep found nothing | PASS |
| No BACKEND_COLORS or bg-cloud-light/bg-wasm-light in any component | grep found nothing | PASS |
| All 7 phase-05 commits exist in git log | ebfd66b, b1cd9d1, 9d9d68e, eb67346, ffd3b19, eafe80a, 9913bd8 all present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RSLT-01 | 05-01 | Summary stat cards | SATISFIED | ResultsSummary: 4 stat cards from successfulResults |
| RSLT-02 | 05-02 | Tok/s bar chart color-coded | SATISFIED (D-03 override) | PerformanceCharts: per-model colors on bars; backend shown via Y-axis badge chip |
| RSLT-03 | 05-02 | Time breakdown stacked bar chart | SATISFIED | PerformanceCharts: load/init/generation stacked bars with three opacity shades; LabelList shows total time |
| RSLT-04 | 05-02 | Sortable table 11 columns | SATISFIED | ComparisonTable: SortKey type + getSortValue cover displayName, backend, quantization, modelSize, loadTime, ttft, tokensPerSecond, totalTime, tokenCount, rating; 11-column header rendered |
| RSLT-05 | 05-02 | Table rows color-coded (originally backend tint, D-03 superseded) | SATISFIED | Per-model left-border accent (border-l-[3px] + getModelColor) replaces backend row tinting per explicit user decision in DISCUSSION-LOG |
| RSLT-06 | 05-02 | Best green bold, worst red, excludes errors | SATISFIED | bestWorst computed from `results.filter((r) => !r.error)`; tokClass/totalClass guard `!r.error` |
| RSLT-07 | 05-02 | Output comparison cards with all features | SATISFIED (WRN) | TypeBadge, StarRating, expand/collapse, getModelColor borders, Show N more all present; WR-02: metrics unconditionally shown for errors (cosmetic, not blocking) |
| RSLT-08 | 05-02 | Output cards color-coded left borders | SATISFIED | borderLeftColor: r.error ? '#cf222e' : getModelColor(configs, r.config.id) |
| RSLT-09 | 05-02 | Show N more collapse | SATISFIED | INITIAL_VISIBLE=3, showAll toggle, "Show N more" / "Show less" buttons |
| EXPT-01 | 05-03 | JSON export | SATISFIED | formatAsJSON: JSON.stringify(run, null, 2) -- full ComparisonRun including all TestResult fields |
| EXPT-02 | 05-03 | CSV with all metrics | SATISFIED | 17-column CSV with error/fallback metadata per D-15 |
| EXPT-03 | 05-03 | Copy as Markdown (spec text) / Download Markdown (D-14 decision) | SATISFIED | Markdown downloads as .md file per user decision in DISCUSSION-LOG; satisfies intent of EXPT-04 |
| EXPT-04 | 05-03 | All exports download a file to disk | SATISFIED | All three ExportBar buttons call downloadFile(); no clipboard-only path |

All 13 Phase 5 requirements are addressed. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/OutputComparison/index.tsx` | 124-128 | Metrics header rendered unconditionally -- error results show "0.0 tok/s", "0 tokens", "0 ms" | Warning | Misleads user into thinking model ran but returned empty output (WR-02 from code review) |
| `src/lib/exportUtils.ts` | 73-91 | CSV fields like displayName not escaped -- model names with commas produce malformed CSV | Warning | Rare but real: any model ID containing a comma breaks column alignment (WR-01 from code review) |
| `src/components/PerformanceCharts/index.tsx` | 82-87 | `backendLookup` useMemo with deps `[speedData, timeData]` that are new arrays every render -- memo never hits | Info | No functional impact, minor performance note (IN-01 from code review) |
| `src/components/ExportBar/index.tsx` | 12 | `useCompareStore()` without selector -- subscribes to entire store | Info | Extra re-renders during execution (IN-02 from code review) |

No blockers found. The two warnings (WR-01, WR-02) were flagged by the code review but do not prevent goal achievement.

### Human Verification Required

#### 1. Error Result Metrics Display (WR-02)

**Test:** Run a comparison that includes a cloud model with an invalid API key (so it errors). View the OutputComparison section.
**Expected:** The error result card header should NOT show "0.0 tok/s, 0 tokens, 0 ms". Metrics should be hidden or show "--" when `r.error` is set.
**Why human:** The unconditional render at `OutputComparison/index.tsx:124-128` can only be confirmed as misleading by viewing the rendered card.

#### 2. File Download Behavior

**Test:** With results present, click "Export Markdown", "Export CSV", "Export JSON" in sequence.
**Expected:** Each click triggers a browser file download dialog (or auto-download) producing a file on disk. No clipboard notification.
**Why human:** `downloadFile()` uses `document.createElement('a').click()` -- browser download behavior requires visual confirmation.

#### 3. Label Disambiguation

**Test:** Add the same model ID twice with different quantizations (e.g., Q4 and Q8). Run comparison. Check PerformanceCharts Y-axis, ComparisonTable Model column, OutputComparison headers.
**Expected:** Labels show "(Q4)" and "(Q8)" suffix on all three components -- no duplicate labels.
**Why human:** `getDisambiguatedLabels` logic is structurally verified but runtime label rendering in SVG tick and JSX requires visual confirmation.

### Gaps Summary

No blocking gaps found. All 13 requirements are satisfied. The phase goal is achieved: users can analyze benchmark results through summary stats, charts, sortable tables, and output comparisons -- and export everything.

Two warnings from the code review (WR-01 CSV escaping, WR-02 error result metrics) exist but do not block the goal. They are improvement opportunities for a follow-up fix.

One success criteria (SC2) was formally superseded by user decision D-03 (per-model colors instead of backend colors); the override is applied above. The DISCUSSION-LOG at `.planning/phases/05-results-export/05-DISCUSSION-LOG.md` contains the explicit user decision.

---

_Verified: 2026-04-11T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
