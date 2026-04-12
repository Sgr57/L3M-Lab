---
phase: 1
slug: foundation-critical-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected (no test framework installed) |
| **Config file** | None |
| **Quick run command** | `npx tsc --noEmit` (type-check only) |
| **Full suite command** | `npx tsc --noEmit && npx vite build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx vite build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FNDN-01 | — | COOP/COEP headers improve security | manual-only | Open browser console, check `crossOriginIsolated === true` | N/A | ⬜ pending |
| 1-01-02 | 01 | 1 | FNDN-02 | — | N/A | config-check | `grep -q "format.*es" vite.config.ts` | N/A | ⬜ pending |
| 1-02-01 | 02 | 1 | FNDN-03 | — | N/A | manual-only | Run generation, compare displayed count with `tokenizer.encode(output).length` | N/A | ⬜ pending |
| 1-02-02 | 02 | 1 | FNDN-04 | — | N/A | manual-only | Visual check: NavBar WebGPU badge present | N/A | ⬜ pending |
| 1-02-03 | 02 | 1 | STNV-01 | — | N/A | manual-only | Visual check: NavBar shows name, links, badge | N/A | ⬜ pending |
| 1-02-04 | 02 | 1 | STNV-05 | — | N/A | config-check | `grep -q "#8250df" src/index.css && grep -q "#0969da" src/index.css && grep -q "#1a7f37" src/index.css` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No test framework installed. Phase 1 scope is config-level and worker-internal changes. All validation is manual or via build/type-check commands. Installing Vitest is out of Phase 1 scope.*

*Existing infrastructure covers all phase requirements via type-check and build validation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| crossOriginIsolated is true | FNDN-01 | Requires running browser with dev server | Start `npm run dev`, open Chrome console, run `crossOriginIsolated` |
| Token count matches tokenizer output | FNDN-03 | Requires actual model inference in browser | Run a generation, compare displayed token count with manual `tokenizer.encode()` call |
| NavBar displays correctly | FNDN-04, STNV-01 | Visual UI check | Start dev server, verify NavBar shows logo, links, WebGPU badge |
| Color constants centralized | STNV-05 | CSS custom property check | Verify `index.css` @theme block contains correct hex values |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending