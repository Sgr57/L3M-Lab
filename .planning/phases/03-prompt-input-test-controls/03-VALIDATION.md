---
phase: 3
slug: prompt-input-test-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework detected — Wave 0 installs |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PRMT-01 | — | N/A | manual | Browser test | — | ⬜ pending |
| 03-01-02 | 01 | 1 | PRMT-02 | — | N/A | manual | Browser test | — | ⬜ pending |
| 03-02-01 | 02 | 1 | CTRL-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | CTRL-02 | — | N/A | manual | Browser test | — | ⬜ pending |
| 03-02-03 | 02 | 1 | CTRL-03 | — | N/A | manual | Browser test | — | ⬜ pending |
| 03-02-04 | 02 | 1 | CTRL-04 | — | N/A | manual | Browser test | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install vitest as dev dependency if no test framework detected
- [ ] Create vitest.config.ts with React + jsdom environment
- [ ] Stub test files for testable units (parameter persistence, download progress tracking)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-line textarea resizable | PRMT-01 | Browser UI interaction | Enter multi-line text, drag resize handle |
| Parameters collapsible panel | PRMT-02 | Browser UI interaction | Click toggle, verify expand/collapse |
| Pre-download progress UI | CTRL-01 | Requires WebGPU/WASM browser | Select local models, click Download, observe progress |
| Run comparison execution | CTRL-02 | End-to-end browser test | Click Run, observe sequential model execution |
| Button disable during execution | CTRL-03 | Browser UI state | Start run, verify buttons disabled + cancel available |
| Info text accuracy | CTRL-04 | Browser UI content | Check model count and download size display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
