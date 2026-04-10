# CompareLocalLLM — Compare Page Design Spec

## Context

We want to build a simple React app to test local LLM capabilities in the browser using transformers.js (v4). The app will have multiple test pages, each focused on a single objective. This spec covers the first page: **comparing outputs and performance from different models given the same prompt**.

The key value proposition is being able to run LLMs entirely in the browser, compare them side-by-side, and benchmark them against cloud models (GPT, Claude, Gemini) as a reference point.

## Architecture Overview

### Stack
- **Vite + React + TypeScript**
- **Tailwind CSS** for styling (light mode)
- **Recharts** for dashboard charts
- **@huggingface/transformers** v4 (4.0.x) for local model inference
- **Zustand** for state management (only if needed — e.g. shared state between modular components)
- **React Router** for multi-page navigation
- **Web Worker** for model execution (single dedicated worker)

### Pages
- **Compare** — the main page (this spec)
- **Settings** — API key management for cloud providers
- Future test pages (out of scope)

### Modular Component Architecture

Each UI section is an independent, reusable component that can be composed freely across pages. Components communicate via Zustand stores when shared state is needed, or via props for parent-child relationships.

**Components:**
- `<PromptInput />` — textarea + generation parameters
- `<ModelSelector />` — HuggingFace search + model chips + backend/quant selection
- `<TestControls />` — Pre-Download + Run buttons + info summary
- `<TestProgress />` — progress bar, streaming output, live metrics
- `<ResultsSummary />` — summary stat cards
- `<PerformanceCharts />` — tokens/sec + time breakdown charts
- `<ComparisonTable />` — sortable detailed metrics table
- `<OutputComparison />` — expandable output cards with rating
- `<ExportBar />` — export buttons (JSON, CSV, Markdown)
- `<ApiKeySettings />` — API key management (used in Settings page)

Each component is self-contained with its own types, and can be used independently in future test pages.

### State Management (Zustand)

Zustand stores are used for state shared across components:

- **`useCompareStore`** — prompt, generation params, selected model configs, test results, execution status
- **`useSettingsStore`** — API keys, global preferences (persisted to localStorage)

Components read from stores directly. The Web Worker communicates with the store via dispatched actions from the main thread message handler.

### Key Architecture Decision: Web Worker

All model operations (download, load, inference, dispose) run in a **single dedicated Web Worker**. The main thread handles UI only. Communication via typed `postMessage` protocol.

**Why:** Model loading and inference can take 5-30+ seconds. Without a worker, the UI freezes completely — no progress bars, no streaming output, no cancel button.

**Message protocol (main → worker):**
- `download` — pre-download model files to cache
- `run` — load model, run inference, collect metrics, dispose
- `cancel` — abort current operation

**Message protocol (worker → main):**
- `download-progress` — download percentage per model
- `run-started` — test beginning for a model
- `run-progress` — streaming tokens, live metrics (tok/s, elapsed)
- `run-complete` — final results + metrics for one model
- `all-complete` — all tests finished
- `error` — error with model name and message

## Page Layout (Top to Bottom)

### 1. Navigation Bar
- Logo: "CompareLocalLLM"
- Links: Compare (active), Settings, future test placeholders
- Badge: WebGPU support status detection

### 2. Prompt Section
- **Textarea** — multi-line prompt input
- **Generation parameters** — Temperature (0.7), Max tokens (256), Top-p (0.9), Repeat penalty (1.1). Inline display with editable values.

### 3. Model Selection
- **Search bar** — autocomplete dropdown querying HuggingFace API, filtered for transformers.js-compatible ONNX models. Also accepts direct model IDs (e.g. `onnx-community/SmolLM2-360M-Instruct`).
- **Model chips** — each selected model shows:
  - Model name
  - Quantization tag (q4, q8, fp16, fp32) — selectable per model from available variants
  - Backend tag (WebGPU / WASM) — selectable per model
  - Cache status (✓ cached / ⬇ size to download)
  - Remove button (✕)
- **Cloud models** — appear with dashed border, purple "cloud" tag, and "✓ API key" status. Only visible if corresponding API key is configured in Settings.

Each "test configuration" is the combination of: **model + quantization + backend**.

### 4. Controls
- **Pre-Download Models** button (secondary) — downloads all non-cached models in parallel. Does not load into memory.
- **Run Comparison** button (primary) — executes tests sequentially.
- **Info text** — "N models selected · Est. download: X GB · Est. time: ~Xmin"

