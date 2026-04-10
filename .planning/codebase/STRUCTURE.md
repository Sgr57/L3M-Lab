# Codebase Structure

**Analysis Date:** 2026-04-10

## Directory Layout

```
CompareLocalLLM/
├── src/                           # Application source code
│   ├── main.tsx                   # React app entry point
│   ├── App.tsx                    # Root component with router
│   ├── index.css                  # Global styles (Tailwind imports)
│   ├── components/                # Feature-specific UI components
│   │   ├── ApiKeySettings/        # Cloud API key input form
│   │   ├── ComparisonTable/       # Results table display
│   │   ├── ExportBar/             # Export results controls
│   │   ├── ModelSelector/         # Model search and config selection
│   │   ├── NavBar/                # Navigation bar
│   │   ├── OutputComparison/      # Side-by-side output display
│   │   ├── PerformanceCharts/     # Results visualization (recharts)
│   │   ├── PromptInput/           # Prompt and generation parameter inputs
│   │   ├── ResultsSummary/        # Summary statistics of results
│   │   ├── TestControls/          # Run/cancel/download buttons
│   │   └── TestProgress/          # Real-time progress display
│   ├── pages/                     # Route-level page components
│   │   ├── ComparePage.tsx        # Main comparison UI
│   │   └── SettingsPage.tsx       # Settings page
│   ├── stores/                    # Zustand state management
│   │   ├── useCompareStore.ts     # Comparison runs, results, execution state
│   │   └── useSettingsStore.ts    # API keys, WebGPU support flag
│   ├── lib/                       # Business logic and utilities
│   │   ├── cloudApis.ts           # Cloud provider API clients (OpenAI, Anthropic, Google)
│   │   ├── exportUtils.ts         # Result export to CSV/JSON
│   │   ├── hfSearch.ts            # HuggingFace model search and quantization fetching
│   │   ├── webgpuDetect.ts        # Browser WebGPU capability detection
│   │   └── workerBridge.ts        # Main thread ↔ Worker communication
│   ├── workers/                   # Web Worker code
│   │   └── inference.worker.ts    # Handles model loading and inference execution
│   ├── hooks/                     # Custom React hooks
│   │   ├── useDebouncedValue.ts   # Debounced value hook for search input
│   │   └── useWebGPU.ts           # Hook to detect WebGPU support on mount
│   ├── types/                     # TypeScript type definitions
│   │   ├── index.ts               # Core types (TestConfig, TestResult, etc.)
│   │   └── worker-messages.ts     # Worker message protocol types
│   └── assets/                    # Static assets (icons, images)
├── public/                        # Public assets served at root
├── index.html                     # HTML entry point
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # Root TypeScript config
├── tsconfig.app.json              # App TypeScript config
├── tsconfig.node.json             # Build tools TypeScript config
├── vite.config.ts                 # Vite bundler configuration
├── eslint.config.js               # ESLint rules
└── dist/                          # Build output directory (git-ignored)
```

## Directory Purposes

**src/:**
- Purpose: All TypeScript/React source code
- Contains: Components, stores, utilities, types, workers
- Key files: `main.tsx` (entry), `App.tsx` (router), `index.css` (styles)

**src/components/:**
- Purpose: Reusable UI components organized by feature
- Contains: React components, each in own subdirectory with index.tsx
- Key files: Each component exports a single default component function
- Pattern: `export function ComponentName() { ... }`

**src/pages/:**
- Purpose: Full-page route components
- Contains: Two pages (ComparePage, SettingsPage)
- Key files: Imported in App.tsx routes

**src/stores/:**
- Purpose: Zustand store definitions
- Contains: Two stores for orthogonal state domains
- Key files: `useCompareStore.ts` (execution state), `useSettingsStore.ts` (persistent config)

**src/lib/:**
- Purpose: Reusable business logic separated from components
- Contains: API clients, worker bridge, utilities
- Key files: 
  - `workerBridge.ts`: Main thread orchestration
  - `cloudApis.ts`: OpenAI, Anthropic, Google integration
  - `hfSearch.ts`: HuggingFace Hub model search

**src/workers/:**
- Purpose: Web Worker code (runs in separate thread)
- Contains: Single worker for model inference
- Key files: `inference.worker.ts` is entire worker implementation

**src/hooks/:**
- Purpose: Custom React hooks
- Contains: useWebGPU (browser capability), useDebouncedValue (search debouncing)

**src/types/:**
- Purpose: TypeScript type definitions
- Contains: Domain types (TestConfig, TestResult, GenerationParameters) and worker messages
- Key files: `index.ts` (main domain types), `worker-messages.ts` (worker protocol)

**public/:**
- Purpose: Static assets served at root path
- Contains: favicon, images, etc.

**dist/:**
- Purpose: Build output
- Generated: Yes (by `npm run build`)
- Committed: No (.gitignore excludes)

