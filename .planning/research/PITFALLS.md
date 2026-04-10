# Domain Pitfalls

**Domain:** Browser-based LLM inference comparison tool
**Stack:** transformers.js v4, WebGPU/WASM, Web Workers, HuggingFace API, Cloud APIs (OpenAI, Anthropic, Google)
**Researched:** 2026-04-10

---

## Critical Pitfalls

Mistakes that cause tab crashes, broken features, or require architectural rewrites.

---

### Pitfall 1: GPU Memory Leak on Sequential Model Runs

**What goes wrong:** The app loads model A with WebGPU, runs inference, calls `dispose()`, then loads model B. But GPU buffers from model A are not fully released by `dispose()` alone. After 3-5 sequential models, ~1 GiB of GPU memory accumulates and the browser tab crashes with a `GPUOutOfMemoryError`. The user sees a frozen or killed tab with no error message.

**Why it happens:** JavaScript garbage collection has no jurisdiction over `GPUBuffer` and `GPUTexture` allocations. `pipeline.dispose()` in transformers.js releases the ONNX session but may not reclaim all underlying WebGPU buffers, especially when the ONNX Runtime WebGPU execution provider holds internal caches. Chrome caps per-tab VRAM at roughly 4 GB.

**Existing code exposure:** `inference.worker.ts` lines 152-225 -- the `runSingleModel` function creates a pipeline, runs inference, and disposes. But between sequential models there is no verification that GPU memory was actually freed, no delay for GC, and no memory budget check before loading the next model.

**Consequences:** Tab crash mid-comparison run. User loses all results. No recovery path. Especially bad with the "compare 4+ models" use case.

**Prevention:**
- After `generator.dispose()`, insert a small async delay (`await new Promise(r => setTimeout(r, 100))`) to give the GPU process time to reclaim buffers.
- Before loading each model, check `navigator.gpu.requestAdapter()` availability (if it returns null, GPU process may have crashed).
- Add a try/catch around each model run that posts an error event rather than crashing the entire worker.
- Consider terminating and re-creating the Web Worker between models as a nuclear option for guaranteed cleanup (worker termination releases all GPU contexts).
- Limit WebGPU models to those under ~2B parameters / 2 GB quantized weight size.

**Detection (warning signs):**
- Chrome DevTools > Performance Monitor shows GPU memory climbing but never dropping between runs.
- `chrome://gpu` shows increasing "Video Memory Usage" across model runs.
- Tab becomes sluggish before eventual crash.

**Phase relevance:** Must be addressed in the phase that implements sequential test execution.

---

### Pitfall 2: OpenAI API CORS Is Unreliable from Browser

**What goes wrong:** The current `cloudApis.ts` makes direct `fetch()` calls to `api.openai.com/v1/chat/completions`. OpenAI's CORS support exists but has been intermittently broken (confirmed outages in Oct 2025 and Jan 2026 lasting hours). When CORS breaks, all OpenAI comparisons fail simultaneously with opaque network errors.

**Why it happens:** OpenAI does support CORS (returning `access-control-allow-origin: null`), but this support is not officially documented, not guaranteed, and has broken multiple times. The `dangerouslyAllowBrowser` flag in their SDK is a client-side check only -- it doesn't control server-side CORS headers. Unlike Anthropic's explicit `anthropic-dangerous-direct-browser-access` header, OpenAI has no contract with developers about browser access.

**Existing code exposure:** `cloudApis.ts` lines 14-49 -- direct fetch to OpenAI with no fallback, no CORS error detection, and generic error handling that won't distinguish CORS failures from auth failures.

**Consequences:** Users add their OpenAI API key, run a comparison, and get a cryptic error. They assume their key is wrong. The app looks broken for the most popular cloud provider.

**Prevention:**
- Detect CORS errors specifically (they produce `TypeError: Failed to fetch` with no response body) and show a distinct error message: "OpenAI is currently blocking browser requests. This is a known intermittent issue."
- Document that OpenAI browser access is best-effort and may require a proxy for reliability.
- Consider adding an optional CORS proxy configuration in Settings for users who hit this.
- For the POC scope, accept the risk but surface clear messaging when it fails.

**Detection:**
- `fetch()` rejects with TypeError and `response` is undefined (not an HTTP error status).
- No `res.ok` check is reached -- the promise itself rejects.

**Phase relevance:** Must be addressed when implementing cloud API result handling and error states.

---

### Pitfall 3: WebGPU Device Loss Without Recovery

