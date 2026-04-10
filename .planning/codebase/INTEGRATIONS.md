# External Integrations

**Analysis Date:** 2026-04-10

## APIs & External Services

**Cloud LLM Providers:**
- **OpenAI** - GPT-3.5/GPT-4 inference
  - SDK/Client: Native fetch (no SDK)
  - Auth: API key stored in browser localStorage
  - Endpoint: `https://api.openai.com/v1/chat/completions`
  - Key file: `src/lib/cloudApis.ts` (callOpenAI function)

- **Anthropic** - Claude model inference
  - SDK/Client: Native fetch (no SDK)
  - Auth: API key stored in browser localStorage
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Note: CORS restrictions documented in code - may require server-side proxy for production
  - Key file: `src/lib/cloudApis.ts` (callAnthropic function)
  - Dangerous browser access header: `anthropic-dangerous-direct-browser-access: true`

- **Google AI** - Gemini model inference
  - SDK/Client: Native fetch (no SDK)
  - Auth: API key stored in browser localStorage
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
  - Key file: `src/lib/cloudApis.ts` (callGoogle function)

**Model Discovery:**
- **Hugging Face API** - Model search and metadata
  - SDK/Client: Native fetch (no SDK)
  - Auth: No authentication required
  - Endpoint: `https://huggingface.co/api/models`
  - Used for: Searching text-generation models with ONNX support, fetching available quantizations
  - Key files: `src/lib/hfSearch.ts` (searchModels, fetchAvailableQuantizations functions)
  - Filters: ONNX-tagged, transformers.js-compatible models only

## Data Storage

**Databases:**
- None - No remote database used

**Browser Storage:**
- localStorage - Stores user API keys and application settings
  - Storage key: `compare-llm-settings`
  - Persisted via Zustand persist middleware
  - Key file: `src/stores/useSettingsStore.ts`
  - Data stored:
    - OpenAI API key
    - Anthropic API key
    - Google AI API key
  - Note: Keys are never sent to any server except the respective provider's API

**Model Caching:**
- Cache API (browser) - Stores downloaded ONNX model files
  - Cache name: `transformers-cache` (used by @huggingface/transformers)
  - Used in: `src/workers/inference.worker.ts` for model size estimation
  - Automatic lifecycle managed by @huggingface/transformers library

**File Storage:**
- Local filesystem only - No cloud file storage
- Models downloaded to browser cache API

## Authentication & Identity

**Auth Providers:**
- Custom API key management - No OAuth or third-party auth
- Implementation:
  - Each cloud provider requires a separate API key
  - Keys managed by Zustand store with localStorage persistence
  - Test endpoints available to validate key validity
  - Key validation files: `src/components/ApiKeySettings/index.tsx` (handleTest function)

**API Key Validation:**
- OpenAI: HEAD request to `https://api.openai.com/v1/models`
- Anthropic: POST request to `https://api.anthropic.com/v1/messages` with minimal payload
- Google: GET request to `https://generativelanguage.googleapis.com/v1beta/models`

## Monitoring & Observability

**Error Tracking:**
- None - No error tracking service integrated

**Logs:**
- Console only - Development debugging via console.log (no structured logging)
- No persistent logging

**Performance Metrics:**
- Client-side timing via `performance.now()`
  - Tracked in worker thread: `src/workers/inference.worker.ts`
  - Metrics: Time to First Token (TTFT), tokens per second, total time, token count
  - No server-side analytics

## CI/CD & Deployment

**Hosting:**
- Not configured yet - Application ready for static hosting
- Target: Vercel, Netlify, GitHub Pages, or similar

**CI Pipeline:**
- None detected - No GitHub Actions, CircleCI, or similar

**Build Process:**
- `npm run build`: TypeScript compilation + Vite bundling
  - Outputs to `dist/` directory
  - Can be deployed directly to static hosting

## Environment Configuration

**Required env vars:**
- None - All configuration is client-side and runtime-driven

**Runtime Configuration:**
- API keys: Entered via UI settings page (/settings)
- Stored: Browser localStorage
- Device selection: User selects between WebGPU and WASM at runtime

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Web APIs Used

**Browser APIs:**
- `fetch` API - HTTP requests to cloud APIs and Hugging Face
- `localStorage` - Persistent key-value storage via Zustand
- `Cache API` - Model file caching (`caches.open('transformers-cache')`)
- `Web Workers` - Offload inference to background thread
  - File: `src/workers/inference.worker.ts`
  - Message passing: TypeScript-safe via `src/types/worker-messages.ts`
- `performance.now()` - High-resolution timing

**Advanced Browser Features:**
- **WebGPU** - GPU-accelerated inference (optional, falls back to WASM)
- **WebAssembly** - CPU fallback for inference

## Data Flow Summary

1. **User enters prompt + selects models** → Main thread
2. **Worker downloads/caches models** → Cache API + HF API
3. **Worker runs local inference** → WebGPU/WASM + @huggingface/transformers
4. **Worker runs cloud inference** → Cloud API endpoints (OpenAI/Anthropic/Google)
5. **Results stored locally** → Zustand store (not persisted)
6. **Results displayed** → React components with Recharts

---

*Integration audit: 2026-04-10*
