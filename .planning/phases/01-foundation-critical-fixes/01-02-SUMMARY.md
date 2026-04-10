---
phase: 01-foundation-critical-fixes
plan: 02
subsystem: worker
tags: [transformers.js, token-counting, TextStreamer, tokenizer, css-custom-properties]

# Dependency graph
requires: []
provides:
  - Accurate token counting in inference worker via token_callback_function and tokenizer.encode
  - Verified color system CSS custom properties (STNV-05)
affects: [phase-2, phase-5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "token_callback_function for per-token real-time counting in TextStreamer"
    - "tokenizer.encode with add_special_tokens: false for post-generation definitive token count"
    - "CSS custom properties as single source of truth for color system"

key-files:
  created: []
  modified:
    - src/workers/inference.worker.ts

key-decisions:
  - "Use token_callback_function for real-time counting and tokenizer.encode for final metrics (dual approach per D-01, D-02, D-03)"
  - "No JS colors.ts file created -- CSS custom properties sufficient until Phase 5 Recharts integration"

patterns-established:
  - "token_callback_function for accurate per-token callbacks during streaming"
  - "Post-generation tokenizer.encode recount for definitive metrics"

requirements-completed: [FNDN-03, STNV-05]

# Metrics
duration: 1min
completed: 2026-04-10
---

# Phase 1 Plan 2: Token Counting Fix & Color Verification Summary

**Accurate token counting via token_callback_function and tokenizer.encode post-generation recount, with STNV-05 color system verified**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-10T15:14:38Z
- **Completed:** 2026-04-10T15:16:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Fixed systematic token undercounting bug: replaced TextStreamer callback_function chunk counting with token_callback_function per-token counting
- Added post-generation tokenizer.encode recount with add_special_tokens: false for definitive final metrics
- TTFT now measured on first actual token generation (more accurate than first text flush)
- Final tokensPerSecond and tokenCount derived from tokenizer.encode output, not streaming approximation
- Verified color system in index.css satisfies STNV-05 with all required hex values and variants

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix token counting in inference worker** - `83b4613` (fix)
2. **Task 2: Verify color system in index.css** - no commit (verification-only, no files changed)

## Files Created/Modified
- `src/workers/inference.worker.ts` - Fixed token counting: token_callback_function for real-time counting, tokenizer.encode for post-generation recount, callback_function now text-only

## Decisions Made
- Used dual approach: token_callback_function for real-time streaming metrics and tokenizer.encode for definitive post-generation metrics (fulfills D-01, D-02, D-03)
- Added Array.isArray guard on tokenizer.encode result for defensive fallback to streaming count
- Deferred JS colors.ts constants file to Phase 5 when Recharts actually needs JS color values -- CSS custom properties are sufficient now

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated disposing phase postProgress to use finalTokenCount**
- **Found during:** Task 1 (token counting fix)
- **Issue:** The postProgress call in the disposing phase still used raw `tokenCount` instead of the recounted `finalTokenCount`
- **Fix:** Changed `tokenCount` to `finalTokenCount` in the disposing postProgress call
- **Files modified:** src/workers/inference.worker.ts
- **Verification:** All uses of raw tokenCount for metrics replaced with finalTokenCount
- **Committed in:** 83b4613 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Trivial fix ensuring consistency -- disposing phase reports same accurate count as final metrics.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Token counting is now accurate for all downstream consumers (comparison table, charts, export)
- Color system verified as centralized CSS custom properties ready for Phase 5 Recharts integration
- No blockers for subsequent phases

## Self-Check: PASSED

- [x] src/workers/inference.worker.ts exists
- [x] Commit 83b4613 exists in git log
- [x] 01-02-SUMMARY.md exists

---
*Phase: 01-foundation-critical-fixes*
*Completed: 2026-04-10*
