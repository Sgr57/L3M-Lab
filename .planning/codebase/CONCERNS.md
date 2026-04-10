# Codebase Concerns

**Analysis Date:** 2026-04-10

## Security Considerations

**API Keys in Browser Storage:**
- Risk: API keys (OpenAI, Anthropic, Google) are stored in browser's `localStorage` via Zustand's persist middleware
- Files: `src/stores/useSettingsStore.ts` (lines 31-36), `src/components/ApiKeySettings/index.tsx`
- Current mitigation: Component includes disclaimer that keys are stored locally and only sent to respective providers
- Recommendations: 
  - Implement optional backend proxy for cloud API calls to avoid exposing keys in browser
  - Add optional session-storage-only mode that clears keys on browser close
  - Never log or display API keys even partially in console/UI

**CORS Issues with Anthropic API:**
- Risk: Anthropic API enforces CORS restrictions; the workaround header `anthropic-dangerous-direct-browser-access: true` bypasses normal browser security
- Files: `src/lib/cloudApis.ts` (lines 68)
- Current mitigation: Header is explicitly named to draw attention
- Recommendations:
  - Recommend server-side proxy approach in documentation
  - Add warning banner if using Anthropic in production
  - Consider blocking direct browser calls for Anthropic in future versions

**Google API Key in URL:**
- Risk: Google Generative Language API requires API key as URL parameter, exposing it in browser history and network logs
- Files: `src/lib/cloudApis.ts` (line 107)
- Current mitigation: None
- Recommendations:
  - Implement backend proxy to handle Google API authentication
  - Add warning about exposure risk in settings UI
  - Document why direct browser calls are necessary

## Performance Bottlenecks

**Model Cache Size Estimation Loop:**
- Problem: Synchronous cache size estimation iterates through all cached model files and reads blob sizes
- Files: `src/workers/inference.worker.ts` (lines 206-223)
- Cause: The loop reads `Cache` API responses sequentially without parallelization; models can be multi-GB
- Improvement path:
  - Use `Promise.all()` to fetch all blob sizes in parallel (lines 213-218)
  - Consider moving to a worker utility to avoid blocking inference
  - Add timeout/size limit to prevent hanging on corrupted cache entries

**HuggingFace Search No Pagination:**
- Problem: Search results capped at 20 models (hardcoded limit, no pagination)
- Files: `src/lib/hfSearch.ts` (line 30)
- Cause: Limited to API's per-request limit without pagination support
- Improvement path:
  - Implement pagination UI to load more results on demand
  - Cache previous search results to avoid re-fetching
  - Add infinite scroll or "Load More" button

**Cloud API Sequential Processing:**
- Problem: Cloud models run sequentially from main thread, blocking UI during generation
- Files: `src/lib/workerBridge.ts` (lines 104-139)
- Cause: Cloud API calls are awaited in series, not parallelized
- Improvement path:
  - Use `Promise.all()` or `Promise.race()` to run cloud models concurrently
  - Move cloud API logic to worker thread as well to prevent UI blocking
  - Add per-model timeout to prevent single slow API from blocking comparison

**Warm-up Generation Single Token:**
- Problem: Model initialization warm-up uses 1 token, which may not trigger all GPU optimizations
- Files: `src/workers/inference.worker.ts` (line 164)
- Cause: Minimal warm-up to keep initialization fast
- Improvement path:
  - Benchmark actual optimal warm-up token count per model
  - Add user-configurable warm-up token count
  - Consider 32-64 token warm-up for more stable performance metrics

## Fragile Areas

**Worker Lifecycle No Error Boundaries:**
- Files: `src/lib/workerBridge.ts`, `src/workers/inference.worker.ts`
- Why fragile: Worker errors are caught at download/run phases but worker instance itself is never terminated or reset. Failed worker remains in memory.
- Safe modification: 
  - Add explicit worker termination on error in `handleWorkerEvent()` (line 78-79)
  - Reset `worker` variable to null after termination
  - Test with intentional worker crashes
- Test coverage: No tests for worker recovery after crash

**Result Deduplication Race Condition:**
- Files: `src/stores/useCompareStore.ts` (line 71-74)
- Why fragile: `addResult()` appends results without checking for duplicates. If worker sends duplicate run-complete events, results array will have duplicates.
- Safe modification:
  - Add check: `if (!state.results.find(r => r.config.id === result.config.id && r.timestamp === result.timestamp))`
  - Consider using UUID per run attempt instead of timestamp
