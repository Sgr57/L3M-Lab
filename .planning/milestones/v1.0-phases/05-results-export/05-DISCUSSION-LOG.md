# Phase 5: Results & Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 05-results-export
**Areas discussed:** Error results in visualizations, Export completeness, Chart readability, Results section ordering, Per-model unique colors

---

## Error Results in Stat Cards

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude from stats | Failed models don't count toward stats, don't distort fastest/worst | ✓ |
| Count but skip metrics | Include in count, exclude from fastest/worst calculations | |
| Show both counts | Show "N tested (M failed)" and use only successful for fastest | |

**User's choice:** Exclude from stats
**Notes:** Clean separation — stat cards reflect successful runs only.

---

## Error Results in Charts

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude from charts | Failed models don't appear in charts at all | ✓ |
| Show as empty/grayed bar | Grayed-out placeholder bar with error icon | |
| You decide | Claude picks | |

**User's choice:** Exclude from charts
**Notes:** None

---

## Error Results in Table

| Option | Description | Selected |
|--------|-------------|----------|
| Show with error row | Red-tinted row with "Error" in metric columns | ✓ |
| Exclude from table | Only successful results | |
| Separate error section | Successful in main table, failed below | |

**User's choice:** Show with error row
**Notes:** Keeps full picture of what was attempted.

---

## Markdown Export Format

| Option | Description | Selected |
|--------|-------------|----------|
| Add download + keep clipboard | Two buttons: copy and download | |
| Download only | Replace clipboard with file download | ✓ |
| Clipboard only | Keep current behavior | |

**User's choice:** Download only
**Notes:** Simplifies to one button per format, all produce files.

---

## Export Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include all metadata | Exports include fallback, error, timestamps | ✓ |
| Metrics only | Current scope, no error/fallback details | |
| You decide | Claude picks per format | |

**User's choice:** Yes, include all metadata
**Notes:** Complete audit trail for developers.

---

## Bar Chart Value Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Labels on bars | Numeric values on each bar | ✓ |
| Tooltip only | Hover for values (current) | |
| You decide | Claude picks | |

**User's choice:** Labels on bars
**Notes:** User noted "ricordati che potrebbero esserci modelli con lo stesso nome" — models with same name need disambiguation in labels.

---

## Time Breakdown Total Label

| Option | Description | Selected |
|--------|-------------|----------|
| Label at bar end | Total time at right end of stacked bar | ✓ |
| In tooltip only | Total shown on hover | |
| You decide | Claude picks | |

**User's choice:** Label at bar end
**Notes:** None

---

## Results Section Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current order | Summary → Charts → Table → Outputs → Export | ✓ |
| Charts first | Charts → Summary → Table → Outputs → Export | |
| Table first | Table → Summary → Charts → Outputs → Export | |
| You decide | Claude picks | |

**User's choice:** Keep current order
**Notes:** None

---

## Per-Model Color Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Unique color per config | Each config gets unique color from palette, carried throughout UI | ✓ |
| Backend color + unique accent | Keep backend coloring, add secondary identifier | |
| Backend color only | Current approach, distinguish by label | |

**User's choice:** Unique color per config
**Notes:** User specifically wants model-level comparison, not backend-level grouping. Backend type communicated via badges.

---

## Chart Color Strategy

Discussion was conversational — user asked Claude's opinion on backend colors vs model colors in charts.

**Claude's analysis:** Backend colors give instant local-vs-cloud pattern recognition but lose individual model identity. Per-model colors prioritize model comparison which is the user's primary use case.

**User's decision:** Per-model colors on bars + backend-colored chip on Y-axis labels. No backend color legend.

**User refinement:** Preferred a colored chip with text label ("API", "GPU", "WASM") over a simple colored dot on the Y-axis.

---

## Backend Type in Results

| Option | Description | Selected |
|--------|-------------|----------|
| Small text badge | Badge next to model name in table/cards/charts | ✓ |
| Icon indicator | Small icons for backend type | |
| Only in label when needed | Part of disambiguated label only on collision | |

**User's choice:** Small text badge
**Notes:** None

---

## Chart Legend

| Option | Description | Selected |
|--------|-------------|----------|
| No legend needed | Y-axis labels + model color identity sufficient | ✓ |
| Keep compact backend legend | Explain chip colors below chart | |
| You decide | Claude picks | |

**User's choice:** No legend needed
**Notes:** None

---

## Claude's Discretion

- Color palette hex values (visually distinct, 8-10 colors)
- Badge styling details
- Recharts Y-axis custom tick implementation
- Color storage mechanism (TestConfig field vs store mapping)
- Value label rendering approach (LabelList vs custom)

## Deferred Ideas

None — discussion stayed within phase scope