**What goes wrong:** During inference, the GPU driver crashes or Chrome's GPU watchdog kills the process (happens if a shader takes >10 seconds). The `GPUDevice.lost` promise resolves, but transformers.js/ONNX Runtime does not expose this to the caller. The pipeline call hangs or throws an opaque error. If this happens 3-6 times within 5 minutes, Chrome permanently disables WebGPU for the session.

**Why it happens:** WebGPU devices can be lost for many reasons: driver updates, resource pressure, long-running compute shaders, browser resource management. Large model inference (especially unquantized) can trigger Chrome's GPU process watchdog. After repeated crashes, Chrome stops returning adapters entirely.

**Existing code exposure:** The worker has no `device.lost` listener, no adapter health check, and no concept of "WebGPU is no longer available." If device loss occurs mid-run, the pipeline throws and the error handler posts a generic error message.

**Consequences:** After a WebGPU crash, subsequent models in the queue also fail. The user has no idea WebGPU is gone. The "WebGPU support badge" in the nav still shows green. Only a full browser restart recovers.

**Prevention:**
- Before each WebGPU pipeline creation, verify adapter availability: `const adapter = await navigator.gpu?.requestAdapter(); if (!adapter) { /* fall back to WASM */ }`.
- After a WebGPU error, automatically retry the model with WASM backend and inform the user.
- Track consecutive WebGPU failures; after 2, switch remaining queued models to WASM proactively.
- Update the WebGPU badge to reflect runtime state, not just initial capability detection.

**Detection:**
- Pipeline creation throws with "Can't create a session" or similar ONNX errors.
- `navigator.gpu.requestAdapter()` returns `null` when it previously returned an adapter.

**Phase relevance:** Should be addressed alongside the execution engine and model configuration phases.

---

### Pitfall 4: Token Counting in TextStreamer Does Not Count Tokens

**What goes wrong:** The current code increments `tokenCount` once per `callback_function` invocation on the TextStreamer. But the TextStreamer callback fires per decoded text chunk, not per token. Multi-byte tokens, special tokens, and BPE merges mean one callback may represent multiple tokens or partial tokens. The reported "tokens per second" metric is wrong.

**Why it happens:** `TextStreamer` decodes token IDs to text and calls the callback with the decoded string. It may batch multiple tokens into a single callback (especially for whitespace-adjacent tokens) or split a single multi-byte character across callbacks. The callback is a text-streaming mechanism, not a token-counting mechanism.

**Existing code exposure:** `inference.worker.ts` lines 173-188 -- `tokenCount++` inside the TextStreamer callback. This overcounts or undercounts actual tokens, making the tok/s metric unreliable and comparisons between models meaningless.

**Consequences:** The core performance metric (tok/s) that users rely on for comparison is inaccurate. Results cannot be trusted for benchmarking decisions.

**Prevention:**
- Use the `output_token_ids` from the pipeline result (if available in v4) to get accurate token counts.
- Alternatively, count tokens by accessing `generator.tokenizer.encode(streamedText)` after generation completes, using the output text length.
- For cloud APIs, use the `usage.completion_tokens` field (already done correctly in `cloudApis.ts`).
- If real-time tok/s display during streaming is needed, treat the TextStreamer count as an approximation and recalculate the final metric from actual token count after generation completes.

**Detection:**
- Compare reported token count with manual tokenizer encode of the output text.
- tok/s numbers that seem unreasonably high or vary wildly between identical runs.

**Phase relevance:** Must be corrected before any results/metrics display phase.

---

## Moderate Pitfalls

---

### Pitfall 5: Cache API Storage Eviction Silently Deletes Models

**What goes wrong:** A user downloads three 2 GB models. Browser storage quota is hit (~60-80% of disk for Chrome, 50% of free disk for Firefox). The browser silently evicts cached model files using LRU policy. Next time the user runs a comparison with a "cached" model, it re-downloads the entire model, adding 30-120 seconds to what was supposed to be a fast cached run.

**Why it happens:** Browser Cache API storage is not persistent by default. Without calling `navigator.storage.persist()`, the browser can evict cache entries at any time. Safari is more aggressive: it deletes script-created data after 7 days without user interaction. The app currently shows cache status but has no persistence guarantee.

**Existing code exposure:** `inference.worker.ts` lines 209-221 -- cache size estimation reads from `caches.open('transformers-cache')` but never requests persistence. The download flow caches via the pipeline's internal mechanism but has no eviction protection.

**Prevention:**
- Call `navigator.storage.persist()` on app startup and display whether persistence was granted.
- Show estimated storage usage (`navigator.storage.estimate()`) in the UI so users know how close they are to quota.
- Before running a "cached" model, verify cache entries still exist rather than assuming.
- Show a warning if persistence was denied (Firefox/Safari may deny without user gesture).

