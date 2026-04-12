---
status: partial
phase: 05-results-export
source: [05-VERIFICATION.md]
started: 2026-04-11T18:45:00Z
updated: 2026-04-11T18:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Error result metrics display in OutputComparison
expected: Error result card should NOT show misleading "0.0 tok/s", "0 tokens", "0 ms" metrics in the card header -- metrics div should be hidden when r.error is set
result: [pending]

### 2. File download behavior for all three export buttons
expected: Each button (Export Markdown, Export CSV, Export JSON) should trigger a file download to disk -- no clipboard operations
result: [pending]

### 3. Label disambiguation with duplicate model names
expected: Labels show disambiguation suffix (e.g. "Llama (Q4)" vs "Llama (Q8)") in PerformanceCharts Y-axis, ComparisonTable Model column, and OutputComparison card headers
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
