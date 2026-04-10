# Architecture

**Analysis Date:** 2026-04-10

## Pattern Overview

**Overall:** Multi-layered React application with client-side inference and cloud API integration

**Key Characteristics:**
- Client-side LLM execution using HuggingFace Transformers
- Dual inference path: local models (WebGPU/WASM) and cloud APIs (OpenAI, Anthropic, Google)
- Web Worker thread for heavy inference computation
- State management via Zustand for UI and comparison state
- React Router for multi-page navigation
- Tailwind CSS for styling

## Layers

**Presentation Layer:**
- Purpose: Render UI and handle user interactions
- Location: `src/components/`, `src/pages/`
- Contains: React components organized by feature (ModelSelector, PromptInput, TestControls, etc.)
- Depends on: Zustand stores, hooks
- Used by: App.tsx router

**State Management Layer:**
- Purpose: Centralized state for comparison runs, results, and settings
- Location: `src/stores/`
- Contains: `useCompareStore.ts` (run state), `useSettingsStore.ts` (API keys, WebGPU detection)
- Depends on: Zustand library
- Used by: All components for state access and mutations

**Inference & Execution Layer:**
- Purpose: Execute local and cloud model inference
- Location: `src/workers/inference.worker.ts`, `src/lib/workerBridge.ts`, `src/lib/cloudApis.ts`
- Contains: Worker thread logic, main-thread bridge, cloud API client calls
- Depends on: @huggingface/transformers, HF Models Hub
- Used by: Components via workerBridge functions

**Integration Layer:**
- Purpose: Bridge between main thread and worker, cloud API calls
- Location: `src/lib/workerBridge.ts`, `src/lib/cloudApis.ts`
- Contains: Worker lifecycle management, message event handling, cloud provider adapters
- Depends on: Native fetch API, Zustand stores
- Used by: Components (via TestControls, PromptInput)

**Utility Layer:**
- Purpose: Reusable helpers and business logic
- Location: `src/lib/`, `src/hooks/`
- Contains: Model search (hfSearch.ts), WebGPU detection, debouncing, export utilities
- Depends on: HuggingFace API, browser APIs
- Used by: Components and execution layer

## Data Flow

**Model Comparison Run Flow:**

1. User enters prompt and selects models (components dispatch to useCompareStore)
2. User clicks "Run Comparison"
3. `startComparison()` in workerBridge resets store state and branches execution
4. Cloud configs execute immediately via `runCloudModel()` in main thread using cloudApis.ts
5. Local configs are batched and sent to worker via `WorkerCommand`
6. Worker receives command in `inference.worker.ts` and iterates through configs
7. For each local config, worker loads pipeline, runs warmup, generates with streaming
8. Worker posts `WorkerEvent` messages (progress, results) back to main thread
9. Main thread handlers in workerBridge update store state
10. Components subscribe to store changes and re-render (using Zustand selectors)
11. Results accumulate in store.results until all models complete
12. Final state: `executionStatus: 'complete'` triggers results display components

**State Updates During Execution:**
- Download phase: worker posts `download-progress` → store.downloadProgress updated → DownloadProgress UI reflects
- Run phase: worker posts `run-progress` → store.runProgress updated → TestProgress UI reflects
- Results: worker/cloud posts results → store.addResult() → ComparisonTable/OutputComparison render

**Settings Persistence:**
- API keys stored in useSettingsStore with persist middleware
- Serialized to localStorage automatically
- Hydrated on app initialization

## Key Abstractions

**TestConfig:**
- Purpose: Represents a single model configuration to test
- Examples: `src/types/index.ts`, `src/components/ModelSelector/index.tsx`
- Pattern: Immutable data object defining model ID, backend (webgpu/wasm/api), quantization, provider

**TestResult:**
- Purpose: Container for a completed model test with metrics and output
- Examples: `src/types/index.ts`, `src/stores/useCompareStore.ts`
- Pattern: Paired with TestConfig, includes metrics (ttft, tokensPerSecond, etc.) and generated output

**WorkerCommand / WorkerEvent:**
- Purpose: Message protocol between main thread and worker
- Examples: `src/types/worker-messages.ts`
- Pattern: Tagged unions (discriminated unions) for type-safe messaging

**GenerationParameters:**
- Purpose: Temperature, maxTokens, topP, repeatPenalty as a single object
- Examples: `src/types/index.ts`, `src/components/PromptInput/index.tsx`
- Pattern: Passed to both local and cloud model inference unchanged

**HFModelResult:**
- Purpose: Search result from HuggingFace model hub
- Examples: `src/types/index.ts`, `src/lib/hfSearch.ts`
- Pattern: Contains metadata for filtering and selecting models

## Entry Points

**Application Root:**
- Location: `src/main.tsx`
- Triggers: HTML body loads this module via index.html script tag
- Responsibilities: Create React root and render App component

**App Component:**
- Location: `src/App.tsx`
- Triggers: Rendered by main.tsx
- Responsibilities: Initialize WebGPU detection, set up router, render layout

**Pages:**
- `src/pages/ComparePage.tsx`: Main comparison interface, conditional rendering of results
- `src/pages/SettingsPage.tsx`: API key configuration

**Worker Entry:**
- Location: `src/workers/inference.worker.ts`
- Triggers: Instantiated by workerBridge.ts on first call to `getWorker()`
- Responsibilities: Listen for worker commands, execute inference, post progress/results

## Error Handling

**Strategy:** Try-catch blocks around async operations with error message propagation to store

**Patterns:**
- Worker errors: caught in worker, posted as error event with message
- Cloud API errors: caught in runCloudModel, added as result with error field
- HF Model Search: caught in ModelSelector useEffect, loading state set to false
- WebGPU detection: wrapped in useEffect, result stored in settingsStore

Error results added to store have:
- `config`: the original test config that failed
- `error`: human-readable error message string
- `metrics`: all null except possibly partial data
- `output`: empty string

## Cross-Cutting Concerns

**Logging:** Console.error only (no structured logging framework detected)

**Validation:** 
- Generated models search validated by HuggingFace API (pipelineTag filtering)
- Generation parameters bounded by input[type=number] min/max attributes
- API keys stored raw (validation at cloud API level)

**Authentication:**
- Cloud APIs: Bearer tokens in Authorization header
- Anthropic: Currently has CORS restrictions (see `src/lib/cloudApis.ts` note)

**State Mutation:**
- All mutations through Zustand store actions (immutable patterns)
- No direct component state mutations affecting comparison logic
- Store subscription via selector pattern prevents re-renders

---

*Architecture analysis: 2026-04-10*