### 5. Progress (visible during execution)
- Left-accented section (amber border)
- **Header** — "Running test N/M — Model Name (backend, quant)"
- **Live stats** — Phase (Downloading/Loading/Generating), Tokens count, Speed (tok/s), Elapsed time
- **Progress bar** — overall progress across all models
- **Streaming output** — real-time text generation display

### 6. Results Summary Cards
Four cards in a row:
- Models tested (count)
- Total time
- Fastest overall (model name + tok/s)
- Fastest local (model name + tok/s)

### 7. Charts (2-column grid)
**Tokens/sec chart** — horizontal bar chart, ordered by speed, color-coded:
- Purple = Cloud API
- Blue = Local WebGPU
- Green = Local WASM

**Time Breakdown chart** — stacked horizontal bars showing Load / Init / Generate segments per model. Total time label on the right.

### 8. Detailed Comparison Table
Sortable table with columns:
| Model | Type | Quant | Backend | Size | Load | TTFT | Tok/s | Total | Tokens | Rating |
- Cloud rows: purple tinted background
- WASM rows: green tinted background
- Best values: green text, bold
- Worst values: red text
- Column headers clickable to sort
- TTFT = Time To First Token

### 9. Output Comparison
- **View toggle**: Grid / List
- **List view** (default): expandable cards, one per model
  - Each card shows: model name, type badge, backend/quant info, key metrics (tok/s, tokens, total time)
  - Full response text (collapsible with "Show full response")
  - Star rating (1-5, clickable)
  - Actions: Copy, View raw
- Cards color-coded by border-left: purple (cloud), blue (WebGPU), green (WASM)
- Collapsed indicator for remaining models: "▼ Show N more outputs"

### 10. Export Bar
- Copy as Markdown
- Export CSV
- Export JSON

No persistent storage in the browser. All exports download a file to disk. Each export includes: prompt, parameters, model configs, all metrics, outputs, and ratings.

## Model Execution Flow

### Phase 1: Pre-Download (optional, parallel)
1. User clicks "Pre-Download Models"
2. Worker uses v4 `ModelRegistry` API to check cache status and list required files:
   - `ModelRegistry.is_pipeline_cached(task, modelId)` — check if already downloaded
   - `ModelRegistry.get_pipeline_files(task, modelId)` — list files to download
   - `ModelRegistry.get_available_dtypes(modelId)` — discover quantization options
3. Downloads all non-cached model files in parallel
4. Files are stored in browser Cache API (automatic by transformers.js)
5. Progress shown per model
6. Models are NOT loaded into memory

### Phase 2: Sequential Test Execution
For each selected model configuration (in series):
1. **Load** — `pipeline("text-generation", modelId, { dtype, device })` — measures load time
2. **Init** — warm-up / first token preparation — measures init time
3. **Generate** — `generator(messages, { max_new_tokens, streamer })` — measures:
   - Time to first token (TTFT)
   - Tokens per second (calculated from token count / generation time)
   - Total generation time
   - Total tokens generated
4. **Collect** — gather model file size from cache, memory estimate
5. **Dispose** — `pipeline.dispose()` to free memory
6. **Next model** — proceed to next configuration

### Cloud Model Execution
For cloud models (GPT, Claude, Gemini):
1. Call respective API with same prompt and parameters
2. Measure: TTFT, tokens/sec, total time, total tokens
3. No load/init/size metrics (shown as "—")
4. Executed in the same sequential order as local models

## Metrics Collected

| Metric | Local | Cloud | Description |
|--------|-------|-------|-------------|
| Model size | ✓ | — | File size of ONNX model files |
| Load time | ✓ | — | Time to load model into memory from cache |
| Init time | ✓ | — | Time for model initialization / warm-up |
| TTFT | ✓ | ✓ | Time to first token |
| Tokens/sec | ✓ | ✓ | Generation speed |
| Total time | ✓ | ✓ | End-to-end time for generation |
| Token count | ✓ | ✓ | Number of tokens generated |
| User rating | ✓ | ✓ | Subjective 1-5 star rating |

## Settings Page

