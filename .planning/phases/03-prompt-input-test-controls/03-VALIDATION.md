---
phase: 3
slug: prompt-input-test-controls
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No unit test framework — `tsc --noEmit` + `npm run build` serve as automated verify |
| **Config file** | `tsconfig.app.json` (strict mode, noUnusedLocals, noUnusedParameters) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` (type-check) + `npm run build` (full build)
- **After every plan wave:** Run `npm run build` + visual browser verification
- **Before `/gsd-verify-work`:** Full build must succeed, all manual checks passed
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PRMT-01, PRMT-02 | T-03-01 | ParamInput min/max attributes | type-check + build | `npx tsc --noEmit && npm run build` | N/A | pending |
| 03-01-02 | 01 | 1 | CTRL-01 | T-03-03 | N/A | type-check + build | `npx tsc --noEmit && npm run build` | N/A | pending |
| 03-02-01 | 02 | 2 | CTRL-01, CTRL-04 | T-03-04 | Download button disabled when busy | type-check | `npx tsc --noEmit` | N/A | pending |
| 03-02-02 | 02 | 2 | CTRL-02, CTRL-03, CTRL-04 | T-03-04 | Run button disabled when busy | type-check + build | `npx tsc --noEmit && npm run build` | N/A | pending |
| 03-02-03 | 02 | 2 | all | — | N/A | checkpoint | Human visual/functional verification | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installation needed.

**Rationale:** This phase is a UI refactor/reorganization of existing functionality. All requirements are UI-behavioral (collapsible panels, button states, layout ordering). The project has no test framework installed, and adding one for this phase would be scope creep. TypeScript strict-mode compilation (`tsc --noEmit`) catches type errors, import mismatches, and unused code. `npm run build` (Vite production build) catches bundling and runtime-detectable issues. The human-verify checkpoint in Plan 02 Task 3 covers all visual/functional requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-line textarea resizable | PRMT-01 | Browser UI interaction | Enter multi-line text, drag resize handle |
| Parameters collapsible panel | PRMT-02 | Browser UI interaction | Click toggle, verify expand/collapse |
| Parameter persistence across refresh | PRMT-02 | Requires localStorage + page reload | Change temperature, refresh, verify value retained |
| Pre-download progress UI | CTRL-01 | Requires WebGPU/WASM browser | Select local models, click Download, observe progress |
| Run comparison execution | CTRL-02 | End-to-end browser test | Click Run, observe sequential model execution |
| Info text: model count + download size, no estimated time | CTRL-03 | Browser UI content | Check model count and download size display; confirm no time estimate shown (per D-10) |
| Button disable during execution | CTRL-04 | Browser UI state | Start run, verify buttons disabled + cancel available |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (`tsc --noEmit` and/or `npm run build`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 gaps — `tsc` and `npm run build` are pre-existing infrastructure
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
