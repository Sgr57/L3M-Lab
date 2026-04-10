# Testing Patterns

**Analysis Date:** 2026-04-10

## Test Framework

**Status:** Not Configured
- No test runner detected (Jest, Vitest, Mocha, or other frameworks absent)
- No test configuration files found
- No test command in `package.json` scripts (only `dev`, `build`, `lint`, `preview`)
- No testing libraries in dependencies (no `@testing-library`, `@vitest`, `jest`, etc.)

**Implication:**
The codebase currently lacks automated testing infrastructure. All testing would need to be manual or implemented as part of future development.

**Recommended Approach:**
For a React + TypeScript project with components, stores, and utilities:
- **Unit tests:** Vitest for speed and Vite integration
- **Component tests:** React Testing Library for React components
- **Store tests:** Direct function calls for Zustand stores
- **Integration tests:** Vitest for worker communication and multi-component flows

## Current Testing Gaps

**Unit Testing:**
- No tests for utility functions (`cloudApis.ts`, `workerBridge.ts`, `webgpuDetect.ts`, `hfSearch.ts`, `exportUtils.ts`)
- No tests for store operations (`useCompareStore.ts`, `useSettingsStore.ts`)
- No tests for custom hooks (`useWebGPU()`, `useDebouncedValue()`)

**Component Testing:**
- No tests for React components
- No DOM interaction testing
- No snapshot testing

**Integration Testing:**
- No tests for worker communication flow
- No tests for cloud API integration
- No tests for state management across components

**E2E Testing:**
- Not detected or configured
- Playwright/Cypress setup could be added if needed

## Architecture for Testing

**Testable Components:**

**Pure Functions** (easily testable):
- `src/lib/cloudApis.ts` - API call functions (`callOpenAI()`, `callAnthropic()`, `callGoogle()`)
  - Could be tested with mocked fetch
  - Return type is `Promise<CloudResponse>`
  
- `src/lib/exportUtils.ts` - Data export utilities
  - Pure data transformation functions
  - No external dependencies

- `src/lib/hfSearch.ts` - HuggingFace search
  - Async utility for model search
  - Could be mocked

**Store Logic** (testable without React):
- `src/stores/useCompareStore.ts` - All store methods are direct mutations
  - `setPrompt()`, `addConfig()`, `removeConfig()`, `updateRating()`, `reset()`
  - Can be tested by calling methods and checking state

- `src/stores/useSettingsStore.ts` - Settings persistence
  - `setApiKey()`, `setWebGPUSupported()`
  - Test interaction with persist middleware

**Components** (require React Testing Library):
- `src/components/**/*.tsx` - All components
- Follow pattern: `export function ComponentName()`
- Accept props and use store selectors
- Return JSX

**Hooks** (testable with renderHook):
- `src/hooks/useWebGPU.ts` - WebGPU detection on mount
- `src/hooks/useDebouncedValue.ts` - Debounce utility

**Worker Communication** (requires worker mocking):
- `src/lib/workerBridge.ts` - Handles worker lifecycle
- `src/workers/inference.worker.ts` - Worker implementation
- Testing requires mocking Worker interface

## Testing Strategy

### Unit Tests

**API Functions** (`src/lib/cloudApis.ts`):
```typescript
// Mock fetch and test response handling
describe('cloudApis', () => {
  it('callOpenAI should return CloudResponse on success', async () => {
    // Mock fetch response
    // Call function
    // Assert return value structure
  })

  it('should throw on API error response', async () => {
    // Mock fetch with error status
    // Expect error to be thrown
    // Verify error message includes status
  })
})
```

**Store Functions** (`src/stores/useCompareStore.ts`):
```typescript
// Direct store testing without React
describe('useCompareStore', () => {
  it('should update prompt when setPrompt is called', () => {
    const store = useCompareStore.getState()
    store.setPrompt('test prompt')
    expect(store.getState().prompt).toBe('test prompt')
  })

  it('should add config to list', () => {
    const store = useCompareStore.getState()
    const config: TestConfig = { /* ... */ }
    store.addConfig(config)
    expect(store.getState().configs).toHaveLength(1)
  })
})
```

