# Technology Stack

**Project:** L3M Lab
**Researched:** 2026-04-10

## Verdict: Existing Stack Is Solid -- Minor Gaps to Fill

The current stack (React 19 + Vite 8 + TypeScript 6 + Tailwind v4 + Zustand 5 + Recharts 3 + transformers.js v4) is well-chosen and current. There are no stack-level mistakes to fix. The recommendations below focus on **configuration gaps** and **missing supporting pieces** rather than replacements.

---

## Recommended Stack

### Core Framework

| Technology | Installed | Latest | Purpose | Confidence | Why |
|------------|-----------|--------|---------|------------|-----|
| React | ^19.2.4 | 19.2.5 | UI framework | HIGH | React 19 is stable. Patch update only -- no action needed. |
| Vite | ^8.0.4 | 8.0.8 | Build tool / dev server | HIGH | Vite 8 with Rolldown is the current standard. Existing config works but needs COOP/COEP headers (see below). |
| TypeScript | ~6.0.2 | 6.0.2 | Type safety | HIGH | Current. The `~` pin is correct for TypeScript -- minor versions can break. |
| Tailwind CSS | ^4.2.2 | 4.2.2 | Utility-first CSS | HIGH | v4 with Vite plugin is the recommended integration path. Already set up correctly. |

### State Management

| Technology | Installed | Latest | Purpose | Confidence | Why |
|------------|-----------|--------|---------|------------|-----|
| Zustand | ^5.0.12 | 5.0.12 | Global state | HIGH | Perfect fit for this app. Lightweight, works outside React (worker bridge uses `getState()`), persist middleware already used for settings. No alternatives needed. |

### Data Visualization

| Technology | Installed | Latest | Purpose | Confidence | Why |
|------------|-----------|--------|---------|------------|-----|
| Recharts | ^3.8.1 | 3.8.1 | Performance charts | HIGH | Recharts 3 is the latest major. React 19 compatible. Handles bar charts and stacked bars needed for benchmarks. Already specified in requirements. |

### AI / Inference

| Technology | Installed | Latest | Purpose | Confidence | Why |
|------------|-----------|--------|---------|------------|-----|
| @huggingface/transformers | ^4.0.1 | 4.0.1 | Browser-based LLM inference | HIGH | v4 released Feb 2026. Rewrites WebGPU runtime in C++. Supports 200+ architectures, 8B+ parameter models, ~60 tok/s on WebGPU. This IS the library for browser LLM inference with ONNX. |

### Routing

| Technology | Installed | Latest | Purpose | Confidence | Why |
|------------|-----------|--------|---------|------------|-----|
| react-router-dom | ^7.14.0 | 7.14.0 | Client-side routing | HIGH | v7 is current. Note: in v7, `react-router-dom` is a re-export of `react-router` -- either import path works. For a 2-page POC, this is all you need. |

### Dev Tooling

| Technology | Installed | Latest | Purpose | Confidence | Why |
|------------|-----------|--------|---------|------------|-----|
| @vitejs/plugin-react | ^6.0.1 | 6.0.1 | React Fast Refresh for Vite 8 | HIGH | Correct plugin version for Vite 8. |
| ESLint | ^9.39.4 | 9.39.4 | Linting | HIGH | Flat config format, properly set up. |
| typescript-eslint | ^8.58.0 | 8.58.0 | TypeScript ESLint integration | HIGH | Current. |

---

## Critical Configuration Gap: COOP/COEP Headers

**This is the single most important thing missing from the current setup.**

The `vite.config.ts` does NOT set `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. Without these, `SharedArrayBuffer` is unavailable, and ONNX Runtime Web falls back to **single-threaded WASM execution** during development. This means:

- WASM inference will be significantly slower in dev
- Performance benchmarks captured during development will be misleadingly poor

### Fix -- add to vite.config.ts:

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
  },
})
```

**Important:** These headers must also be configured on the production hosting (Vercel/Netlify/static server). Without them, multi-threaded WASM will not work in production either.

