# Phase 5: Results & Export - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can analyze benchmark results through summary stats, charts, sortable tables, and output comparisons — and export everything as JSON, CSV, or Markdown. This phase delivers: verified and refined results display components (ResultsSummary, PerformanceCharts, ComparisonTable, OutputComparison), a complete export pipeline (ExportBar + exportUtils), per-model color identity system, conditional label disambiguation, and error result handling across all views.

All five components and export utilities already exist with substantial functionality. This phase verifies, gap-fills, and refines them — not a build-from-scratch effort.

</domain>

<decisions>
## Implementation Decisions

### Per-Model Color Identity
- **D-01:** Each model config gets a **unique color** assigned when added to the comparison. This color is the model's visual identity throughout the entire UI — ModelSelector chip (left border), chart bars, output card border, table row accent.
- **D-02:** Colors come from a **predefined palette** of visually distinct colors. Palette must support at least 8-10 models without repeating. Color is assigned by index or config ID.
- **D-03:** The unique model color **replaces backend-based coloring** on chart bars, output card left borders, and table row accents. Backend type is communicated via badges/chips instead.

### Conditional Label Disambiguation
- **D-04:** When multiple configs share the same model display name, **append a suffix to disambiguate** — quantization (e.g., "SmolLM2-135M-Instruct (Q4)" vs "(Q8)"), backend (e.g., "(WebGPU)" vs "(WASM)"), or both if needed. Only the minimum differentiating fields are appended.
- **D-05:** When all model display names are already unique, **no suffix is added**. Labels stay clean.
- **D-06:** Disambiguation is computed dynamically based on the current set of configs. A utility function should detect collisions and produce disambiguated labels.

