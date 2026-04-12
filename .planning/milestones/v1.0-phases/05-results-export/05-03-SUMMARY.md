---
phase: 05-results-export
plan: 03
subsystem: export-pipeline
tags: [export, csv, markdown, json, error-metadata, file-download]
dependency_graph:
  requires: [05-01]
  provides: [complete-export-pipeline]
  affects: [ExportBar, exportUtils]
tech_stack:
  added: []
  patterns: [error-metadata-in-exports, markdown-file-download]
key_files:
  created: []
  modified:
    - src/lib/exportUtils.ts
    - src/components/ExportBar/index.tsx
decisions:
  - CSV export extended with 4 error/fallback columns (D-15)
  - Markdown export switched from clipboard to file download (D-14)
  - All three exports now produce file downloads (EXPT-04)
metrics:
  duration: 116s
  completed: "2026-04-11T16:27:51Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 05 Plan 03: Export Pipeline Enhancement Summary

Complete export pipeline with error/fallback metadata in CSV and Markdown, and Markdown switched from clipboard copy to .md file download.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Enhance exportUtils with error/fallback metadata | 9913bd8 | src/lib/exportUtils.ts |
| 2 | Update ExportBar to download Markdown as .md file | 562f49b | src/components/ExportBar/index.tsx |

## What Changed

### Task 1: exportUtils Enhancement (9913bd8)

**CSV format (D-15, EXPT-02):**
- Added 4 new columns to CSV header: Fallback Backend, Error Category, Error Hint, Raw Error
- Each CSV row now includes the corresponding fields from TestResult, with proper quoting/escaping for hint and raw error strings

**Markdown format (D-14, D-15, EXPT-03):**
- Added "Errors & Fallbacks" section after the Outputs section
- Section only appears when at least one result has an error or fallbackBackend
- Table includes Model, Error Category, Hint, and Fallback columns with "--" for missing values

**JSON format (EXPT-01):**
- No changes needed -- formatAsJSON already serializes the full ComparisonRun object via JSON.stringify, which includes all TestResult fields

### Task 2: ExportBar Update (562f49b)

- Replaced `handleCopyMarkdown` with `handleExportMarkdown` that calls `downloadFile()` instead of `copyToClipboard()`
- Changed button label from "Copy as Markdown" to "Export Markdown"
- Removed `copyToClipboard` from imports (no longer used)
- Updated all three button font weights from `font-medium` to `font-semibold` per UI-SPEC typography contract

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npx eslint src/lib/exportUtils.ts src/components/ExportBar/index.tsx` passes clean
- CSV header has 17 columns (13 original + 4 new)
- Markdown has conditional Errors & Fallbacks section
- All three ExportBar buttons use `downloadFile()` -- no clipboard-only functionality remains

## Success Criteria Status

- [x] CSV export includes Fallback Backend, Error Category, Error Hint, Raw Error columns (D-15)
- [x] Markdown export includes Errors & Fallbacks table when applicable (D-15)
- [x] Markdown export downloads as .md file (D-14, EXPT-03)
- [x] All three export buttons produce file downloads (EXPT-04)
- [x] Button labels match UI-SPEC copywriting: "Export Markdown", "Export CSV", "Export JSON"
- [x] No clipboard-only export functionality remains
- [x] Typography uses font-semibold per UI-SPEC

## Self-Check: PASSED

- [x] src/lib/exportUtils.ts exists
- [x] src/components/ExportBar/index.tsx exists
- [x] Commit 9913bd8 exists
- [x] Commit 562f49b exists