Dedicated page for API key management:
- OpenAI API key (for GPT models)
- Anthropic API key (for Claude models)
- Google AI API key (for Gemini models)
- Keys stored in localStorage
- Show/hide toggle for each key
- Test connection button per provider
- Cloud models only appear in Compare page if key is configured

## HuggingFace Model Search

Autocomplete dropdown using HuggingFace API:
- Endpoint: `https://huggingface.co/api/models`
- Filters: `library=transformers.js`, `pipeline_tag=text-generation`
- Display per result: model name, parameter count, downloads, ONNX availability
- Debounced search (300ms)
- Also accepts raw model ID input (paste `onnx-community/...` directly)
- When a model is selected, fetch available quantization variants and show as selectable options

## Data Types

```typescript
interface TestConfig {
  id: string;
  modelId: string;          // HuggingFace model ID
  displayName: string;
  quantization: 'q4' | 'q8' | 'fp16' | 'fp32';
  backend: 'webgpu' | 'wasm' | 'api';
  provider?: 'openai' | 'anthropic' | 'google';
  cloudModel?: string;       // e.g. 'gpt-4o-mini'
}

interface TestResult {
  config: TestConfig;
  metrics: {
    modelSize: number | null;    // bytes
    loadTime: number | null;     // ms
    initTime: number | null;     // ms
    ttft: number;                // ms
    tokensPerSecond: number;
    totalTime: number;           // ms
    tokenCount: number;
  };
  output: string;
  rating: number | null;         // 1-5
  timestamp: number;
}

interface ComparisonRun {
  id: string;
  prompt: string;
  parameters: GenerationParameters;
  configs: TestConfig[];
  results: TestResult[];
  startedAt: number;
  completedAt: number;
}

interface GenerationParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  repeatPenalty: number;
}
```

## Browser Compatibility

- **WebGPU**: Chrome 113+, Edge 113+ (detected at runtime, shown in nav badge)
- **WASM**: All modern browsers
- **Cache API**: All modern browsers (used by transformers.js for model caching)
- **Safari limitation**: ~1GB storage quota per origin — affects larger models

## Visual Design

- **Light mode** — clean white/gray palette following the approved mockup
- **Color coding** consistent throughout:
  - Purple (#8250df) = Cloud API models
  - Blue (#0969da) = Local WebGPU models
  - Green (#1a7f37) = Local WASM models
- **Typography**: System font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Inter)
- **Border radius**: 12px for sections, 8px for inner elements
- **Spacing**: 16-20px section padding, 12-16px between sections

## Pre-Implementation: Figma Design

Before any code is written, the approved design must be translated into a Figma project:

1. **Create a new Figma file** — "CompareLocalLLM"
2. **Define the Design System:**
   - Color tokens: primary blue (#0969da), cloud purple (#8250df), wasm green (#1a7f37), grays, semantic colors (success, warning, error)
   - Typography scale: system font stack, sizes (11px labels, 12px body small, 13px body, 14px input, 17px logo, 22-28px stats)
   - Spacing scale: 4, 8, 12, 16, 20, 24, 32px
   - Border radius: 4px (tags), 8px (inner elements), 12px (sections)
   - Component library: buttons (primary, secondary), chips (model chip variants), badges (type, backend, quant), input fields, cards, table rows
3. **Design the pages:**
   - Compare page — full layout as per approved mockup (light mode)
   - Settings page — API key management
   - States: empty state, loading/progress, results populated, error
4. **Component variants:** each modular component as a Figma component with variants for different states

This Figma file serves as the single source of truth for visual implementation.

## Verification Plan

1. **Model search**: Type a model name, verify HuggingFace results appear in dropdown. Paste a raw model ID, verify it's accepted.
2. **Pre-download**: Select 2 models, click Pre-Download, verify progress shown and files cached (check DevTools > Application > Cache Storage).
3. **Sequential execution**: Run comparison with 2+ local models. Verify they execute one at a time. Verify UI stays responsive during execution.
4. **Metrics accuracy**: Compare reported load time / tok/s with manual DevTools measurements.
5. **Cloud comparison**: Configure an API key in Settings. Verify cloud model appears in model selection. Run comparison including cloud model.
6. **Results display**: Verify all charts render correctly. Verify table sorting works. Verify output cards display full text.
7. **Export**: Test JSON, CSV, and Markdown exports contain all data.
8. **WebGPU fallback**: Test on a browser without WebGPU. Verify WASM backend still works.