- Test coverage: No tests for duplicate result handling

**Config Lookup on Error Without Null Check:**
- Files: `src/lib/workerBridge.ts` (line 63)
- Why fragile: `store.configs.find(c => c.id === event.configId)!` uses non-null assertion. If config was removed mid-run, this will be undefined.
- Safe modification:
  - Replace `!` with fallback: `?? { id: event.configId, modelId: '', displayName: '', ... }`
  - Or check existence before accessing
- Test coverage: No tests for config removal during run

**Modal Selector Dropdown Click Outside Logic:**
- Files: `src/components/ModelSelector/index.tsx` (lines 74-82)
- Why fragile: Uses type assertion `e.target as Node` without checking if `e.target` is nullish. Unhandled exception if target is null.
- Safe modification:
  - Add null check: `if (wrapperRef.current && e.target && !wrapperRef.current.contains(e.target as Node))`
  - Use optional chaining or guard
- Test coverage: No tests for null target edge case

**HuggingFace Search Error Silent Failure:**
- Files: `src/lib/hfSearch.ts` (lines 34, 56)
- Why fragile: Network/API errors return empty array or `['fp32']` respectively. UI shows no error message.
- Safe modification:
  - Return error state: `{ success: false; error: string } | { success: true; data: ... }`
  - Surface errors to UI in ModelSelector dropdown
  - Add retry mechanism with exponential backoff
- Test coverage: No error scenario tests

**No Timeout on Model Load/Generate:**
- Files: `src/workers/inference.worker.ts` (lines 48-63, 152-200)
- Why fragile: Pipeline initialization and generation have no timeout. Browser can freeze indefinitely on slow/problematic models.
- Safe modification:
  - Wrap `pipeline()` and generation in `Promise.race([operation, timeout(30000)])`
  - Add configurable timeout in GenerationParameters
  - Test with models that hang
- Test coverage: No timeout behavior tests

## Dependencies at Risk

**@huggingface/transformers Rapid Development:**
- Risk: Major version 4.x is newer with breaking changes; library is pre-1.0 and evolving rapidly
- Impact: Model loading API, dtype handling, and pipeline options may change
- Files: `package.json` (line 13), all worker and component code using transformers API
- Migration plan:
  - Pin to specific minor version (e.g., `^4.0.1`) and test upgrades carefully
  - Read changelog before upgrading
  - Test inference output consistency after version bumps
  - Document ONNX model compatibility per transformers version

**React 19.2.4 New Release:**
- Risk: React 19 is a major version with new features (React Compiler, deprecations). May have edge cases.
- Impact: Hook behavior, render semantics could change; limited real-world usage yet
- Files: All `.tsx` files
- Migration plan:
  - Stay on 19.x but avoid 20.x until stable
  - Watch for reported hook issues with custom hooks (`useWebGPU`, `useDebouncedValue`)
  - Test concurrent features if adopted

**Transformers.js Cache Behavior Opaque:**
- Risk: Cache size estimation and cleanup logic relies on undocumented transformers.js Cache API behavior
- Impact: Cache key format may change; blob size calculation may be inaccurate
- Files: `src/workers/inference.worker.ts` (lines 206-223)
- Migration plan:
  - Use `transformers` library's official cache management API when available
  - Add fallback if cache query fails instead of silently returning null

## Test Coverage Gaps

**Worker Message Passing:**
- What's not tested: Message serialization, type safety of WorkerCommand/WorkerEvent payloads, backpressure handling
- Files: `src/types/worker-messages.ts`, `src/lib/workerBridge.ts`, `src/workers/inference.worker.ts`
- Risk: Type mismatch in message data could crash worker silently
- Priority: High

**Cloud API Error Scenarios:**
- What's not tested: 401/403 auth errors, rate limiting (429), network timeouts, malformed responses
- Files: `src/lib/cloudApis.ts`, `src/components/ApiKeySettings/index.tsx`
- Risk: Bad API keys or quota exhaustion provide poor error feedback
- Priority: High

**State Store Concurrency:**
- What's not tested: Rapid state updates (e.g., concurrent `addResult` calls), store reset during execution
- Files: `src/stores/useCompareStore.ts`, `src/stores/useSettingsStore.ts`
- Risk: Race conditions in state mutations; unclear behavior when reset is called mid-run
- Priority: Medium

