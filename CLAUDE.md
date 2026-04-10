<!-- GSD:project-start source:PROJECT.md -->
## Project

**CompareLocalLLM**

A browser-based POC for comparing local LLM inference (via WebGPU/WASM using transformers.js v4) against cloud models (GPT, Claude, Gemini) side-by-side. Users select multiple models, run the same prompt through all of them, and compare outputs and performance metrics in real time.

**Core Value:** Run LLMs entirely in the browser and benchmark them against cloud APIs — same prompt, side-by-side results, quantitative metrics.

### Constraints

- **Tech stack**: Vite + React 19 + TypeScript + Tailwind CSS v4 + Zustand + Recharts — already established, no changes
- **Browser APIs**: WebGPU (Chrome 113+), WASM (all modern), Cache API — runtime detection required
- **Single worker**: All model operations in one dedicated Web Worker — no multi-worker
- **No backend**: Everything runs client-side, cloud API calls go direct from browser (CORS-dependent)
- **POC scope**: Functional-first, minimal polish, no premature abstraction
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 6.0.2 - Used throughout the application (frontend components, utilities, worker threads)
- JavaScript - Vite configuration and ESLint config
- HTML - Entry point template
## Runtime
- Node.js (development)
- Browser runtime (production) - ES2023 target with DOM APIs
- npm 10+ (inferred from package-lock.json)
- Lockfile: Present (package-lock.json)
## Frameworks
- React 19.2.4 - UI component framework
- React Router 7.14.0 - Client-side routing for multiple pages (/settings, /)
- TailwindCSS 4.2.2 - Utility-first CSS framework
- @tailwindcss/vite 4.2.2 - Vite integration for Tailwind
- Zustand 5.0.12 - Lightweight state management for settings and comparison state
- Recharts 3.8.1 - React components for performance metrics visualization
- No test framework detected (Jest, Vitest, or similar not installed)
- Vite 8.0.4 - Build tool and dev server
- @vitejs/plugin-react 6.0.1 - React fast refresh plugin
- TypeScript compiler (tsc) - Type checking before build
## Key Dependencies
- @huggingface/transformers 4.0.1 - Local LLM inference via ONNX
- ESLint 9.39.4 - JavaScript/TypeScript linting
- @eslint/js 9.39.4 - ESLint recommended config
- @types/react 19.2.14 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions
- @types/node 24.12.2 - Node.js type definitions
- globals 17.4.0 - Global variables for browser environment
## Configuration
- No .env file or environment variables required
- API keys stored in browser localStorage (via Zustand persist middleware)
- No server configuration needed
- `tsconfig.json` - Root configuration that references tsconfig.app.json and tsconfig.node.json
- `tsconfig.app.json` - App-specific settings (ES2023 target, DOM libraries, strict linting)
- `tsconfig.node.json` - Build tool configuration (separate from app)
- `eslint.config.js` - Flat ESLint config with React and TypeScript rules
- `vite.config.ts` - Vite build configuration with React and Tailwind plugins
- Target: `dist/` directory (ignored in ESLint)
- Format: ES modules
## Platform Requirements
- Node.js (recent version with npm)
- Modern browser with WebGPU or WebAssembly support
- TypeScript 6.0.2
- Deployment target: Static hosting (HTML + JS bundle)
- Modern browsers only (Chrome 115+, Firefox 120+, Safari 17+)
- Requires WebGPU or WASM support for local inference
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: PascalCase with `index.tsx` structure (e.g., `NavBar/index.tsx`, `PromptInput/index.tsx`)
- Utility/library files: camelCase (e.g., `cloudApis.ts`, `workerBridge.ts`, `webgpuDetect.ts`)
- Store files: camelCase with `use` prefix (e.g., `useSettingsStore.ts`, `useCompareStore.ts`)
- Hook files: camelCase with `use` prefix (e.g., `useWebGPU.ts`, `useDebouncedValue.ts`)
- Worker files: camelCase with `.worker.ts` suffix (e.g., `inference.worker.ts`)
- Type definition files: lowercase with dot notation (e.g., `worker-messages.ts`, `index.ts`)
- React components and exported functions: PascalCase (e.g., `function NavBar()`, `export function PromptInput()`)
- Hook functions: camelCase with `use` prefix (e.g., `useWebGPU()`, `useDebouncedValue()`)
- Helper/utility functions: camelCase (e.g., `startDownload()`, `startComparison()`, `getWorker()`, `formatSize()`)
- Internal/private functions: camelCase with no special prefix (e.g., `handleWorkerEvent()`, `runCloudModel()`, `detectWebGPU()`)
- Store state and selectors: camelCase (e.g., `prompt`, `parameters`, `configs`, `executionStatus`)
- Constants: camelCase or UPPER_SNAKE_CASE depending on scope (e.g., `defaultParameters`, `sizeMap`)
- React props and state: camelCase (e.g., `disabled`, `isBusy`, `hasConfigs`, `isRunning`)
- UI-related: camelCase (e.g., `webgpuSupported`, `estimatedDownload`)
- Type aliases: PascalCase (e.g., `Quantization`, `Backend`, `CloudProvider`, `ExecutionStatus`)
- Interface names: PascalCase (e.g., `TestConfig`, `TestMetrics`, `TestResult`, `GenerationParameters`)
- Literal union types: lowercase with pipes (e.g., `'idle' | 'downloading' | 'running' | 'complete' | 'error' | 'cancelled'`)
## Code Style
- Tool: None detected in config (relies on TypeScript strict mode)
- Arrow functions preferred for callbacks and event handlers
- Template literals used for dynamic strings (e.g., error messages)
- Implicit type inference used where clear; explicit types for function parameters and returns
- Single quotes used in configuration files (package.json uses quotes for values)
- Tool: ESLint with TypeScript support
- Config file: `eslint.config.js` (flat config format)
- Rules applied:
- `noUnusedLocals: true` - Variables must be used
- `noUnusedParameters: true` - Function parameters must be used
- `noFallthroughCasesInSwitch: true` - Switch cases must have break/return
- `erasableSyntaxOnly: true` - No type-only constructs allowed in JS output
## Import Organization
- No path aliases detected (relative imports used throughout)
- Imports structured as relative paths from current location (e.g., `'../../stores/useCompareStore'`)
## Error Handling
- Try/catch blocks used for async operations (e.g., in `workerBridge.ts` when calling cloud APIs)
- Explicit error message construction with context (e.g., `throw new Error('OpenAI API error: ${res.status} ${err}')`)
- HTTP response status checking before parsing (e.g., `if (!res.ok) { throw new Error(...) }`)
- Error object logging in catch blocks (e.g., `err instanceof Error ? err.message : String(err)`)
- Error display in UI components with specific styling (text-error class applied to error states)
- Errors stored in store as optional `error?: string` field in TestResult
- Worker errors caught and sent as 'error' messages back to main thread
- Error message included in WorkerEvent type
- Main thread converts error messages to TestResult with error field
## Logging
- No logging framework detected
- Comments used to explain business logic rather than debug logging
- Error messages are the primary debugging tool
- Minimal logging in production code
- Focus on meaningful error messages to users
- Performance timing captured with `performance.now()`
## Comments
- Complex business logic explained inline (e.g., comment about Anthropic CORS restrictions in `callAnthropic()`)
- Implementation notes for non-obvious decisions (e.g., comment explaining model config caching in ModelSelector)
- TODO/FIXME comments rare but used for known issues
- JSDoc-style comments used in some cases but not consistently applied
- Not consistently used throughout codebase
- Type annotations rely on TypeScript inference rather than comments
- Parameters and return types explicitly typed in code rather than in JSDoc blocks
## Function Design
- Average function size: 10-30 lines
- Store methods: single responsibility (e.g., `setPrompt()`, `addConfig()`)
- Event handlers: focused on specific action (e.g., `handleWorkerEvent()` dispatches based on event type)
- Destructured object parameters for multiple related values (e.g., `ParamInput` component)
- Type annotations always provided for parameters
- Default values used sparingly (e.g., `delayMs = 300` in `useDebouncedValue`)
- Explicit return types for all functions (even if void)
- No implicit returns of undefined
- Promise-based async functions with explicit Promise<T> typing
## Module Design
- Named exports preferred over default (e.g., `export function NavBar()`, `export const useCompareStore = ...`)
- Single default export in some cases (e.g., `export default function App()`)
- Type exports use `export type` syntax (e.g., `export type Quantization = ...`)
- Not used (imports reference specific files directly)
- Types grouped in dedicated type files (`types/index.ts`, `types/worker-messages.ts`)
## Special Patterns
- Custom hooks extract logic and return values/functions
- Zustand stores used for global state rather than Context API
- Selector pattern used to extract specific store values (e.g., `useCompareStore((s) => s.prompt)`)
- Store created with `create<StateType>()(provider => ({ ... }))`
- Middleware used (e.g., `persist` middleware for settings)
- Store methods follow naming convention: `setX` for setters, `addX`/`removeX` for collection operations
- Props typed with inline type annotations in some cases
- Prop destructuring at function parameter level
- Disabled/enabled state props use boolean naming convention
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Client-side LLM execution using HuggingFace Transformers
- Dual inference path: local models (WebGPU/WASM) and cloud APIs (OpenAI, Anthropic, Google)
- Web Worker thread for heavy inference computation
- State management via Zustand for UI and comparison state
- React Router for multi-page navigation
- Tailwind CSS for styling
## Layers
- Purpose: Render UI and handle user interactions
- Location: `src/components/`, `src/pages/`
- Contains: React components organized by feature (ModelSelector, PromptInput, TestControls, etc.)
- Depends on: Zustand stores, hooks
- Used by: App.tsx router
- Purpose: Centralized state for comparison runs, results, and settings
- Location: `src/stores/`
- Contains: `useCompareStore.ts` (run state), `useSettingsStore.ts` (API keys, WebGPU detection)
- Depends on: Zustand library
- Used by: All components for state access and mutations
- Purpose: Execute local and cloud model inference
- Location: `src/workers/inference.worker.ts`, `src/lib/workerBridge.ts`, `src/lib/cloudApis.ts`
- Contains: Worker thread logic, main-thread bridge, cloud API client calls
- Depends on: @huggingface/transformers, HF Models Hub
- Used by: Components via workerBridge functions
- Purpose: Bridge between main thread and worker, cloud API calls
- Location: `src/lib/workerBridge.ts`, `src/lib/cloudApis.ts`
- Contains: Worker lifecycle management, message event handling, cloud provider adapters
- Depends on: Native fetch API, Zustand stores
- Used by: Components (via TestControls, PromptInput)
- Purpose: Reusable helpers and business logic
- Location: `src/lib/`, `src/hooks/`
- Contains: Model search (hfSearch.ts), WebGPU detection, debouncing, export utilities
- Depends on: HuggingFace API, browser APIs
- Used by: Components and execution layer
## Data Flow
- Download phase: worker posts `download-progress` → store.downloadProgress updated → DownloadProgress UI reflects
- Run phase: worker posts `run-progress` → store.runProgress updated → TestProgress UI reflects
- Results: worker/cloud posts results → store.addResult() → ComparisonTable/OutputComparison render
- API keys stored in useSettingsStore with persist middleware
- Serialized to localStorage automatically
- Hydrated on app initialization
## Key Abstractions
- Purpose: Represents a single model configuration to test
- Examples: `src/types/index.ts`, `src/components/ModelSelector/index.tsx`
- Pattern: Immutable data object defining model ID, backend (webgpu/wasm/api), quantization, provider
- Purpose: Container for a completed model test with metrics and output
- Examples: `src/types/index.ts`, `src/stores/useCompareStore.ts`
- Pattern: Paired with TestConfig, includes metrics (ttft, tokensPerSecond, etc.) and generated output
- Purpose: Message protocol between main thread and worker
- Examples: `src/types/worker-messages.ts`
- Pattern: Tagged unions (discriminated unions) for type-safe messaging
- Purpose: Temperature, maxTokens, topP, repeatPenalty as a single object
- Examples: `src/types/index.ts`, `src/components/PromptInput/index.tsx`
- Pattern: Passed to both local and cloud model inference unchanged
- Purpose: Search result from HuggingFace model hub
- Examples: `src/types/index.ts`, `src/lib/hfSearch.ts`
- Pattern: Contains metadata for filtering and selecting models
## Entry Points
- Location: `src/main.tsx`
- Triggers: HTML body loads this module via index.html script tag
- Responsibilities: Create React root and render App component
- Location: `src/App.tsx`
- Triggers: Rendered by main.tsx
- Responsibilities: Initialize WebGPU detection, set up router, render layout
- `src/pages/ComparePage.tsx`: Main comparison interface, conditional rendering of results
- `src/pages/SettingsPage.tsx`: API key configuration
- Location: `src/workers/inference.worker.ts`
- Triggers: Instantiated by workerBridge.ts on first call to `getWorker()`
- Responsibilities: Listen for worker commands, execute inference, post progress/results
## Error Handling
- Worker errors: caught in worker, posted as error event with message
- Cloud API errors: caught in runCloudModel, added as result with error field
- HF Model Search: caught in ModelSelector useEffect, loading state set to false
- WebGPU detection: wrapped in useEffect, result stored in settingsStore
- `config`: the original test config that failed
- `error`: human-readable error message string
- `metrics`: all null except possibly partial data
- `output`: empty string
## Cross-Cutting Concerns
- Generated models search validated by HuggingFace API (pipelineTag filtering)
- Generation parameters bounded by input[type=number] min/max attributes
- API keys stored raw (validation at cloud API level)
- Cloud APIs: Bearer tokens in Authorization header
- Anthropic: Currently has CORS restrictions (see `src/lib/cloudApis.ts` note)
- All mutations through Zustand store actions (immutable patterns)
- No direct component state mutations affecting comparison logic
- Store subscription via selector pattern prevents re-renders
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
