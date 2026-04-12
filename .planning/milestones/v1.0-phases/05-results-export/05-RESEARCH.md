# Phase 5: Results & Export - Research

**Researched:** 2026-04-11
**Domain:** React data visualization (Recharts), export utilities, color system, label disambiguation
**Confidence:** HIGH

## Summary

Phase 5 refines and gap-fills five existing results components (ResultsSummary, PerformanceCharts, ComparisonTable, OutputComparison, ExportBar) plus export utilities. The codebase already has substantial functionality -- this is not a build-from-scratch effort but a targeted refinement phase that introduces three new cross-cutting concerns: (1) per-model color identity replacing backend-based coloring, (2) conditional label disambiguation for duplicate model names, and (3) enhanced error/fallback metadata in exports.

The primary technical challenge is the PerformanceCharts component, which requires custom Recharts YAxis tick rendering with embedded backend badge chips, LabelList value labels on bars, and a three-shade color system derived from per-model colors for the time breakdown stacked bars. All other component changes are straightforward CSS/prop adjustments.

**Primary recommendation:** Build the per-model color palette and label disambiguation utility first as shared infrastructure, then apply them across all five components in a natural dependency order.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Each model config gets a unique color assigned when added to the comparison. This color is the model's visual identity throughout the entire UI -- ModelSelector chip (left border), chart bars, output card border, table row accent.
- **D-02:** Colors come from a predefined palette of visually distinct colors. Palette must support at least 8-10 models without repeating. Color is assigned by index or config ID.
- **D-03:** The unique model color replaces backend-based coloring on chart bars, output card left borders, and table row accents. Backend type is communicated via badges/chips instead.
- **D-04:** When multiple configs share the same model display name, append a suffix to disambiguate -- quantization (e.g., "SmolLM2-135M-Instruct (Q4)" vs "(Q8)"), backend (e.g., "(WebGPU)" vs "(WASM)"), or both if needed. Only the minimum differentiating fields are appended.
- **D-05:** When all model display names are already unique, no suffix is added. Labels stay clean.
- **D-06:** Disambiguation is computed dynamically based on the current set of configs. A utility function should detect collisions and produce disambiguated labels.
- **D-07:** Backend type shown as a small text badge ("API", "GPU", "WASM") next to model names in the comparison table, output cards, and chart Y-axis labels. Badge uses the established backend colors: purple (#8250df) for API, blue (#0969da) for WebGPU, green (#1a7f37) for WASM.
- **D-08:** In charts: Y-axis displays model name + backend-colored chip. Bars use the unique per-model color. No chart legend needed -- Y-axis labels + model color identity are sufficient.
- **D-09:** Stat cards exclude error results. Failed models don't count toward "models tested", don't appear in fastest/worst calculations. Only successful runs contribute to summary stats.
- **D-10:** Charts exclude error results. Failed models don't appear in tok/s or time breakdown charts. Clean visualization of successful runs only.
- **D-11:** Comparison table includes error results as red-tinted rows with "Error" in metric columns. Keeps the full picture of what was attempted. Error category and hint shown inline.
- **D-12:** Value labels displayed on bars. Tok/s chart shows the numeric value (e.g., "23.4") on or beside each bar. Time breakdown chart shows total time (e.g., "2.3s") at the right end of each stacked bar.
- **D-13:** Charts use unique per-model colors on bars with backend-colored chips on Y-axis labels. No backend color legend -- the chips provide that info.
- **D-14:** Markdown export downloads as a .md file (replacing the current clipboard-only behavior). All three formats (JSON, CSV, Markdown) produce a file download. No clipboard copy button.
- **D-15:** All exports include full metadata: fallbackBackend, errorCategory, errorHint, rawError, and timestamps. Complete audit trail for developers. JSON gets the full object; CSV adds columns for error/fallback fields; Markdown includes an error/fallback section.
- **D-16:** Keep current order: ResultsSummary -> PerformanceCharts -> ComparisonTable -> OutputComparison -> ExportBar. Top-down from summary to detail.

### Claude's Discretion
- Color palette selection (specific hex values for the 8-10 model colors, as long as they're visually distinct and don't clash with backend badge colors)
- Exact badge styling (font size, padding, border-radius) -- consistent with existing badge patterns in the codebase
- Recharts implementation details for custom Y-axis labels with embedded badge chips
- How to store the color assignment (on TestConfig, or a separate mapping in the store)
- Whether value labels on bars use Recharts `<LabelList>` or custom bar labels

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RSLT-01 | Summary stat cards: models tested count, total time, fastest overall (name + tok/s), fastest local (name + tok/s) | ResultsSummary already implements this; needs error filtering (D-09) and typography fixes per UI-SPEC |
| RSLT-02 | Tok/s horizontal bar chart ordered by speed, color-coded | PerformanceCharts exists; needs per-model colors (D-03), custom YAxis tick with badge (D-08), LabelList values (D-12), error filtering (D-10) |
| RSLT-03 | Time breakdown stacked horizontal bar chart | PerformanceCharts exists; needs three-shade per-model colors, total time LabelList (D-12), segment legend |
| RSLT-04 | Sortable comparison table with 11 columns | ComparisonTable fully functional; needs per-model row accent (D-03), disambiguated labels (D-04) |
| RSLT-05 | Table rows color-coded by model type | Existing backend-based row tinting replaced by per-model left-border accent (D-03); error rows get red tint (D-11) |
| RSLT-06 | Best values in green bold, worst in red | Already implemented in ComparisonTable; needs error result exclusion from best/worst calculation |
| RSLT-07 | Output comparison cards with model name, type badge, key metrics, collapsible text, star rating | OutputComparison fully functional; needs per-model border color (D-03), disambiguated labels (D-04) |
| RSLT-08 | Output cards color-coded by left border | Existing backend-based borders replaced by per-model colors (D-03) |
| RSLT-09 | Collapsed indicator for remaining outputs | Already implemented as "Show N more" / "Show less" |
| EXPT-01 | Export as JSON | Already implemented; needs error/fallback metadata inclusion (D-15) |
| EXPT-02 | Export as CSV with all metrics | Already implemented; needs error/fallback columns (D-15) |
| EXPT-03 | Copy as Markdown | Behavior changed: now downloads as .md file (D-14) |
| EXPT-04 | All exports download a file to disk | CSV and JSON already download; Markdown needs switch from clipboard to download (D-14) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand + Recharts -- no changes
- **No backend:** Everything client-side
- **POC scope:** Functional-first, minimal polish, no premature abstraction
- **Single worker:** All model operations in one dedicated Web Worker
- **Named exports preferred** over default exports
- **Zustand stores with selector pattern** for state access
- **No test framework** installed (Jest, Vitest, or similar not detected)
- **Component structure:** PascalCase with `index.tsx` (e.g., `ModelSelector/index.tsx`)
- **Utility files:** camelCase in `src/lib/` (e.g., `exportUtils.ts`)

## Standard Stack

### Core (already installed -- no changes)

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| recharts | 3.8.1 | Bar charts, LabelList, custom tick rendering | [VERIFIED: npm registry + node_modules] |
| zustand | 5.0.12 | State management for results, configs, ratings | [VERIFIED: package.json] |
| react | 19.2.4 | UI framework | [VERIFIED: package.json] |
| tailwindcss | 4.2.2 | Utility-first styling | [VERIFIED: package.json] |

### Supporting (no new packages needed)

This phase requires **zero new dependencies**. All functionality is built with existing libraries:

- **Recharts `LabelList`:** Already exported from recharts -- used for value labels on bars [VERIFIED: node_modules/recharts/types/index.d.ts]
- **Recharts custom `tick` function:** YAxis `tick` prop accepts `(props: YAxisTickContentProps) => ReactNode` for custom SVG rendering [VERIFIED: node_modules/recharts/types/cartesian/YAxis.d.ts]
- **Blob API + URL.createObjectURL:** Already used in `downloadFile()` in exportUtils.ts [VERIFIED: src/lib/exportUtils.ts]
- **crypto.randomUUID():** Already used in buildComparisonRun [VERIFIED: src/lib/exportUtils.ts]

**Installation:** None required.

## Architecture Patterns

### New Files to Create

```
src/
  lib/
    modelColors.ts          # MODEL_COLORS palette array + getModelColor(configs, configId) helper
    disambiguate.ts         # getDisambiguatedLabels(configs) utility
  components/
    shared/
      TypeBadge.tsx         # Extracted from ComparisonTable + OutputComparison
      BackendBadge.tsx      # Extracted from ComparisonTable (reused in chart Y-axis)
      StarRating.tsx        # Extracted from ComparisonTable + OutputComparison
```

### Existing Files to Modify

```
src/
  components/
    ResultsSummary/index.tsx     # Error filtering, typography adjustments
    PerformanceCharts/index.tsx  # Major refactor: per-model colors, custom YAxis tick, LabelList, remove BackendLegend
    ComparisonTable/index.tsx    # Per-model row accent, disambiguated labels, error row handling, use shared components
    OutputComparison/index.tsx   # Per-model border colors, disambiguated labels, use shared components
    ExportBar/index.tsx          # Markdown: clipboard -> file download, button label change
  lib/
    exportUtils.ts               # Add error/fallback columns to CSV, error section to Markdown
```

### Pattern 1: Per-Model Color Assignment by Config Index

**What:** Colors are derived from the config's position in the `configs` array, not stored on the config object itself.
**When to use:** Everywhere a model needs its unique color -- charts, table rows, output card borders.
**Why index-based:** Avoids adding a `color` field to TestConfig (which would require store migration and serialization concerns). The `configs` array is stable during a comparison run.

```typescript
// src/lib/modelColors.ts
// Source: UI-SPEC per-model color palette specification

export const MODEL_COLORS: string[] = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#d97706', // Amber
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#e11d48', // Rose
  '#4f46e5', // Indigo
  '#ca8a04', // Yellow
  '#059669', // Emerald
]

export function getModelColor(configs: TestConfig[], configId: string): string {
  const index = configs.findIndex((c) => c.id === configId)
  return MODEL_COLORS[index % MODEL_COLORS.length]
}
```

[VERIFIED: Color hex values from 05-UI-SPEC.md]

### Pattern 2: Conditional Label Disambiguation

**What:** Utility function that groups configs by displayName and appends minimal differentiating suffixes only when collisions exist.
**When to use:** Every component that displays model names -- charts, table, output cards.

```typescript
// src/lib/disambiguate.ts
// Source: CONTEXT.md D-04/D-05/D-06

export function getDisambiguatedLabels(configs: TestConfig[]): Map<string, string> {
  const labels = new Map<string, string>()
  const groups = new Map<string, TestConfig[]>()

  // Group by displayName
  for (const c of configs) {
    const group = groups.get(c.displayName) ?? []
    group.push(c)
    groups.set(c.displayName, group)
  }

  for (const [name, group] of groups) {
    if (group.length === 1) {
      labels.set(group[0].id, name)
      continue
    }
    // Check if quantization alone disambiguates
    const quants = new Set(group.map((c) => c.quantization))
    const backends = new Set(group.map((c) => c.backend))

    if (quants.size === group.length) {
      for (const c of group) labels.set(c.id, `${name} (${c.quantization.toUpperCase()})`)
    } else if (backends.size === group.length) {
      for (const c of group) labels.set(c.id, `${name} (${backendLabel(c.backend)})`)
    } else {
      for (const c of group) labels.set(c.id, `${name} (${c.quantization.toUpperCase()}/${backendLabel(c.backend)})`)
    }
  }
  return labels
}
```

[ASSUMED: Algorithm design based on D-04/D-05/D-06 spec. Edge cases like three configs with same name where two share quantization need the both-fields fallback path.]

### Pattern 3: Custom Recharts YAxis Tick with Backend Badge

**What:** A custom tick function for Recharts YAxis that renders the model name as SVG text plus a backend badge using pure SVG rect+text.
**When to use:** Both charts in PerformanceCharts (tok/s and time breakdown).

The tick function receives `{ x, y, payload, ... }` where `payload.value` is the category string. Since we need access to the backend type for badge rendering, we pass it through the chart data and look it up in the tick renderer.

```typescript
// Inside PerformanceCharts -- custom tick for YAxis (pure SVG approach)
// Source: Recharts YAxisTickContentProps type definition (verified from node_modules)

function CustomYAxisTick(props: { x: number; y: number; payload: { value: string }; dataLookup: Map<string, Backend> }) {
  const { x, y, payload, dataLookup } = props
  const backend = dataLookup.get(payload.value)
  const badgeColors = { api: { bg: '#fbefff', text: '#8250df' }, webgpu: { bg: '#ddf4ff', text: '#0969da' }, wasm: { bg: '#dafbe1', text: '#1a7f37' } }
  const badge = backend ? badgeColors[backend] : null
  const badgeLabel = backend === 'api' ? 'API' : backend === 'webgpu' ? 'GPU' : 'WASM'

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-8} y={0} dy={4} textAnchor="end" fontSize={12} fill="#1f2328">
        {payload.value}
      </text>
      {badge && (
        <>
          <rect x={2} y={-7} width={30} height={14} rx={3} fill={badge.bg} />
          <text x={17} y={0} dy={3} textAnchor="middle" fontSize={10} fontWeight={600} fill={badge.text}>
            {badgeLabel}
          </text>
        </>
      )}
    </g>
  )
}
```

**Coordinate layout:** Model name renders at `x={-8}` with `textAnchor="end"` (growing leftward). Badge rect starts at `x={2}` (2px right of tick origin), giving a clear 10px gap. This prevents any overlap between name and badge.

**Recommendation:** Use the pure SVG approach (rect + text) -- it is simpler, has no cross-browser edge cases with foreignObject sizing, and aligns better with Recharts' SVG rendering context. [ASSUMED: Based on common Recharts custom tick patterns]

### Pattern 4: Three-Shade Per-Model Color for Stacked Bars

**What:** For the time breakdown chart, each model's three segments (load, init, generation) use the model's unique color at different opacities.
**When to use:** Time breakdown stacked bar chart only.

```typescript
// Hex to RGBA helper for opacity shades
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Usage in stacked bar Cell fill:
// Load segment:       hexToRgba(modelColor, 1.0)   -- full opacity
// Init segment:       hexToRgba(modelColor, 0.65)  -- 65% opacity
// Generation segment: hexToRgba(modelColor, 0.35)  -- 35% opacity
```

[VERIFIED: UI-SPEC specifies "100% opacity for load, 65% opacity for init, 35% opacity for generation"]

### Pattern 5: Recharts LabelList for Value Labels

**What:** Use Recharts' built-in `<LabelList>` component to display numeric values on or beside bars.
**When to use:** Both charts -- tok/s value on speed bars, total time on the rightmost stacked bar segment.

```typescript
// Source: Recharts LabelList type definition (verified from node_modules/recharts/types/component/LabelList.d.ts)

// Tok/s chart: value label on each bar
<Bar dataKey="tokensPerSecond" name="Tokens/sec" radius={[0, 4, 4, 0]}>
  <LabelList dataKey="tokensPerSecond" position="right" fontSize={12} fill="#1f2328" />
  {speedData.map((entry, i) => (
    <Cell key={i} fill={getModelColor(configs, entry.configId)} />
  ))}
</Bar>

// Time breakdown chart: total time label on the last stacked segment
<Bar dataKey="generationTime" name="Generation" stackId="time" radius={[0, 4, 4, 0]}>
  <LabelList
    dataKey="totalTimeFormatted"
    position="right"
    fontSize={12}
    fill="#1f2328"
  />
  {/* ... Cell elements ... */}
</Bar>
```

[VERIFIED: LabelList exported from recharts, position="right" is a valid LabelPosition]

### Anti-Patterns to Avoid

- **Storing color on TestConfig:** Avoid adding a `color` field to TestConfig. Colors are derived from array index, keeping the data model clean. If configs are reordered, colors stay consistent because `configs` array is append-only during a comparison run.
- **Using `foreignObject` without fallback:** While foreignObject works in target browsers, it can cause layout measurement issues in Recharts. Prefer pure SVG (rect + text) for badge rendering in chart ticks.
- **Backend-based coloring in any new code:** Per D-03, all new visual identity uses per-model colors. Backend type is only shown via text badges.
- **Modifying chart data structure for label display:** Instead of changing the data array shape, use `LabelList` with formatter or a dedicated dataKey for pre-formatted labels.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Value labels on bars | Custom SVG text positioning | Recharts `<LabelList position="right">` | Handles layout, collision avoidance, and alignment automatically |
| CSV generation | Manual string concatenation with edge cases | Existing `formatAsCSV` in exportUtils.ts + column additions | CSV quoting and escaping already handled |
| File download | Custom download logic | Existing `downloadFile()` in exportUtils.ts | Blob + createObjectURL already implemented |
| Color-to-RGBA conversion | CSS custom properties with opacity | Simple `hexToRgba()` utility (4 lines) | SVG fill attributes need inline values, not CSS variables |
| Sort logic | New sort implementation | Existing `getSortValue` + `useMemo` sort in ComparisonTable | Already handles all 11 columns with type-safe comparison |

**Key insight:** 90% of the functionality already exists. The work is surgical refinement, not new construction.

## Common Pitfalls

### Pitfall 1: Recharts Custom Tick Coordinate System

**What goes wrong:** Custom tick function receives `x` and `y` in absolute SVG coordinates, but developers often position children relative to the wrong origin.
**Why it happens:** Recharts applies transforms internally; the `x`/`y` props represent the tick's anchor point in the chart's SVG coordinate space.
**How to avoid:** Always wrap custom tick content in `<g transform={translate(x, y)}>` and position children relative to (0, 0) within that group. Use `textAnchor="end"` for left-aligned Y-axis labels.
**Warning signs:** Labels appear at wrong positions or overlap the chart area.

### Pitfall 2: LabelList on Stacked Bars Shows Per-Segment Values

**What goes wrong:** Adding `<LabelList>` to the last stacked segment shows only that segment's value (generationTime), not the total.
**Why it happens:** LabelList reads from the bar's own dataKey by default.
**How to avoid:** Add a `totalTimeFormatted` field to the data array and use `<LabelList dataKey="totalTimeFormatted">` on the last segment. Alternatively, use a `valueAccessor` or `formatter` prop.
**Warning signs:** Labels show partial times instead of totals.

### Pitfall 3: Error Results Crash Metric Calculations

**What goes wrong:** Error results have `metrics.tokensPerSecond` as 0 and `metrics.totalTime` as 0, which skews min/max calculations and can produce "0 tok/s" as the worst value even when all real runs succeeded.
**Why it happens:** Error results still have a `metrics` object with zero/null values for display purposes.
**How to avoid:** Filter `results.filter(r => !r.error)` before ANY metric calculation -- stat cards, charts, and best/worst highlighting in the table.
**Warning signs:** "Worst" highlighting applied to an error row, "0 tok/s" shown in charts.

### Pitfall 4: Disambiguated Labels Not Reactive

**What goes wrong:** Labels are computed once and become stale when configs change.
**Why it happens:** `getDisambiguatedLabels` is a pure function; if called outside a reactive context (useMemo or selector), it won't update.
**How to avoid:** Always call `getDisambiguatedLabels(configs)` inside a `useMemo` that depends on `configs`, or compute it inside the component render path. Do NOT cache it in the store.
**Warning signs:** Labels show wrong suffixes after adding/removing model configs.

### Pitfall 5: YAxis Width Too Narrow for Name + Badge

**What goes wrong:** Custom Y-axis ticks with model name + badge get clipped because the default YAxis width (60px) or the current 120px is insufficient.
**Why it happens:** Long model names like "SmolLM2-135M-Instruct (Q4)" + badge chip can exceed 150px.
**How to avoid:** Set YAxis `width` dynamically based on the longest label, or use a generous static width (180-200px). Adjust chart margins accordingly.
**Warning signs:** Model names truncated or overlapping the chart area.

### Pitfall 6: Recharts Cell with Dynamic Colors in Stacked Bars

**What goes wrong:** When using `<Cell>` inside stacked `<Bar>` components, the fill is applied per data point but must be different for each stack segment of the same model.
**Why it happens:** Each `<Bar>` in the stack has its own set of `<Cell>` children. The Cell at index `i` in each Bar corresponds to the same model.
**How to avoid:** Use `hexToRgba(modelColor, opacity)` in each Bar's Cell loop: full opacity for load, 0.65 for init, 0.35 for generation. The model color comes from the same index in all three loops.
**Warning signs:** All three stack segments show the same shade, or colors don't match between segments.

## Code Examples

### Error Filtering Pattern (used in ResultsSummary, PerformanceCharts, ComparisonTable best/worst)

```typescript
// Source: D-09, D-10 from CONTEXT.md

// Filter successful results for stat calculations
const successfulResults = results.filter((r) => !r.error)

// In ResultsSummary: use successfulResults for everything
if (successfulResults.length === 0) return null
const modelsCount = successfulResults.length
const totalTime = formatTotalTime(successfulResults)
const fastestOverall = findFastest(successfulResults)

// In ComparisonTable best/worst: compute from successful only
const bestWorst = useMemo(() => {
  const successful = results.filter((r) => !r.error)
  if (successful.length < 2) return { bestTokS: -1, worstTokS: -1, bestTotal: -1, worstTotal: -1 }
  // ... rest unchanged
}, [results])
```

### Export Metadata Enhancement (CSV columns)

```typescript
// Source: D-15, UI-SPEC export metadata contract

// CSV header addition
const header = 'Model,Type,Quantization,Backend,Size (bytes),Load Time (ms),Init Time (ms),TTFT (ms),Tokens/sec,Total Time (ms),Token Count,Rating,Output,Fallback Backend,Error Category,Error Hint,Raw Error'

// Row addition (after existing columns)
const row = [
  // ... existing columns ...
  r.fallbackBackend ?? '',
  r.errorCategory ?? '',
  `"${(r.errorHint ?? '').replace(/"/g, '""')}"`,
  `"${(r.rawError ?? '').replace(/"/g, '""')}"`,
].join(',')
```

### Markdown Export with Errors & Fallbacks Section

```typescript
// Source: D-14, D-15, UI-SPEC export metadata contract