## Key File Locations

**Entry Points:**
- `index.html`: HTML file that loads the app (references `/src/main.tsx`)
- `src/main.tsx`: React root creation and mounting
- `src/App.tsx`: Router setup and main layout

**Configuration:**
- `package.json`: Dependencies and npm scripts (dev, build, lint, preview)
- `vite.config.ts`: Vite bundler config (React plugin, Tailwind, worker exclusion)
- `tsconfig.json`: References tsconfig.app.json and tsconfig.node.json
- `eslint.config.js`: ESLint configuration

**Core Logic:**
- `src/stores/useCompareStore.ts`: Central comparison state (configs, results, status)
- `src/stores/useSettingsStore.ts`: API keys and WebGPU flag with localStorage persistence
- `src/lib/workerBridge.ts`: Main thread commands to worker, event handlers
- `src/workers/inference.worker.ts`: Model loading and text generation logic
- `src/lib/cloudApis.ts`: OpenAI, Anthropic, Google API client implementations

**Pages:**
- `src/pages/ComparePage.tsx`: Main UI (imports all comparison components)
- `src/pages/SettingsPage.tsx`: API key settings form

**Components:**
- `src/components/ModelSelector/index.tsx`: Search, select models, pick backend/quantization
- `src/components/PromptInput/index.tsx`: Textarea + generation parameter sliders
- `src/components/TestControls/index.tsx`: Run/Download/Cancel buttons
- `src/components/TestProgress/index.tsx`: Real-time progress during run
- `src/components/ComparisonTable/index.tsx`: Results table with metrics
- `src/components/OutputComparison/index.tsx`: Side-by-side model outputs
- `src/components/PerformanceCharts/index.tsx`: Recharts visualizations

## Naming Conventions

**Files:**
- Components: PascalCase (`ModelSelector`, `TestControls`) in directories with `index.tsx`
- Pages: PascalCase with "Page" suffix (`ComparePage.tsx`, `SettingsPage.tsx`)
- Stores: camelCase with "use" prefix and "Store" suffix (`useCompareStore.ts`, `useSettingsStore.ts`)
- Hooks: camelCase with "use" prefix (`useWebGPU.ts`, `useDebouncedValue.ts`)
- Utilities: camelCase with descriptive name (`hfSearch.ts`, `cloudApis.ts`, `workerBridge.ts`)
- Types: `index.ts` for core types, feature-specific names otherwise (`worker-messages.ts`)

**Directories:**
- Components: PascalCase matching component name (`ModelSelector/`, `TestControls/`)
- Logical groupings: camelCase or lowercase (`components/`, `stores/`, `hooks/`, `lib/`, `workers/`, `types/`)

**Code Symbols:**
- Functions: camelCase (`startComparison`, `runCloudModel`, `handleWorkerEvent`)
- React Components: PascalCase (`ModelSelector`, `PromptInput`, `ComparePage`)
- Types/Interfaces: PascalCase (`TestConfig`, `TestResult`, `GenerationParameters`)
- Variables: camelCase (`prompt`, `configs`, `downloadProgress`)
- Constants: UPPER_SNAKE_CASE if module-level (`CLOUD_MODELS`, `BACKEND_OPTIONS` in ModelSelector)

## Where to Add New Code

**New Feature:**
- Page component: `src/pages/NewFeaturePage.tsx`
- Related components: `src/components/FeatureName/index.tsx`
- New store state: Extend `useCompareStore.ts` or create `src/stores/useNewFeatureStore.ts`
- Logic/API integration: `src/lib/newFeatureUtils.ts`
- Tests: Co-located `src/components/FeatureName/index.test.tsx` (if testing is added)

**New Component/Module:**
- Implementation: `src/components/NewComponent/index.tsx` if UI, `src/lib/utils.ts` if business logic
- Exports: Default export function component, named exports for sub-components if needed
- Styling: Inline Tailwind classes (no separate CSS files)

**Utilities:**
- Shared helpers: `src/lib/` directory
- Domain-specific: Create appropriately named file (e.g., `src/lib/metricsCalculation.ts`)
- Generic helpers: Add to existing utility file or new descriptive file

**New Store:**
- Location: `src/stores/useNewFeatureStore.ts`
- Pattern: Follow Zustand with `create` and selector functions
- Persistence: Add persist middleware if data should survive page reload

## Special Directories

**node_modules/:**
- Purpose: npm package installations
- Generated: Yes (by npm install)
- Committed: No (.gitignore)

**dist/:**
- Purpose: Production build output
- Generated: Yes (by vite build)
- Committed: No

**src/assets/:**
- Purpose: Static assets bundled with app
- Generated: No
- Committed: Yes

**public/:**
- Purpose: Static assets served at root (favicon, etc.)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-10*