**Detection:**
- Model loads that should be fast (~1s) take 30+ seconds (re-downloading).
- `navigator.storage.estimate()` returns quota close to usage.

**Phase relevance:** Should be addressed in model download/management phase.

---

### Pitfall 6: Anthropic's "Dangerous" CORS Header May Be Revoked

**What goes wrong:** The `anthropic-dangerous-direct-browser-access: true` header works today but is deliberately named to signal it is not a stable API. Anthropic could restrict or remove it at any time, breaking all Claude comparisons.

**Why it happens:** Anthropic added this header reluctantly. The name is an intentional warning. It exists primarily for "bring your own key" tools and internal apps. There is no SLA or stability guarantee. The header is not even documented in official API docs -- it was discovered via community observation.

**Existing code exposure:** `cloudApis.ts` lines 66-68 -- hard-coded reliance on this header. No fallback, no version negotiation.

**Prevention:**
- Document this dependency prominently in the app (e.g., tooltip on Claude model chips).
- Detect failure mode: if Anthropic returns a CORS error despite the header, show "Anthropic has disabled browser access" rather than a generic error.
- Accept the risk for a POC -- this is the correct approach for the "bring your own key" pattern.
- If the header is revoked, the only fix is a CORS proxy.

**Detection:**
- Anthropic requests fail with CORS errors that include "must set anthropic-dangerous-direct-browser-access header" or similar.

**Phase relevance:** Monitor during cloud API integration; no code change needed now, but error handling must distinguish this case.

---

### Pitfall 7: Performance.now() Timing Discrepancy Between Main Thread and Worker

**What goes wrong:** Cloud API calls are timed on the main thread (in `cloudApis.ts`), while local model inference is timed inside the Web Worker (in `inference.worker.ts`). The `performance.now()` time origins differ between main thread and worker contexts. The timing comparison between cloud and local is not apples-to-apples because it measures different things (network round-trip vs. pure compute) with different clock bases.

**Why it happens:** In Window contexts, the time origin is navigation start. In Worker contexts, it is worker creation time. While this does not affect relative measurements within each context, the TTFT metric has fundamentally different meaning: for cloud APIs it includes network latency; for local models it does not. Users comparing these numbers may draw incorrect conclusions.

**Existing code exposure:** `cloudApis.ts` measures `ttft` as time-to-first-HTTP-response (includes network). `inference.worker.ts` measures `ttft` as time-to-first-token-callback (pure compute). Both are labeled "TTFT" in the same comparison table.

**Prevention:**
- Document clearly in the UI what each metric means for each model type (e.g., "TTFT includes network latency for cloud models").
- Consider adding metric labels/footnotes: "TTFT (network)" vs "TTFT (compute)".
- Do not use relative timing cross-context. Each context's measurements are internally consistent.
- For total time comparisons, this is actually fine -- users want to know wall-clock time regardless of where it's spent.

**Detection:**
- Cloud TTFT values that seem anomalously large compared to local TTFT.
- User confusion in feedback about why cloud models have higher TTFT despite being "faster."

**Phase relevance:** Address when building the results display / comparison table.

---

### Pitfall 8: HuggingFace Search Debounce and Rate Limiting

**What goes wrong:** Every keystroke in the model search fires a fetch to `huggingface.co/api/models`. Without debouncing, a user typing "phi-3" generates 5 API calls in rapid succession. HuggingFace rate limits are calculated over 5-minute fixed windows and apply per-IP for unauthenticated requests. A user who searches repeatedly can get rate-limited, causing autocomplete to silently stop working.

**Why it happens:** `hfSearch.ts` has no debounce, no rate limit handling, no caching of results, and no authentication token. Anonymous HuggingFace API access has lower rate limits.

**Existing code exposure:** `hfSearch.ts` lines 19-47 -- raw `fetch()` with no debounce, no retry on 429, no caching, no auth token.

**Prevention:**
- Add 300ms debounce on search input before triggering API calls.
- Cache search results for repeated queries (simple in-memory Map with TTL).
- Handle HTTP 429 responses with the `Retry-After` header.
- Optionally accept a HuggingFace token in Settings for higher rate limits (users likely have one).

**Detection:**
- `searchModels()` returning empty arrays when valid queries should have results.
- HTTP 429 responses in network tab during rapid typing.

**Phase relevance:** Address in the model selector / search component phase.

---

### Pitfall 9: Download Phase Creates and Immediately Disposes Pipelines (Wasted GPU Cycles)