// Change: Markdown now downloads as file instead of clipboard copy
function handleExportMarkdown() {
  const md = formatAsMarkdown(getRun())
  downloadFile(md, 'comparison-results.md', 'text/markdown')
}

// Addition to formatAsMarkdown: after Outputs section
const errorsOrFallbacks = run.results.filter((r) => r.error || r.fallbackBackend)
if (errorsOrFallbacks.length > 0) {
  lines.push('## Errors & Fallbacks', '', '| Model | Error Category | Hint | Fallback |', '|-------|---------------|------|----------|')
  for (const r of errorsOrFallbacks) {
    lines.push(`| ${r.config.displayName} | ${r.errorCategory ?? '--'} | ${r.errorHint ?? '--'} | ${r.fallbackBackend ?? '--'} |`)
  }
}
```

### Shared Component Extraction Pattern

```typescript
// Source: Existing TypeBadge in ComparisonTable/index.tsx and OutputComparison/index.tsx

// src/components/shared/TypeBadge.tsx
import type { Backend } from '../../types'

export function TypeBadge({ type, backend }: { type: string; backend: Backend }) {
  const cls =
    type === 'cloud'
      ? 'bg-cloud-bg text-cloud'
      : backend === 'wasm'
        ? 'bg-wasm-bg text-wasm'
        : 'bg-webgpu-bg text-primary'

  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {type === 'cloud' ? 'cloud' : backend === 'wasm' ? 'local-wasm' : 'local'}
    </span>
  )
}
```

## State of the Art

| Old Approach (current code) | New Approach (this phase) | Impact |
|------------------------------|---------------------------|--------|
| Backend-based bar colors (`BACKEND_COLORS[entry.backend]`) | Per-model colors (`MODEL_COLORS[configIndex]`) | Each model visually distinct regardless of backend |
| Backend-based left borders on output cards | Per-model color borders | Consistent model identity across all views |
| Backend-based row tinting (purple/green bg) | Per-model left-border accent (3px) | Cleaner rows, backend shown via badge instead |
| `BackendLegend` component in charts | Removed (replaced by Y-axis badge chips) | Less visual clutter, info embedded in axis labels |
| Recharts `<Legend>` with backend colors | Simple "Load / Init / Generate" inline legend (time chart only) | Communicates segment meaning, not backend type |
| Markdown export via clipboard (`copyToClipboard`) | File download via `downloadFile()` | All exports consistent: download a file |
| `font-bold` (700) on stat card values | `font-semibold` (600) per UI-SPEC typography | Consistent weight scale |
| `text-[11px]` on various labels | `text-xs` (12px) per UI-SPEC typography | Consistent size scale |
| Duplicate TypeBadge/StarRating in two components | Shared components in `src/components/shared/` | DRY, single source of truth |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pure SVG (rect + text) is better than foreignObject for chart tick badges | Architecture Pattern 3 | Low -- foreignObject also works in target browsers; just a preference for simplicity |
| A2 | Label disambiguation algorithm handles all edge cases with three paths (quant, backend, both) | Architecture Pattern 2 | Medium -- if three configs have same name and two share quantization AND backend, the "both" fallback may produce duplicate labels; needs unit-level verification |
| A3 | YAxis width of 180-200px is sufficient for long model names + badge | Pitfall 5 | Low -- can be adjusted empirically; worst case is a wider margin |
| A4 | Recharts LabelList `position="right"` works correctly with stacked horizontal bars | Pattern 5 | Medium -- if it positions relative to the segment rather than the full stack, a custom `content` renderer may be needed |

## Open Questions (RESOLVED)

1. **LabelList position on stacked bars**
   - RESOLVED: Use `totalTimeFormatted` dataKey on the last stacked segment (generation bar). The `totalTimeFormatted` field is pre-computed in the data array containing the full total time string (e.g. "2.3s"), so even if LabelList reads the segment position, the label text shows the correct total. If label placement (position) is wrong, implement a custom `content` renderer per Pitfall 2.

2. **YAxis width with dynamic label lengths**
   - RESOLVED: Use `width={180}` as the static YAxis width. This accommodates model names up to ~20 characters plus a 30px badge chip. The pure SVG tick approach (name at x=-8 end-anchored, badge rect at x=2) fits within this width. Adjust empirically during implementation if needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | none |
| Quick run command | `npx tsc --noEmit` (type checking only) |
| Full suite command | `npx tsc --noEmit && npx eslint src/` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSLT-01 | Summary stat cards render with error filtering | manual-only | Visual browser test | N/A |
| RSLT-02 | Tok/s chart with per-model colors and value labels | manual-only | Visual browser test | N/A |
| RSLT-03 | Time breakdown chart with three-shade stacked bars | manual-only | Visual browser test | N/A |
| RSLT-04 | Table sortable by all columns | manual-only | Browser interaction test | N/A |
| RSLT-05 | Table rows with per-model left-border accent | manual-only | Visual browser test | N/A |
| RSLT-06 | Best/worst highlighting excludes error results | manual-only | Visual browser test | N/A |
| RSLT-07 | Output cards with all required elements | manual-only | Visual browser test | N/A |
| RSLT-08 | Output cards with per-model color borders | manual-only | Visual browser test | N/A |
| RSLT-09 | Show N more / Show less collapse works | manual-only | Browser interaction test | N/A |
| EXPT-01 | JSON export includes full metadata | manual-only | Download and inspect file | N/A |
| EXPT-02 | CSV export includes error/fallback columns | manual-only | Download and inspect file | N/A |
| EXPT-03 | Markdown export downloads as .md file | manual-only | Download and inspect file | N/A |
| EXPT-04 | All three exports download a file | manual-only | Browser test | N/A |

**Justification for manual-only:** No test framework is installed (per CLAUDE.md/project analysis). All requirements are visual/interaction-based and require a running browser with Recharts rendering. TypeScript type checking (`tsc --noEmit`) validates structural correctness.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (type checking)
- **Per wave merge:** `npx tsc --noEmit && npx eslint src/`
- **Phase gate:** TypeScript clean + visual verification of all 13 requirements in browser

### Wave 0 Gaps

None -- no test framework to set up. Type checking is the automated gate.

## Security Domain

This phase has no security-relevant surface:

| ASVS Category | Applies | Rationale |
|---------------|---------|-----------|
| V2 Authentication | No | No auth in this phase |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No access control |
| V5 Input Validation | No | No user input processed (results are read-only from store) |
| V6 Cryptography | No | No crypto operations |

Export downloads use Blob URLs which are same-origin and sandboxed by the browser. No XSS vector -- all data is serialized from typed objects, not user-provided HTML. Star ratings are bounded integers (1-5) validated by the click handler.

## Sources

### Primary (HIGH confidence)
- Recharts v3.8.1 type definitions (node_modules/recharts/types/) -- LabelList props, YAxis tick types, Bar component
- Project source code (src/components/, src/lib/, src/types/, src/stores/) -- current implementation state
- UI-SPEC (.planning/phases/05-results-export/05-UI-SPEC.md) -- visual contract, color palette, typography
- CONTEXT.md (.planning/phases/05-results-export/05-CONTEXT.md) -- locked decisions D-01 through D-16

### Secondary (MEDIUM confidence)
- [Recharts customization guide](https://recharts.github.io/en-US/guide/customize/) -- custom tick patterns
- [Recharts foreignObject discussion](https://gaurav5430.medium.com/exploring-recharts-using-foreignobject-to-render-custom-html-5c6b75d6207e) -- SVG foreignObject in charts

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified, no new dependencies
- Architecture: HIGH -- patterns derived from existing codebase analysis and verified Recharts type definitions
- Pitfalls: HIGH -- derived from actual Recharts API analysis and code review of current implementation
- Export changes: HIGH -- minimal changes to well-understood existing code

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- no fast-moving dependencies)