**Note on Vite 8 regression:** There is a known Vite 8 issue (#21893) where `server.headers` may not apply to static JS files. If WASM performance is unexpectedly poor, verify the headers are actually being served using browser DevTools Network tab. The issue may be patched in 8.0.8.

---

## Missing: WebGPU TypeScript Types

The `tsconfig.app.json` lists `"lib": ["ES2023", "DOM", "DOM.Iterable"]`. The DOM lib does include `navigator.gpu` types in recent TypeScript versions, but they may be incomplete. The `webgpuDetect.ts` uses `navigator.gpu` which works because transformers.js handles the WebGPU interaction internally.

**Recommendation:** Do NOT add `@webgpu/types` unless you start writing direct WebGPU code. The current detection code (`navigator.gpu?.requestAdapter()`) works fine with the existing DOM types, and transformers.js abstracts all WebGPU calls internally. Adding extra types for unused APIs adds unnecessary complexity.

**Confidence:** HIGH

---

## Libraries NOT Needed (and Why)

| Library | Why You Might Think You Need It | Why You Don't |
|---------|--------------------------------|---------------|
| `@anthropic-ai/sdk` | Anthropic API calls | The direct `fetch` approach in `cloudApis.ts` with `anthropic-dangerous-direct-browser-access: true` is correct for browser use. The SDK adds 100KB+ for one API call. |
| `openai` (npm package) | OpenAI API calls | Same reasoning -- direct `fetch` is simpler and smaller for a POC. The SDK is designed for Node.js; browser use requires extra bundling config. |
| `@google/generative-ai` | Gemini API calls | Direct REST calls work. SDK is unnecessary overhead for a single endpoint. |
| `web-llm` (MLC) | Alternative to transformers.js | Uses different model format (MLC-compiled). Transformers.js v4 with ONNX is the right choice because it works with HuggingFace's vast ONNX model ecosystem. |
| `uuid` | ID generation | Already using `crypto.randomUUID()` which is built into all modern browsers. |
| `date-fns` / `dayjs` | Date formatting | Only one date format needed (ISO in exports). `Date.toISOString()` is sufficient. |
| `clsx` / `tailwind-merge` | Class name management | For a POC with no conditional styling complexity, template literals work fine. Add only if class management becomes painful. |
| `react-hot-toast` / `sonner` | Toast notifications | Not in requirements. Error states are shown inline. |
| `vitest` | Unit testing | Not in scope for POC. Would recommend for a production version, but it is explicitly out of scope here. |

---

## Existing Code Quality Assessment

### Worker Architecture -- GOOD

The single-worker approach (`inference.worker.ts`) with message passing through `workerBridge.ts` is the correct pattern. Key observations:

- Worker is loaded lazily via `new Worker(new URL(...), { type: 'module' })` -- this is the Vite-native way to handle workers with full TS/ESM support.
- `optimizeDeps.exclude: ['@huggingface/transformers']` is required because the library uses dynamic imports and WASM, which Vite's pre-bundling breaks.
- Sequential model execution (not parallel) is correct because models share GPU memory and would OOM or context-switch poorly if run simultaneously.
- Model disposal after each run prevents memory leaks.

### Cloud API Integration -- GOOD WITH CAVEAT

The `cloudApis.ts` direct fetch approach is correct for "bring your own key" browser use. The Anthropic CORS header (`anthropic-dangerous-direct-browser-access: true`) is the officially supported pattern.

**Caveat:** OpenAI and Google APIs generally allow browser CORS, but some endpoints may restrict it. The current implementation will surface these as errors to the user, which is acceptable for a POC.

### State Management -- GOOD

Zustand is used correctly:
- `useCompareStore` for ephemeral run state (no persistence needed)
- `useSettingsStore` with `persist` middleware for API keys in localStorage
- `getState()` calls from outside React (workerBridge) -- this is a key Zustand advantage over Context

### HF Search -- GOOD

The `hfSearch.ts` correctly filters by `onnx,transformers.js` tags and `text-generation` pipeline. The quantization extraction from ONNX filenames covers the common patterns (q4, q8, fp16, fp32).

---

## Version Pinning Strategy

The current `package.json` uses caret ranges (`^`) for all dependencies and tilde (`~`) for TypeScript. This is correct:

| Range | Used For | Rationale |
|-------|----------|-----------|
| `^` (caret) | All runtime + dev deps | Allow minor/patch updates. These libraries follow semver. |
| `~` (tilde) | TypeScript only | TS minor versions can introduce breaking type checks. Tilde restricts to patch updates only. |

**No changes needed.** The `package-lock.json` provides deterministic installs regardless.

---

## Deployment Considerations

### Required Production Headers

Any static hosting must serve these headers for full functionality:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Platform-specific:**
- **Vercel:** `vercel.json` with `headers` config
- **Netlify:** `_headers` file or `netlify.toml`
- **GitHub Pages:** Not possible (no custom headers) -- avoid for this project
- **Cloudflare Pages:** `_headers` file

### Bundle Size

Transformers.js v4 is excluded from Vite optimization and loaded dynamically in the worker. The main thread bundle should be small (React + Zustand + Recharts + Tailwind utilities). No action needed, but monitor Recharts tree-shaking -- import specific chart components, not the barrel export.

---

## Summary: What to Change

| Priority | Change | Why |
|----------|--------|-----|
| **CRITICAL** | Add COOP/COEP headers to `vite.config.ts` | Without these, WASM runs single-threaded and benchmarks are misleading |
| **RECOMMENDED** | Add `worker: { format: 'es' }` to `vite.config.ts` | Explicitly declares ES module workers, matching the `type: 'module'` used in workerBridge |
| **NONE** | Everything else | Stack is current, well-chosen, and properly configured |

---

## Sources

- [@huggingface/transformers npm](https://www.npmjs.com/package/@huggingface/transformers) -- v4.0.1, published April 2026
- [Transformers.js v4 announcement](https://huggingface.co/blog/transformersjs-v4) -- WebGPU runtime rewrite, Feb 2026
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown bundler, March 2026
- [Vite 8 CORS header regression](https://github.com/vitejs/vite/issues/21893) -- server.headers not applied to static JS
- [React 19.2 release](https://react.dev/blog/2025/10/01/react-19-2) -- latest stable
- [Zustand v5 releases](https://github.com/pmndrs/zustand/releases) -- v5.0.12 latest
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- v3.8.1 latest
- [Tailwind CSS v4.2](https://tailwindcss.com/blog/tailwindcss-v4) -- v4.2.2 with Vite plugin
- [Anthropic CORS support](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) -- browser access header
- [WebGPU vs WebASM benchmarks](https://www.sitepoint.com/webgpu-vs-webasm-transformers-js/) -- 3-8x faster with WebGPU
- [SharedArrayBuffer cross-origin isolation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer) -- COOP/COEP requirements
- [Vite worker options](https://vite.dev/config/worker-options) -- worker.format configuration
