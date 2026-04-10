# Coding Conventions

**Analysis Date:** 2026-04-10

## Naming Patterns

**Files:**
- React components: PascalCase with `index.tsx` structure (e.g., `NavBar/index.tsx`, `PromptInput/index.tsx`)
- Utility/library files: camelCase (e.g., `cloudApis.ts`, `workerBridge.ts`, `webgpuDetect.ts`)
- Store files: camelCase with `use` prefix (e.g., `useSettingsStore.ts`, `useCompareStore.ts`)
- Hook files: camelCase with `use` prefix (e.g., `useWebGPU.ts`, `useDebouncedValue.ts`)
- Worker files: camelCase with `.worker.ts` suffix (e.g., `inference.worker.ts`)
- Type definition files: lowercase with dot notation (e.g., `worker-messages.ts`, `index.ts`)

**Functions:**
- React components and exported functions: PascalCase (e.g., `function NavBar()`, `export function PromptInput()`)
- Hook functions: camelCase with `use` prefix (e.g., `useWebGPU()`, `useDebouncedValue()`)
- Helper/utility functions: camelCase (e.g., `startDownload()`, `startComparison()`, `getWorker()`, `formatSize()`)
- Internal/private functions: camelCase with no special prefix (e.g., `handleWorkerEvent()`, `runCloudModel()`, `detectWebGPU()`)

**Variables:**
- Store state and selectors: camelCase (e.g., `prompt`, `parameters`, `configs`, `executionStatus`)
- Constants: camelCase or UPPER_SNAKE_CASE depending on scope (e.g., `defaultParameters`, `sizeMap`)
- React props and state: camelCase (e.g., `disabled`, `isBusy`, `hasConfigs`, `isRunning`)
- UI-related: camelCase (e.g., `webgpuSupported`, `estimatedDownload`)

**Types:**
- Type aliases: PascalCase (e.g., `Quantization`, `Backend`, `CloudProvider`, `ExecutionStatus`)
- Interface names: PascalCase (e.g., `TestConfig`, `TestMetrics`, `TestResult`, `GenerationParameters`)
- Literal union types: lowercase with pipes (e.g., `'idle' | 'downloading' | 'running' | 'complete' | 'error' | 'cancelled'`)

## Code Style

**Formatting:**
- Tool: None detected in config (relies on TypeScript strict mode)
- Arrow functions preferred for callbacks and event handlers
- Template literals used for dynamic strings (e.g., error messages)
- Implicit type inference used where clear; explicit types for function parameters and returns
- Single quotes used in configuration files (package.json uses quotes for values)

**Linting:**
- Tool: ESLint with TypeScript support
- Config file: `eslint.config.js` (flat config format)
- Rules applied:
  - `js.configs.recommended` - JavaScript best practices
  - `tseslint.configs.recommended` - TypeScript strict checks
  - `reactHooks.configs.flat.recommended` - React Hooks rules
  - `reactRefresh.configs.vite` - React Fast Refresh compatibility

**Strict TypeScript Settings** (from `tsconfig.app.json`):
- `noUnusedLocals: true` - Variables must be used
- `noUnusedParameters: true` - Function parameters must be used
- `noFallthroughCasesInSwitch: true` - Switch cases must have break/return
- `erasableSyntaxOnly: true` - No type-only constructs allowed in JS output

## Import Organization

**Order:**
1. React imports (`import { useState, useEffect } from 'react'`)
2. External library imports (`import { create } from 'zustand'`)
3. Type imports (`import type { TestConfig, GenerationParameters } from '../types'`)
4. Internal imports from lib/utilities (`import { detectWebGPU } from '../lib/webgpuDetect'`)
5. Store/state imports (`import { useCompareStore } from '../stores/useCompareStore'`)
6. Component imports (`import { NavBar } from './components/NavBar'`)

**Path Aliases:**
- No path aliases detected (relative imports used throughout)
- Imports structured as relative paths from current location (e.g., `'../../stores/useCompareStore'`)

## Error Handling

**Patterns:**
- Try/catch blocks used for async operations (e.g., in `workerBridge.ts` when calling cloud APIs)
- Explicit error message construction with context (e.g., `throw new Error('OpenAI API error: ${res.status} ${err}')`)
- HTTP response status checking before parsing (e.g., `if (!res.ok) { throw new Error(...) }`)
- Error object logging in catch blocks (e.g., `err instanceof Error ? err.message : String(err)`)
- Error display in UI components with specific styling (text-error class applied to error states)
- Errors stored in store as optional `error?: string` field in TestResult

**Worker Error Handling:**
- Worker errors caught and sent as 'error' messages back to main thread
- Error message included in WorkerEvent type
- Main thread converts error messages to TestResult with error field

## Logging

**Framework:** Console only
- No logging framework detected
- Comments used to explain business logic rather than debug logging
- Error messages are the primary debugging tool

**Patterns:**
- Minimal logging in production code
- Focus on meaningful error messages to users
- Performance timing captured with `performance.now()`

## Comments

**When to Comment:**
- Complex business logic explained inline (e.g., comment about Anthropic CORS restrictions in `callAnthropic()`)
- Implementation notes for non-obvious decisions (e.g., comment explaining model config caching in ModelSelector)
- TODO/FIXME comments rare but used for known issues
- JSDoc-style comments used in some cases but not consistently applied

**JSDoc/TSDoc:**
- Not consistently used throughout codebase
- Type annotations rely on TypeScript inference rather than comments
- Parameters and return types explicitly typed in code rather than in JSDoc blocks

## Function Design

**Size:** Functions kept relatively small and focused
- Average function size: 10-30 lines
- Store methods: single responsibility (e.g., `setPrompt()`, `addConfig()`)
- Event handlers: focused on specific action (e.g., `handleWorkerEvent()` dispatches based on event type)

**Parameters:**
- Destructured object parameters for multiple related values (e.g., `ParamInput` component)
- Type annotations always provided for parameters
- Default values used sparingly (e.g., `delayMs = 300` in `useDebouncedValue`)

**Return Values:**
- Explicit return types for all functions (even if void)
- No implicit returns of undefined
- Promise-based async functions with explicit Promise<T> typing

## Module Design

**Exports:**
- Named exports preferred over default (e.g., `export function NavBar()`, `export const useCompareStore = ...`)
- Single default export in some cases (e.g., `export default function App()`)
- Type exports use `export type` syntax (e.g., `export type Quantization = ...`)

**Barrel Files:**
- Not used (imports reference specific files directly)
- Types grouped in dedicated type files (`types/index.ts`, `types/worker-messages.ts`)

## Special Patterns

**React Hooks:**
- Custom hooks extract logic and return values/functions
- Zustand stores used for global state rather than Context API
- Selector pattern used to extract specific store values (e.g., `useCompareStore((s) => s.prompt)`)

**Zustand Patterns:**
- Store created with `create<StateType>()(provider => ({ ... }))`
- Middleware used (e.g., `persist` middleware for settings)
- Store methods follow naming convention: `setX` for setters, `addX`/`removeX` for collection operations

**Component Props:**
- Props typed with inline type annotations in some cases
- Prop destructuring at function parameter level
- Disabled/enabled state props use boolean naming convention

---

*Convention analysis: 2026-04-10*
