# Quick Task 260413-p3d: UI/UX Fixes — Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Task Boundary

5 issues to fix:
1. Add "Delete All" button on models page to clear all models at once
2. Replace browser alert with custom Tailwind confirmation modal when deleting a model
3. Fix quantization dropdown losing options when navigating away and back to Compare page
4. Fix cache status not refreshing after model download completes (forces manual page refresh)
5. Persist last prompt, selected models, and generation parameters across page refreshes

</domain>

<decisions>
## Implementation Decisions

### Delete-All UX
- Top-right danger button in model list header area, next to existing controls
- Red/danger styling to signal destructive action
- Must use the new confirm modal (issue #2) before executing

### Confirm Modal
- Custom Tailwind modal component — no external deps
- Matches existing app design language
- Reusable for both single-delete and delete-all confirmations
- Accessible (focus trap, escape to close, backdrop click to close)

### Persistence Scope
- Persist prompt text, selected model configs, AND generation parameters
- Use Zustand persist middleware (already used by useSettingsStore)
- Extend useCompareStore with persist middleware

</decisions>

<specifics>
## Specific Ideas

- Issue #3 (quantization dropdown): likely state reset on component unmount — need to investigate if options are fetched or derived from config
- Issue #4 (cache status): likely race condition between worker completion event and Cache API query — may need to add explicit cache re-check after download-complete event
- Issue #5 (persistence): useCompareStore already holds prompt/configs/parameters — adding persist middleware is the natural path

</specifics>
