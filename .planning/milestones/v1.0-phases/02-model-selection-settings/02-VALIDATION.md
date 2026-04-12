---
phase: 2
slug: model-selection-settings
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (tsc type-checking + Vite build) |
| **Config file** | `tsconfig.app.json` (strict mode) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run lint && npm run build` |
| **Estimated runtime** | ~10 seconds |

**Justification:** This phase is almost entirely UI component work (chip layout, accordion, visual styling) with two thin data integrations (HF API sizes, Cache API checks). All requirements involve visual rendering, user interaction, or external API calls that cannot be meaningfully unit-tested without a browser environment. The TypeScript compiler (`tsc --noEmit`) validates structural correctness. The linter validates code style. The build validates bundling. Human visual verification in Plan 02-03 covers all interactive behaviors.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + human verification passed
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | MSEL-01, MSEL-02, MSEL-04, MSEL-05, MSEL-06 | T-02-01, T-02-02, T-02-03 | HF API typed extraction, Cache API try/catch | build | `npx tsc --noEmit` | N/A (type-check) | pending |
| 02-01-02 | 01 | 1 | MSEL-06, STNV-02, STNV-03, STNV-04 | T-02-04 | API keys in localStorage (POC accepted) | build+lint | `npx tsc --noEmit && npm run lint` | N/A (type-check) | pending |
| 02-02-01 | 02 | 2 | MSEL-04, MSEL-05 | T-02-05, T-02-06 | React JSX auto-escapes model names | build | `npx tsc --noEmit` | N/A (type-check) | pending |
| 02-02-02 | 02 | 2 | MSEL-07, MSEL-08 | T-02-05 | Custom model ID unvalidated per D-09 | build+lint | `npx tsc --noEmit && npm run lint` | N/A (type-check) | pending |
| 02-03-01 | 03 | 3 | — | — | N/A | build | `npm run build` | N/A (build output) | pending |
| 02-03-02 | 03 | 3 | MSEL-01..08, STNV-02..04 | — | N/A | manual | N/A -- human visual/functional verification | — | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

No Wave 0 needed. This phase uses `tsc --noEmit` and `npm run build` as automated verification, which are already available in the project. No test framework installation required.

**Rationale:** RESEARCH.md concludes that tsc/build is the appropriate verification approach for this UI-heavy phase. All interactive behaviors are covered by human verification in Plan 02-03.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HF search autocomplete shows filtered results | MSEL-01 | Requires browser + live HF API | Type query in search box, verify results appear |
| Search results show all required fields | MSEL-02 | Visual verification of dropdown content | Check model ID, pipeline tag, badges, downloads, likes |
| Two-row chip layout with size/cache/trash | MSEL-04 | Visual/interactive UI check | Add a model, inspect chip rows |
| Quantization options from HF API | MSEL-05 | Requires HF API response | Change quant dropdown, verify options |
| A/B comparison (same model, diff config) | MSEL-06 | Interactive workflow | Add same model twice, change backend/quant |
| Cloud accordion with provider lists | MSEL-07 | Visual/interactive UI check | Open accordion, verify provider groups |
| Cloud chips visually distinct | MSEL-08 | Visual verification | Compare local vs cloud chip styling |
| API key show/hide toggle | STNV-02, STNV-03 | UI interaction requires visual check | Navigate to Settings, enter key, toggle visibility |
| Test-connection button | STNV-04 | Requires live API call to provider | Enter valid key, click test, verify success message |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (tsc/build commands)
- [x] Sampling continuity: every task has automated verification
- [x] Wave 0 not needed (tsc/build already available)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