**Custom Hooks** (use Vitest's renderHook):
```typescript
// Use @testing-library/react's renderHook
describe('useDebouncedValue', () => {
  it('should debounce value updates', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 100),
      { initialProps: { value: 'initial' } }
    )
    
    expect(result.current).toBe('initial')
    
    rerender({ value: 'updated' })
    expect(result.current).toBe('initial')
    
    await waitFor(() => {
      expect(result.current).toBe('updated')
    })
  })
})
```

### Component Tests

**Controlled Components** (accept all props):
```typescript
// Test components that are entirely prop-driven
describe('PromptInput', () => {
  it('should render textarea with prompt value', () => {
    render(<PromptInput />)
    const textarea = screen.getByPlaceholderText(/Enter your prompt/i)
    expect(textarea).toBeInTheDocument()
  })

  it('should disable when status is running', () => {
    // Requires mocking store selector
    render(<PromptInput />)
    // Assert disabled state based on store value
  })
})
```

**Store-Connected Components:**
- Components like `PromptInput`, `TestControls` use Zustand selectors
- Test by mocking `useCompareStore` or `useSettingsStore`
- Example pattern:

```typescript
jest.mock('../../stores/useCompareStore')

describe('TestControls', () => {
  it('should disable run button when no configs', () => {
    (useCompareStore as jest.Mock).mockReturnValue({
      configs: [],
      // ... other state
    })
    render(<TestControls />)
    expect(screen.getByText(/Run Comparison/)).toBeDisabled()
  })
})
```

### Integration Tests

**Worker Communication:**
```typescript
describe('workerBridge', () => {
  it('should handle worker events and update store', async () => {
    // Create mock worker
    // Call startComparison()
    // Trigger worker event
    // Assert store updates
  })

  it('should run cloud models in main thread', async () => {
    // Mock API calls
    // Call startComparison with cloud config
    // Assert results added to store
  })
})
```

## Testing Best Practices for This Codebase

**What to Mock:**
- API calls (fetch to OpenAI, Anthropic, Google)
- Worker instances (for unit testing store bridge without full worker)
- Store selectors in component tests
- HuggingFace API calls

**What NOT to Mock:**
- Zustand store creation and state management (test directly)
- React hooks from react/react-dom (use renderHook)
- Component rendering (use React Testing Library)

**Test Data:**
Create test fixtures for common objects:
```typescript
// tests/fixtures.ts
export const mockTestConfig: TestConfig = {
  id: 'test-1',
  modelId: 'model-123',
  displayName: 'Test Model',
  quantization: 'q4',
  backend: 'webgpu',
}

export const mockTestResult: TestResult = {
  config: mockTestConfig,
  metrics: {
    modelSize: 1024,
    loadTime: 100,
    initTime: 50,
    ttft: 25,
    tokensPerSecond: 40,
    totalTime: 500,
    tokenCount: 200,
  },
  output: 'Generated text',
  rating: null,
  timestamp: Date.now(),
}
```

**Coverage Areas:**
1. **High Priority:**
   - Store mutations (`useCompareStore`, `useSettingsStore`)
   - API call functions (`cloudApis.ts`)
   - Critical business logic (`workerBridge.ts`)

2. **Medium Priority:**
   - Component rendering and interaction
   - Custom hooks
   - Utility functions (`exportUtils.ts`, `hfSearch.ts`)

3. **Lower Priority:**
   - Styling/layout (CSS-in-JS class names)
   - Keyboard accessibility details

## Proposed Testing Setup

**Add these to devDependencies:**
```json
{
  "vitest": "^1.0.0",
  "@vitest/ui": "^1.0.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/jest-dom": "^6.1.0",
  "@testing-library/user-event": "^14.5.0",
  "@types/vitest": "^0.34.0"
}
```

**Create `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

**Add test script to package.json:**
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

**Test File Location Pattern:**
- Place tests co-located with source: `src/stores/__tests__/useCompareStore.test.ts`
- Or in separate test directory: `tests/unit/stores/useCompareStore.test.ts`

## Current Risks Without Testing

**Critical Areas Needing Tests:**
- Store state mutations (could have bugs affecting entire app)
- API integration (external dependencies, auth)
- Worker communication (complex message passing)
- Type safety gaps (runtime validation not caught by TypeScript)

**Manual Testing Workflow:**
Currently all testing is manual through browser interaction. Critical flows to test:
1. Model selection and download
2. Prompt execution with different backends
3. Results display and comparison
4. Settings persistence
5. Error handling for API failures

---

*Testing analysis: 2026-04-10*