**What goes wrong:** The `handleDownload` function in the worker creates a full pipeline (including GPU session initialization) just to cache model files, then immediately disposes it. For WebGPU models, this means allocating GPU memory, compiling shaders, and creating execution contexts -- all thrown away. When the model is later loaded for actual inference, all of this GPU work is repeated.

**Why it happens:** transformers.js does not expose a "download only" API separate from pipeline creation. The current approach works but is wasteful, especially for WebGPU where shader compilation can take several seconds.

**Existing code exposure:** `inference.worker.ts` lines 31-88 -- `handleDownload` creates pipeline then immediately calls `dispose()`. If downloading 4 models sequentially with WebGPU, this burns 4 unnecessary GPU init cycles and risks the GPU memory leak from Pitfall 1.

**Prevention:**
- For pre-download, force `device: 'wasm'` regardless of the target backend. WASM initialization is lightweight and still triggers the same cache downloads. Then use the correct backend only during actual inference.
- Alternatively, use `AutoModel.from_pretrained(modelId, { device: 'wasm' })` just to trigger the download, if pipeline creation is too heavy.
- This also avoids GPU memory churn during the download phase entirely.

**Detection:**
- GPU memory spikes during download phase visible in `chrome://gpu`.
- Download phase takes significantly longer for WebGPU vs WASM (shader compilation overhead).

**Phase relevance:** Should be optimized in the download/pre-caching phase.

---

### Pitfall 10: Google Gemini API Key Exposed in URL

**What goes wrong:** The Google Generative AI API call in `cloudApis.ts` passes the API key as a URL query parameter: `?key=${apiKey}`. This key appears in browser history, network logs, DevTools, any proxy logs, and potentially error reporting tools. It is more exposed than keys sent in HTTP headers.

**Why it happens:** Google's Generative AI REST API is designed this way -- the key goes in the URL. This is standard for Google APIs but is a security anti-pattern for client-side code.

**Existing code exposure:** `cloudApis.ts` line 106 -- `key=${apiKey}` in the URL string. Keys in localStorage + URL params = easily extractable.

**Prevention:**
- This is a "bring your own key" POC for developers -- the risk is accepted and understood by the target audience.
- Document that API keys are stored in localStorage and sent in requests (not hidden).
- Consider adding a dismissible warning on the Settings page: "API keys are stored locally and sent directly to provider APIs."
- Do not log request URLs that contain keys.

**Detection:**
- API key visible in DevTools Network tab URL column.

**Phase relevance:** Address in the Settings page phase with appropriate disclosure.

---

## Minor Pitfalls

---

### Pitfall 11: Vite WASM File Handling in Production Build

**What goes wrong:** Vite's dev server handles WASM imports fine, but production builds may fail to include ONNX Runtime's `.wasm` files correctly. The `optimizeDeps.exclude` for `@huggingface/transformers` prevents pre-bundling issues in dev, but the production build may attempt to bundle or tree-shake WASM-dependent code paths.

**Prevention:**
- Test production builds (`vite build && vite preview`) early and often.
- If WASM files are missing in production, add them to `assetsInclude` in vite config or use a Vite plugin to copy them to the output directory.
- The current vite.config.ts `optimizeDeps.exclude` is correct for dev but verify build output.

**Phase relevance:** Verify during initial build/deployment testing.

---

### Pitfall 12: Quantization Filename Parsing Is Fragile

**What goes wrong:** `extractQuantizations()` in `hfSearch.ts` parses ONNX filenames to detect quantization levels. The heuristic (checking for "q4", "int8", "fp16" in filenames) works for common naming conventions but will miss or misidentify models that use non-standard naming (e.g., `model_w4a16.onnx`, `model-4bit.onnx`).

**Prevention:**
- Accept that this is best-effort for a POC.
- Fall back to `fp32` when nothing matches (already implemented).
- In v4, transformers.js may expose quantization metadata in config files -- check `config.json` or `quantization_config` fields as an alternative source of truth.
- Consider fetching the model card/README for explicit quantization info if filenames are ambiguous.

**Phase relevance:** Low priority; current approach is reasonable for the POC.

---

### Pitfall 13: Warm-up Run Biases Timing Results

**What goes wrong:** The worker runs `await generator('test', { max_new_tokens: 1 })` as a warm-up before the actual generation. This is good practice for WebGPU (first run compiles shaders). However, the warm-up prompt "test" may cause different tokenizer behavior than the actual prompt, and the `initTime` metric includes this warm-up but is presented separately from `loadTime`, which may confuse users about what each metric represents.

