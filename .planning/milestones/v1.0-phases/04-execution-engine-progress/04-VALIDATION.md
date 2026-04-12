---
phase: 4
slug: execution-engine-progress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (POC — type checking + manual verification) |
| **Config file** | tsconfig.app.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npx eslint .` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npx eslint .`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | EXEC-01 | — | N/A | type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | EXEC-05 | — | N/A | type check + manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | EXEC-06 | — | N/A | type check + manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | EXEC-08 | T-04-01 | API keys stripped from error display | type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | EXEC-02 | — | N/A | type check + manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | EXEC-03 | — | N/A | type check + manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | EXEC-04 | — | N/A | type check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | EXEC-07 | — | N/A | type check + manual | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed for POC scope — type checking via `npx tsc --noEmit` provides automated feedback on every commit.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GPU memory released between runs | EXEC-05 | Requires Chrome DevTools GPU memory monitoring | Open Chrome Task Manager, run 2+ local models sequentially, verify GPU process memory decreases between models |
| WebGPU device loss → WASM fallback | EXEC-06 | Requires triggering actual GPU device loss | Navigate to chrome://gpucrash or call `device.destroy()` in console during model execution, verify fallback banner appears and model retries on WASM |
| Live progress display updates | EXEC-02 | Visual timing verification | Run comparison, observe TestProgress shows model name, phase transitions, token count increases, tok/s updates, elapsed timer counts up |
| Streaming text visible in real-time | EXEC-04 | Visual timing verification | Run local model, verify text appears token-by-token during generation, not as a single block after completion |
| Cloud elapsed timer | EXEC-07 | Visual timing verification | Run cloud model, verify "Waiting for response..." + timer counting up appears during API call |
| CORS vs auth error messages | EXEC-08 | Requires testing with invalid/missing API keys | Test with: bad API key (expect auth error), no API key (expect auth hint), Anthropic without proxy (expect CORS hint) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
