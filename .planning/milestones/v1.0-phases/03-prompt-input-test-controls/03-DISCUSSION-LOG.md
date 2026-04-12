# Phase 3: Prompt Input & Test Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-prompt-input-test-controls
**Areas discussed:** Parameter controls, Estimated time, Section layout, Pre-download filtering

---

## Parameter Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Number inputs (current) | Keep existing simple number inputs in a row below textarea. Minimal, functional. | |
| Sliders + number | Each parameter gets a slider with number input companion. More visual, heavier UI. | |
| Collapsible panel | Parameters hidden behind toggle, shows current values in label. One click to access. | ✓ |

**User's choice:** Collapsible panel
**Notes:** Number inputs only (no sliders), values must persist across page refresh. "Solo number inputs che persistono al refresh della pagina."

---

## Estimated Time

| Option | Description | Selected |
|--------|-------------|----------|
| Skip estimated time | Show only model count + download size. No time estimate. Simpler, more honest for POC. | ✓ |
| Rough heuristic | Rough estimate based on model size and max tokens. Marked as approximate. | |
| Show after first run | No estimate initially, use timing data after first run. Progressive enhancement. | |

**User's choice:** Skip estimated time
**Notes:** Info text shows model count and download size only.

---

## Section Layout

Initial question was about page ordering (Prompt → Models → Controls vs alternatives). User rejected the options to provide a more detailed vision:

**User's input:** The pre-download section should be autonomous and decoupled from the Run button. The pre-download section should show: number of models to download, estimated size in MB/GB based on real weight, and the download button. After starting pre-download, show progress bars (0-100%) following transformers.js events. User must follow download in real-time.

### Download Mode Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Seriale con progress singolo | One model at a time: progress bar for current model + list of queued/completed. Simple, clear. | ✓ |
| Parallelo con progress multipli | All models download simultaneously with concurrent progress bars. Faster but callbacks interleave. | |
| You decide | Claude picks based on transformers.js callback behavior. | |

**User's choice:** Serial with per-model progress
**Notes:** None

### Position Sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Sezione separata sotto i modelli | Dedicated block between ModelSelector and Run. Visually distinct from Run controls. | ✓ |
| Dentro il ModelSelector | Pre-download as footer of ModelSelector component. | |

**User's choice:** Separate section below models
**Notes:** None

---

## Pre-download Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Nascondi sezione | Hide section when all local models cached. Reappear when uncached model added. | |
| Mostra sempre con stato | Section always visible. Shows "All models cached" when nothing to download. Button disabled. | ✓ |
| Solo modelli locali | Visible only when local models selected. Hidden for cloud-only setups. | |

**User's choice:** Always show with status
**Notes:** None

---

## Claude's Discretion

- Visual styling of collapsible panel toggle
- Download progress type extension approach
- Parameter persistence implementation (persist middleware vs store migration)
- Pre-download section behavior with zero local models

## Deferred Ideas

None — discussion stayed within phase scope