**Model Selector Quantization Fallback:**
- What's not tested: What happens when fetched quantizations list is empty, or all models fail to load quantizations
- Files: `src/components/ModelSelector/index.tsx` (lines 87-95)
- Risk: Default quantization selection may fail, config becomes invalid
- Priority: Medium

**Cache Estimation Failure Modes:**
- What's not tested: Cache being cleared by browser while estimation runs, response.clone() failures, blob size calculation on very large models
- Files: `src/workers/inference.worker.ts` (lines 213-218)
- Risk: Incorrect model size reporting, silent failures
- Priority: Low

## Scaling Limits

**Local Storage Limit for Settings:**
- Current capacity: Browser localStorage typically 5-10MB; only storing API keys currently
- Limit: If conversation history or previous runs are added to persistent store, will quickly hit limit
- Scaling path:
  - Use IndexedDB for larger data (async, 50MB+)
  - Archive old runs to downloadable files instead of persisting
  - Implement cleanup policy for old cached API keys

**Worker Single Instance:**
- Current capacity: Single worker processes models sequentially
- Limit: Cannot leverage multi-worker parallelism; bottleneck for large comparison sets
- Scaling path:
  - Pool multiple workers (e.g., 4 workers running in parallel)
  - Distribute local models across worker pool
  - Load balance cloud API calls across threads

**Cache Storage Unbounded:**
- Current capacity: Browser cache (persistent, size varies by browser)
- Limit: Large model downloads (4-7GB for fp32) can consume all cache; no cleanup
- Scaling path:
  - Implement cache quota management (max 20GB per origin)
  - Add UI to view and delete cached models
  - Warn user before downloading models > 2GB

## Known Issues

**Anthropic API CORS Header Required:**
- Symptoms: Anthropic API calls fail with CORS error if `anthropic-dangerous-direct-browser-access: true` header is not set
- Files: `src/lib/cloudApis.ts` (line 68)
- Trigger: Any attempt to use Anthropic provider from browser
- Workaround: Header is already included; production use requires backend proxy

**Google Generative AI Rate Limiting:**
- Symptoms: Rapid consecutive calls fail with 429 Too Many Requests
- Files: `src/lib/cloudApis.ts`, `src/lib/workerBridge.ts` 
- Trigger: Running multiple Google model configs in quick succession
- Workaround: Add manual delay between Google API calls (not implemented)

**HuggingFace Model Not Found:**
- Symptoms: Download fails with obscure error if model ONNX files don't exist for selected quantization
- Files: `src/workers/inference.worker.ts` (line 48-63)
- Trigger: Selecting quantization that isn't actually available on HuggingFace
- Workaround: Improve quantization detection in `hfSearch.ts` or add pre-download validation

**WebGPU Detection False Negatives:**
- Symptoms: Browser supports WebGPU but detection returns false due to missing GPU adapter
- Files: `src/lib/webgpuDetect.ts`
- Trigger: User has WebGPU enabled in flags but no discrete GPU available, or drivers outdated
- Workaround: Allow manual backend override in settings even if detection says unavailable

## Missing Critical Features

**No Offline Mode:**
- Problem: App requires internet for HuggingFace model search and cloud API calls
- Blocks: Using app in restricted networks, cached model comparison without internet
- Files: Affects `src/lib/hfSearch.ts`, `src/lib/cloudApis.ts`, model caching strategy
- Recommendation: Cache model list locally; queue cloud API calls

**No Comparison History:**
- Problem: Results lost on page refresh or navigation
- Blocks: Comparing runs over time, sharing results
- Files: State exists only in memory; no persistence to IndexedDB
- Recommendation: Add optional persistence layer in Zustand

**No Partial Results Saving:**
- Problem: If comparison is interrupted, all partial results are discarded
- Blocks: Long-running comparisons, resuming failed runs
- Files: `src/lib/workerBridge.ts` (reset on cancel)
- Recommendation: Implement checkpoint/resume for partial results

**No Model Performance Presets:**
- Problem: Every comparison requires manual parameter tuning
- Blocks: Quick benchmarking, consistent methodology
- Files: `src/stores/useCompareStore.ts` (GenerationParameters)
- Recommendation: Add preset templates (e.g., "Fast", "Balanced", "Detailed")

**No CSV/JSON Export Progress:**
- Problem: Export is synchronous; large result sets block UI
- Blocks: Exporting 50+ model comparisons
- Files: `src/lib/exportUtils.ts` (formatAsCSV, formatAsJSON)
- Recommendation: Stream export to file in worker thread