### Backend Type Indication
- **D-07:** Backend type shown as a **small text badge** ("API", "GPU", "WASM") next to model names in the comparison table, output cards, and chart Y-axis labels. Badge uses the established backend colors: purple (#8250df) for API, blue (#0969da) for WebGPU, green (#1a7f37) for WASM.
- **D-08:** In charts: Y-axis displays model name + backend-colored chip. Bars use the unique per-model color. **No chart legend needed** — Y-axis labels + model color identity are sufficient.

### Error Results in Visualizations (RSLT-01 through RSLT-09)
- **D-09:** **Stat cards exclude error results.** Failed models don't count toward "models tested", don't appear in fastest/worst calculations. Only successful runs contribute to summary stats.
- **D-10:** **Charts exclude error results.** Failed models don't appear in tok/s or time breakdown charts. Clean visualization of successful runs only.
- **D-11:** **Comparison table includes error results** as red-tinted rows with "Error" in metric columns. Keeps the full picture of what was attempted. Error category and hint shown inline.

### Chart Readability (RSLT-02, RSLT-03)
- **D-12:** **Value labels displayed on bars.** Tok/s chart shows the numeric value (e.g., "23.4") on or beside each bar. Time breakdown chart shows total time (e.g., "2.3s") at the right end of each stacked bar.
- **D-13:** Charts use **unique per-model colors** on bars with backend-colored chips on Y-axis labels. No backend color legend — the chips provide that info.

### Export (EXPT-01 through EXPT-04)
- **D-14:** **Markdown export downloads as a .md file** (replacing the current clipboard-only behavior). All three formats (JSON, CSV, Markdown) produce a file download. No clipboard copy button.
- **D-15:** **All exports include full metadata:** fallbackBackend, errorCategory, errorHint, rawError, and timestamps. Complete audit trail for developers. JSON gets the full object; CSV adds columns for error/fallback fields; Markdown includes an error/fallback section.

### Results Section Layout
- **D-16:** **Keep current order:** ResultsSummary → PerformanceCharts → ComparisonTable → OutputComparison → ExportBar. Top-down from summary to detail.

### Claude's Discretion
- Color palette selection (specific hex values for the 8-10 model colors, as long as they're visually distinct and don't clash with backend badge colors)
- Exact badge styling (font size, padding, border-radius) — consistent with existing badge patterns in the codebase
- Recharts implementation details for custom Y-axis labels with embedded badge chips
- How to store the color assignment (on TestConfig, or a separate mapping in the store)
- Whether value labels on bars use Recharts `<LabelList>` or custom bar labels

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Results Components (primary targets)
- `src/components/ResultsSummary/index.tsx` — Stat cards with findFastest logic. Needs: error result filtering, per-model color on card accents (if any).
- `src/components/PerformanceCharts/index.tsx` — Recharts bar charts with backend-based Cell colors. Needs: switch to per-model colors, add backend chips to Y-axis labels, add value labels on bars, add total time label, remove backend legend, filter error results.
- `src/components/ComparisonTable/index.tsx` — Sortable table with backend-based row coloring and badges. Needs: switch to per-model color accents, keep error rows with red tint, ensure disambiguated labels.
- `src/components/OutputComparison/index.tsx` — Output cards with backend-based left borders. Needs: switch to per-model color borders, keep error cards, ensure disambiguated labels.
- `src/components/ExportBar/index.tsx` — Three export buttons. Needs: change Markdown from clipboard to file download.

### Export Utilities
- `src/lib/exportUtils.ts` — formatAsMarkdown, formatAsCSV, formatAsJSON, downloadFile, copyToClipboard, buildComparisonRun. Needs: add fallback/error metadata to all formats, change Markdown to use downloadFile instead of copyToClipboard.

### Types & State
- `src/types/index.ts` — TestConfig, TestResult, TestMetrics, ComparisonRun. TestConfig may need a `color` field or color is derived from a palette by index.
- `src/stores/useCompareStore.ts` — Central state with results, configs. May need color assignment logic and a `getDisambiguatedLabel()` selector or utility.

### Page Integration
- `src/pages/ComparePage.tsx` — Renders all results components conditionally. Layout order confirmed as-is.

### Color System
- `src/index.css` — CSS custom properties for backend colors (cloud, webgpu, wasm). Per-model palette will be new JS constants or CSS variables.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ResultsSummary`: Fully functional stat cards with findFastest. Needs error filtering added to the results array before calculations.
- `PerformanceCharts`: Complete Recharts implementation with horizontal bars, Cell coloring, and BackendLegend. Color source changes from BACKEND_COLORS to per-model palette. BackendLegend removed. Custom Y-axis tick renderer needed for badge chips.
- `ComparisonTable`: Complete sortable table with 11 columns, best/worst highlighting, star rating. TypeBadge and BackendBadge sub-components already exist — can be reused for the backend badge approach.
- `OutputComparison`: Complete output cards with collapsible text, error display, star rating, show N more. BORDER_COLORS changes from backend-based to per-model color.
- `ExportBar`: Simple three-button bar. Markdown handler switches from copyToClipboard to downloadFile.
- `exportUtils.ts`: All formatters work. Need to add error/fallback columns to CSV header and rows, add section to Markdown, include fields in JSON (already via TestResult).

### Established Patterns
- Zustand stores with selector pattern for state access
- Color constants defined as Record<Backend, string> — per-model palette will be a different pattern (array or Map)
- TypeBadge/BackendBadge components exist in ComparisonTable and OutputComparison — can be extracted to shared component
- formatBytes/formatMs utility functions exist in ComparisonTable — could be shared with exportUtils

### Integration Points
- `useCompareStore.addConfig()`: Color assignment could happen here when a config is added
- `TestConfig.id`: Unique per config — can be used as key for color mapping
- `configs` array index: Natural source for palette index assignment
- Recharts `<YAxis tick>`: Custom tick component needed for Y-axis label + badge rendering
- Recharts `<LabelList>`: Can render value labels on bars

</code_context>

<specifics>
## Specific Ideas

- User wants the same model with different quantizations to be clearly distinguishable — unique colors + conditional label suffix only when names collide. If all names are unique, no suffix.
- Backend type shown as colored chips (not dots) on chart Y-axis — small badge with text label ("API", "GPU", "WASM") in the backend color
- Charts prioritize model comparison (unique bar colors) over backend grouping — the app's primary use case is comparing individual model performance
- No chart legend — Y-axis labels with backend chips provide all needed context
- All exports produce file downloads — no clipboard-only functionality
- Exports should be complete audit trails with fallback and error metadata for developers

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-results-export*
*Context gathered: 2026-04-11*
