# Phase 4: Execution Engine & Progress - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 04-execution-engine-progress
**Areas discussed:** Progress granularity, GPU failure UX, Cloud execution feedback, Error presentation

---

## Progress Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted phases | Each model gets equal slice; within slice: load=10%, init=10%, generate=80% (token-based). Smooth visual feedback. | :heavy_check_mark: |
| Per-model steps only | Progress jumps at model boundaries (33%->66%->100%). Simple, no within-model smoothing. | |
| Token-based smooth | Overall progress = total tokens / estimated total tokens. Smoothest but can overshoot. | |

**User's choice:** Weighted phases (Recommended)
**Notes:** Generating phase tracks token progress against maxTokens for smooth movement within the 80% slice.

### Follow-up: Cloud models in progress bar

| Option | Description | Selected |
|--------|-------------|----------|
| Include cloud models | Cloud models get their own progress slice; fills instantly when response arrives | :heavy_check_mark: |
| Local models only | Progress bar only tracks local model execution | |

**User's choice:** Include cloud models (Recommended)

---

## GPU Failure UX

| Option | Description | Selected |
|--------|-------------|----------|
| Warning + auto-fallback | Show warning banner, auto-retry failed model on WASM, continue remaining on WASM | :heavy_check_mark: |
| Skip failed + fallback rest | Mark failed model as error, switch remaining to WASM, no retry | |
| Stop and ask user | Pause execution, show failure, ask user to retry/skip/cancel | |

**User's choice:** Warning + auto-fallback (Recommended)
**Notes:** Banner persists until run completes. Results show original backend + fallback note.

### Follow-up: Fallback noted in results

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, mark in results | TestResult gets fallbackBackend field, UI shows "WebGPU -> WASM" | :heavy_check_mark: |
| No, just run on WASM | Silently switch, results show WASM as backend | |

**User's choice:** Yes, mark in results (Recommended)

---

## Cloud Execution Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Live timer | Model name + "Waiting for response..." + elapsed timer (100ms updates) | :heavy_check_mark: |
| Spinner only | Model name + animated spinner, no timer | |
| You decide | Claude picks best approach | |

**User's choice:** Live timer (Recommended)
**Notes:** Reuses TestProgress component layout. Timer updates via setInterval.

---

## Error Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Categorized + hint | Classify errors (CORS, auth, rate limit, timeout), show actionable hint + collapsible raw details | :heavy_check_mark: |
| Raw error with context | API error as-is with provider name and HTTP status prefix | |
| You decide | Claude picks best approach | |

**User's choice:** Categorized + hint (Recommended)
**Notes:** Categories: CORS blocked, auth failed, rate limited, timeout, unknown. Raw error in collapsible section.

### Follow-up: Error layout

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in results | Error results appear in same list as successful results, execution order, red-tinted card | :heavy_check_mark: |
| Separate section | Errors grouped in dedicated section above/below results | |

**User's choice:** Inline in results (Recommended)

---

## Claude's Discretion

- HTTP status code ranges for error classification
- Exact phase weights (10/10/80 guideline)
- WebGPU device loss detection mechanism
- GPU memory cleanup delays between models
- Cloud timer implementation approach

## Deferred Ideas

None — discussion stayed within phase scope
