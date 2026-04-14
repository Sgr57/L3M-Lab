---
phase: quick-260414-hut
plan: 01
subsystem: inference-worker, error-handling, ui
tags: [onnx-runtime, webgpu, error-classification, retry, worker]
dependency_graph:
  requires: []
  provides: [error-classification-types, retry-ui, local-error-handling]
  affects: [inference.worker.ts, workerBridge.ts, OutputComparison, ComparisonTable, types]
tech_stack:
  added: []
  patterns: [error-classification, retryable-error-pattern]
key_files:
  created: []
  modified:
    - src/types/index.ts
    - src/types/worker-messages.ts
    - src/workers/inference.worker.ts
    - src/lib/workerBridge.ts
    - src/lib/cloudApis.ts
    - src/components/OutputComparison/index.tsx
    - src/components/ComparisonTable/index.tsx
decisions:
  - Renamed CloudErrorCategory to ErrorCategory to unify cloud and local error categories
  - Local errors classified through run-complete path (full TestResult) rather than error event path
  - Retry button re-runs all models (cancelExecution + startComparison) rather than just the failed one
metrics:
  duration: 5m 34s
  completed: 2026-04-14
  tasks: 2/2
  files_modified: 7
---

# Quick Task 260414-hut: Fix ONNX Runtime Errors Summary

Classified two ONNX runtime errors (GatherBlockQuantized session-init failure and DynamicCache sequence-length incompatibility) with user-friendly messages, error category badges, and a Retry button for recoverable errors.

## What Was Done

### Task 1: Add error classification types and worker error detection
**Commit:** 578bfb9

- Renamed `CloudErrorCategory` to `ErrorCategory` and added `session-init` and `model-compat` categories
- Added `retryable?: boolean` field to `TestResult` interface
- Extended `WorkerEvent` error variant with `retryable`, `errorCategory`, `errorHint` optional fields
- Created `classifyLocalError()` helper in inference worker that pattern-matches ONNX error strings:
  - `ERROR_CODE: 9` / `Could not find an implementation for` -> session-init (retryable)
  - `Unable to determine sequence length from the cache` -> model-compat (non-retryable)
  - Anything else -> unknown (retryable)
- Updated both `handleRun` and `handleDownload` catch blocks to use classification
- Updated all `CloudErrorCategory` references to `ErrorCategory` across cloudApis.ts, workerBridge.ts

### Task 2: Propagate error classification through workerBridge and add Retry UI
**Commit:** 6a9e75c

- Updated workerBridge error event handler to propagate `errorCategory`, `errorHint`, `rawError`, `retryable` fields to `TestResult`
- Added "Retry All Models" button in OutputComparison for retryable errors
  - Button calls `cancelExecution()` then `startComparison()` with current prompt/params/configs
  - Disabled during active runs/downloads (prevents double-execution per T-hut-02 threat)
- Added guidance text ("Try removing this model and running again") for non-retryable errors
- Added `session-init: 'Session Failed'` and `model-compat: 'Not Compatible'` labels to ERROR_CATEGORY_LABELS in both OutputComparison and ComparisonTable

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript: `npx tsc --noEmit` passes with zero errors
- ESLint: All modified files pass. Two pre-existing ESLint errors in inference.worker.ts (lines 266, 317) are in unmodified code and out of scope.

## Self-Check: PASSED
