---
phase: 04-execution-engine-progress
plan: 01
subsystem: data-layer
tags: [types, store, error-handling, cloud-api]
dependency_graph:
  requires: []
  provides: [CloudErrorCategory, CloudApiError, classifyCloudError, fallbackWarning, device-lost-event]
  affects: [04-02, 04-03]
tech_stack:
  added: []
  patterns: [discriminated-union-extension, error-subclass, error-classification]
key_files:
  created: []
  modified:
    - src/types/index.ts
    - src/types/worker-messages.ts
    - src/stores/useCompareStore.ts
    - src/lib/cloudApis.ts
decisions:
  - CloudApiError preserves HTTP status and raw response body for downstream classification
  - classifyCloudError uses TypeError detection for CORS errors per fetch spec behavior
  - Anthropic gets special-case CORS hint due to known browser restrictions
metrics:
  duration: 3m
  completed: "2026-04-11T13:11:55Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 4 Plan 1: Data Layer Foundation Summary

CloudErrorCategory type, CloudApiError error class, classifyCloudError 6-category classifier, and extended TestResult/RunProgress/WorkerEvent/CompareState for Phase 4 execution engine.

## What Was Done

### Task 1: Extend types and store with Phase 4 fields
**Commit:** e6469ae

Extended three files with Phase 4 data contracts:
- **src/types/index.ts**: Added `CloudErrorCategory` union type (cors, auth, rate-limit, timeout, server, unknown). Extended `TestResult` with `fallbackBackend`, `errorCategory`, `errorHint`, `rawError` optional fields. Extended `RunProgress.phase` with `cloud-pending` and `cloud-complete` values.
- **src/types/worker-messages.ts**: Added `device-lost` variant to `WorkerEvent` discriminated union.
- **src/stores/useCompareStore.ts**: Added `fallbackWarning: string | null` state field with `setFallbackWarning` action. Included in `reset()` to ensure clean state on new comparison runs.

### Task 2: Add CloudApiError class and classifyCloudError to cloudApis.ts
**Commit:** 59956d7

Added error infrastructure to `src/lib/cloudApis.ts`:
- **CloudApiError class**: Extends `Error` with `provider`, `status`, and `rawBody` fields. Preserves HTTP context for downstream classification without leaking API keys (Authorization header is never captured).
- **ClassifiedError interface**: Structured return type with `category`, `hint`, `rawError`, `provider`.
- **classifyCloudError function**: Classifies errors into 6 categories by inspecting TypeError (CORS/network), HTTP status codes (401/403 = auth, 429 = rate-limit, 408/504 = timeout, 500+ = server), with fallback to unknown. Anthropic gets CORS-specific hint text.
- **Updated all three cloud API functions** (callOpenAI, callAnthropic, callGoogle) to throw `CloudApiError` instead of plain `Error`, preserving provider name, HTTP status, and raw response body.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` exits with code 0
- All acceptance criteria artifacts verified via grep

## Self-Check: PASSED
