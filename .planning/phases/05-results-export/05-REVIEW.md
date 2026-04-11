---
phase: 05-results-export
reviewed: 2026-04-11T12:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/components/ComparisonTable/index.tsx
  - src/components/ExportBar/index.tsx
  - src/components/OutputComparison/index.tsx
  - src/components/PerformanceCharts/index.tsx
  - src/components/ResultsSummary/index.tsx
  - src/components/shared/BackendBadge.tsx
  - src/components/shared/StarRating.tsx
  - src/components/shared/TypeBadge.tsx
  - src/lib/disambiguate.ts
  - src/lib/exportUtils.ts
  - src/lib/modelColors.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 5 adds results display and export functionality: a comparison table with sorting, output cards with expand/collapse, performance bar charts, summary statistics, shared badge components, model color palette, label disambiguation, and Markdown/CSV/JSON export.

Overall code quality is solid. Components follow established project conventions (Zustand selectors, named exports, proper TypeScript typing). The disambiguation logic and model color palette are well-designed. The main concerns are: (1) CSV export does not properly escape all fields, risking malformed output; (2) the OutputComparison card header displays metrics for error results, showing misleading "0.0 tok/s" values; (3) an unhandled promise rejection in clipboard copy; and (4) a potential `RangeError` in the star-rendering helper for edge-case rating values.

## Warnings

### WR-01: CSV export does not escape model name and other fields

**File:** `src/lib/exportUtils.ts:73-91`
**Issue:** Only `output`, `errorHint`, and `rawError` are quoted/escaped in CSV rows. Fields like `displayName`, `quantization`, and `backend` are emitted raw. If a model name contains a comma (e.g., `"meta-llama/Llama-3.2-1B, finetuned"`), the CSV row will have misaligned columns. This also opens a minor CSV injection vector if a name starts with `=`, `+`, `-`, or `@`.
**Fix:** Wrap every field through a CSV-safe escaping function:
```typescript
function csvEscape(value: string | number | null): string {
  const str = value === null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Then in the row builder:
return [
  csvEscape(c.displayName),
  csvEscape(c.backend === 'api' ? 'cloud' : 'local'),
  csvEscape(c.backend === 'api' ? '' : c.quantization),
  csvEscape(c.backend),
  // ... etc for all fields
].join(',')
```

### WR-02: OutputComparison shows misleading metrics for error results

**File:** `src/components/OutputComparison/index.tsx:124-128`
**Issue:** The card header always renders `tokensPerSecond`, `tokenCount`, and `totalTime` from `r.metrics`, even when `r.error` is set. Error results have zero or meaningless metric values, so the header displays "0.0 tok/s", "0 tokens", "0 ms" -- misleading users into thinking the model ran but produced zero output.
**Fix:** Conditionally hide metrics when the result is an error:
```tsx
{!r.error && (
  <div className="flex items-center gap-3 text-xs text-text-secondary">
    <span>{r.metrics.tokensPerSecond.toFixed(1)} tok/s</span>
    <span>{r.metrics.tokenCount} tokens</span>
    <span>{formatTime(r.metrics.totalTime)}</span>
  </div>
)}
```

### WR-03: Unhandled promise rejection in clipboard copy

**File:** `src/components/OutputComparison/index.tsx:59-61`
**Issue:** `navigator.clipboard.writeText` returns a Promise that can reject (permission denied, non-HTTPS context, browser restrictions). The `copyOutput` function is `async` but the `onClick` handler at line 199 does not catch the rejection, resulting in an unhandled promise rejection.
**Fix:** Add error handling:
```typescript
const copyOutput = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard API unavailable or permission denied -- silent fallback
  }
}
```

### WR-04: `stars()` helper can throw RangeError on out-of-range rating

**File:** `src/lib/exportUtils.ts:15-18`
**Issue:** `'☆'.repeat(5 - rating)` will throw a `RangeError` if `rating` is greater than 5 or negative, since `String.prototype.repeat` requires a non-negative integer. While the `StarRating` component only emits values 1--5, the `rating` field on `TestResult` is typed as `number | null`, and the store's `updateRating` accepts any `number`. A programmatic caller or future change could pass an out-of-range value.
**Fix:** Clamp the value:
```typescript
function stars(rating: number | null): string {
  if (rating === null) return 'Not rated'
  const clamped = Math.max(0, Math.min(5, Math.round(rating)))
  return '\u2605'.repeat(clamped) + '\u2606'.repeat(5 - clamped)
}
```

## Info

### IN-01: Ineffective useMemo for backendLookup in PerformanceCharts

**File:** `src/components/PerformanceCharts/index.tsx:82-87`
**Issue:** `backendLookup` is wrapped in `useMemo` with `[speedData, timeData]` as dependencies, but `speedData` and `timeData` are new array references on every render (computed outside any memo). The `useMemo` will recompute every render, providing no memoization benefit.
**Fix:** Either move `speedData`/`timeData` computation into `useMemo` blocks with `[successfulResults]` deps, or remove the `useMemo` wrapper from `backendLookup` since it provides no benefit as-is.

### IN-02: ExportBar subscribes to entire store instead of using selectors

**File:** `src/components/ExportBar/index.tsx:12`
**Issue:** `const { prompt, configs, results } = useCompareStore()` subscribes to the entire store. Any store update (e.g., `runProgress`, `downloadProgress`, `executionStatus` changes during a run) will trigger a re-render of ExportBar, even though it only needs `prompt`, `configs`, and `results`. The rest of the codebase consistently uses the selector pattern.
**Fix:** Use individual selectors to match the project convention:
```typescript
const prompt = useCompareStore((s) => s.prompt)
const configs = useCompareStore((s) => s.configs)
const results = useCompareStore((s) => s.results)
```

---

_Reviewed: 2026-04-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
