---
phase: 2
slug: model-selection-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (not yet installed — Wave 0 installs) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | MSEL-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | MSEL-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | MSEL-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | MSEL-04 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | MSEL-05 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | MSEL-06 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | MSEL-07 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | MSEL-08 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | STNV-02 | — | API key masking | manual | N/A | — | ⬜ pending |
| 02-03-05 | 03 | 2 | STNV-03 | — | N/A | manual | N/A | — | ⬜ pending |
| 02-03-06 | 03 | 2 | STNV-04 | — | N/A | manual | N/A | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install vitest as dev dependency
- [ ] Create `vitest.config.ts` with React and jsdom setup
- [ ] `src/__tests__/hfSearch.test.ts` — stubs for MSEL-01, MSEL-02
- [ ] `src/__tests__/modelChips.test.ts` — stubs for MSEL-03, MSEL-04, MSEL-05
- [ ] `src/__tests__/cloudModels.test.ts` — stubs for MSEL-06, MSEL-07, MSEL-08

*Existing infrastructure covers Settings requirements (STNV-02..04) — manual verification only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API key show/hide toggle | STNV-02 | UI interaction requires visual check | Navigate to Settings, enter key, toggle visibility |
| Test-connection button | STNV-03 | Requires live API call to provider | Enter valid key, click test, verify success message |
| Provider-gated cloud buttons | STNV-04 | Visual presence check dependent on stored keys | Add API key, return to compare page, verify button appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