**Prevention:**
- Document in the UI what `initTime` means (shader compilation + warm-up).
- Consider using a single space or empty prompt for warm-up to minimize side effects.
- The warm-up is essential for WebGPU -- do not remove it.

**Phase relevance:** Address in results display / metrics documentation.

---

### Pitfall 14: RepeatPenalty Parameter Mapping Differs Across Providers

**What goes wrong:** The `repeatPenalty` parameter is mapped differently for each provider. OpenAI uses `frequency_penalty` which ranges from -2.0 to 2.0 and expects `repeatPenalty - 1`. Anthropic has no repeat penalty parameter. transformers.js uses `repetition_penalty` which is a multiplicative factor (1.0 = no penalty, >1.0 = penalize). These are fundamentally different algorithms, making "same parameters" comparisons misleading.

**Existing code exposure:** `cloudApis.ts` line 29 -- `frequency_penalty: params.repeatPenalty - 1` is a rough approximation. Anthropic ignores the parameter entirely. The comparison claims "same parameters" but parameters behave differently.

**Prevention:**
- Document parameter mapping differences in the UI (tooltip or info icon next to repeat penalty).
- Show which parameters are actually sent to each provider in the results.
- Accept that exact parameter parity across providers is impossible -- the comparison is "same intent, different implementation."

**Phase relevance:** Address in prompt input / parameter configuration phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Sequential test execution | GPU memory leak between models (Pitfall 1) | CRITICAL | Delay between runs, adapter health check, worker restart fallback |
| Sequential test execution | WebGPU device loss cascade (Pitfall 3) | CRITICAL | Auto-fallback to WASM after WebGPU failure |
| Cloud API integration | OpenAI CORS outages (Pitfall 2) | CRITICAL | Specific CORS error detection and user messaging |
| Results / metrics display | Token count inaccuracy (Pitfall 4) | CRITICAL | Recalculate from actual output, not callback count |
| Model download / caching | Cache eviction (Pitfall 5) | MODERATE | Request storage persistence, verify cache before run |
| Model download / caching | Wasteful GPU init during download (Pitfall 9) | MODERATE | Force WASM backend for download-only operations |
| Model selector / search | HF API rate limiting (Pitfall 8) | MODERATE | Debounce, caching, 429 handling |
| Results comparison table | Metric meaning differs by type (Pitfall 7) | MODERATE | Label metrics differently for cloud vs local |
| Settings page | API key exposure awareness (Pitfall 10) | MODERATE | User-facing disclosure |
| Cloud API error handling | Anthropic header revocation (Pitfall 6) | MODERATE | Specific error detection for CORS vs auth failures |
| Parameter configuration | Cross-provider parameter mismatch (Pitfall 14) | MINOR | Document differences in UI |
| Build / deployment | WASM files in production build (Pitfall 11) | MINOR | Test production build early |

---

## Sources

- [transformers.js WebGPU crash issue #1518](https://github.com/huggingface/transformers.js/issues/1518) -- WebGPU session creation failures
- [transformers.js memory leak issue #860](https://github.com/huggingface/transformers.js/issues/860) -- Severe WebGPU memory leak in pipeline
- [WebGPU bugs article (Emmerich)](https://medium.com/@marcelo.emmerich/webgpu-bugs-are-holding-back-the-browser-ai-revolution-27d5f8c1dfca) -- Browser-specific WebGPU limitations
- [WebGPU Device Loss best practices (Toji)](https://toji.dev/webgpu-best-practices/device-loss.html) -- Device loss handling patterns
- [Anthropic CORS header (Simon Willison)](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) -- anthropic-dangerous-direct-browser-access details
- [OpenAI CORS outage discussion](https://community.openai.com/t/chat-completions-api-endpoint-down-blocked-any-web-browser-request/1362527) -- Oct 2025 CORS breakage
- [OpenAI CORS policy change (Responses API)](https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791) -- Jan 2026 CORS outage
- [MDN: Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- Browser cache limits
- [MDN: performance.now() timing](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) -- Timer precision and worker context
- [HuggingFace Hub rate limits](https://huggingface.co/docs/hub/rate-limits) -- API rate limiting policies
- [transformers.js v4 release notes](https://github.com/huggingface/transformers.js/releases/tag/4.0.0) -- v4 changes
- [TextStreamer repeating tokens #934](https://github.com/huggingface/transformers.js/issues/934) -- Streamer callback behavior
- [Profiling WebGPU memory (SitePoint)](https://www.sitepoint.com/profiling-webgpu-memory-local-ai/) -- GPU memory debugging
- [Google Gemini API docs](https://ai.google.dev/gemini-api/docs) -- Client-side security warnings
