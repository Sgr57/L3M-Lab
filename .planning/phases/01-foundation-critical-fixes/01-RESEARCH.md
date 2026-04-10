# Phase 1: Foundation & Critical Fixes - Research

**Researched:** 2026-04-10
**Domain:** Vite configuration, transformers.js token counting, cross-origin isolation
**Confidence:** HIGH

## Summary

Phase 1 addresses four areas: (1) enabling SharedArrayBuffer via COOP/COEP headers in Vite dev server, (2) declaring explicit ES worker format in Vite config, (3) fixing the token counting bug in the inference worker, and (4) verifying existing NavBar and color system implementations already satisfy STNV-01 and STNV-05.

The most critical finding is the token counting bug root cause: `TextStreamer.callback_function` fires on decoded TEXT CHUNKS (at word boundaries), not on individual tokens. The code increments `tokenCount++` per callback, so it counts text flush events, not actual tokens generated. Transformers.js v4 provides `token_callback_function` on TextStreamer, which fires exactly once per generated token with the raw `bigint[]` token IDs. This is the correct mechanism for real-time counting. Additionally, `tokenizer.encode(text)` returns `number[]` of token IDs, enabling post-generation verification.

**Primary recommendation:** Use `token_callback_function` for real-time token counting during streaming, and `tokenizer.encode()` for post-generation metric recalculation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** After generation completes, use tokenizer to count actual tokens in the output (not TextStreamer chunk count). Recalculate tok/s from final token count and total generation time.
- **D-02:** Research phase MUST check if transformers.js v4 exposes specific APIs for accurate token counting (e.g., token IDs in generation output, built-in count on result object, or tokenizer.encode). Use the best available method rather than assuming tokenizer.encode is the only option.
- **D-03:** Real-time tok/s during streaming can remain approximate (chunk-based). Only final metrics need to be accurate.
- **D-04:** Add COOP/COEP headers to Vite dev server config for SharedArrayBuffer support.
- **D-05:** Add `worker: { format: 'es' }` to Vite config for explicit worker format.

### Claude's Discretion
- NavBar visual identity: Current implementation is functional. Claude may refine spacing, font weight, or badge appearance if it improves the POC shell, but no major redesign needed.
- Color system JS constants: Claude decides whether to create a shared `colors.ts` now or defer to Phase 5 when Recharts actually needs JS color values. CSS custom properties in `index.css` are the source of truth either way.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FNDN-01 | Vite config includes COOP/COEP headers so WASM runs multi-threaded and benchmarks are accurate | Vite 8 `server.headers` confirmed to apply to index.html responses; exact config pattern verified |
| FNDN-02 | Worker explicit format declaration (`worker: { format: 'es' }`) in Vite config | Vite 8 worker options documented; worker already created with `type: 'module'`; format declaration aligns |
| FNDN-03 | Token counting uses actual tokenizer output, not TextStreamer chunk count, so tok/s metric is accurate | Bug root cause identified in TextStreamer; `token_callback_function` and `tokenizer.encode()` APIs verified in library source |
| FNDN-04 | WebGPU support detected at runtime and surfaced in NavBar as a badge | Already implemented: `webgpuDetect.ts`, `useWebGPU.ts`, NavBar badge all functional |
| STNV-01 | Navigation bar with logo "CompareLocalLLM", links (Compare active, Settings), WebGPU badge | Already implemented in `NavBar/index.tsx`; may receive minor polish only |
| STNV-05 | Consistent color coding throughout: purple (#8250df) cloud, blue (#0969da) WebGPU, green (#1a7f37) WASM | CSS custom properties already defined in `index.css` @theme block with exact hex values |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 8.0.8 | Build tool and dev server | Already installed; COOP/COEP and worker format config go here |
| @huggingface/transformers | 4.0.1 | Local LLM inference | Already installed; provides TextStreamer, tokenizer, pipeline APIs |
| React | 19.2.4 | UI framework | Already installed |
| Tailwind CSS | 4.2.2 | Styling | Already installed; CSS custom properties for color system |

[VERIFIED: node_modules package.json files]

### Supporting
No new dependencies needed for Phase 1.

### Alternatives Considered
None -- Phase 1 uses only existing stack.

## Architecture Patterns

### Affected File Map

```
vite.config.ts              # Add COOP/COEP headers + worker format
src/workers/inference.worker.ts  # Fix token counting in runSingleModel()
src/components/NavBar/index.tsx  # Already complete (minor polish at discretion)
src/index.css               # Already complete (color system defined)
```

### Pattern 1: Vite COOP/COEP Headers via server.headers

**What:** Add Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy response headers to Vite dev server configuration so the browser enables `crossOriginIsolated` mode, which is required for `SharedArrayBuffer`.

**When to use:** Always -- this is a one-time config change.

**Verified behavior:** In Vite 8.0.8, `server.headers` is applied to all responses including the index.html page. The `indexHtmlMiddleware` passes `server.config.server.headers` to the `send()` function for HTML responses. [VERIFIED: Vite 8.0.8 source code, node_modules/vite/dist/node/chunks/node.js lines 25350-25368]

**Example:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

**Verification in browser console:**
```javascript
console.log('crossOriginIsolated:', crossOriginIsolated)
// Should log: crossOriginIsolated: true
console.log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined')
// Should log: SharedArrayBuffer available: true
```

[CITED: https://github.com/vitejs/vite/issues/3909 -- `server.headers` support confirmed since Vite 3.x PR #5580]

### Pattern 2: Accurate Token Counting with TextStreamer

**What:** Fix the token counting bug by using `token_callback_function` instead of counting `callback_function` invocations.

**The Bug (root cause verified in library source):**

The current code in `inference.worker.ts` (lines 173-189) uses `callback_function` and increments `tokenCount++` on each call. But `callback_function` fires when the streamer has accumulated enough decoded text to output at a word boundary -- it does NOT fire once per token. Multiple tokens may be flushed as a single text chunk, so `tokenCount` systematically undercounts. [VERIFIED: TextStreamer source, node_modules/@huggingface/transformers/src/generation/streamers.js lines 114-136]

**Available APIs for token counting (answering D-02):**

| API | Where | What it provides | Accuracy |
|-----|-------|-----------------|----------|
| `token_callback_function` | TextStreamer constructor option | Called once per generated token with `bigint[]` token IDs | Exact real-time count |
| `tokenizer.encode(text)` | Pipeline `.tokenizer` property | Returns `number[]` of token IDs for given text | Exact post-generation count |
| `callback_function` | TextStreamer constructor option (CURRENT) | Called per decoded text chunk at word boundaries | WRONG -- undercounts |

[VERIFIED: TextStreamer source code, node_modules/@huggingface/transformers/src/generation/streamers.js lines 48, 56, 66, 82-94]
[VERIFIED: tokenizer.encode source code, node_modules/@huggingface/transformers/src/tokenization_utils.js lines 510-526]

**Recommended approach (fulfills D-01, D-02, D-03):**

1. Add `token_callback_function` to the TextStreamer constructor -- increment a counter each time it fires (accurate real-time count during streaming)
2. Keep `callback_function` for text streaming display (unchanged purpose)
3. After generation completes, use `generator.tokenizer.encode(streamedText)` to get the definitive token count, and recalculate final tok/s from that count and total generation time

**Example (fix for inference.worker.ts runSingleModel):**
```typescript
// Source: TextStreamer type definitions and source code
// node_modules/@huggingface/transformers/types/generation/streamers.d.ts

let streamedText = ''
let tokenCount = 0  // Now counts ACTUAL tokens
let firstTokenTime = 0
const genStart = performance.now()

const streamer = new TextStreamer(generator.tokenizer, {
  skip_prompt: true,
  // token_callback_function fires once per generated token
  token_callback_function: (_tokens: bigint[]) => {
    if (tokenCount === 0) {
      firstTokenTime = performance.now() - genStart
    }
    tokenCount++
    const elapsed = performance.now() - genStart
    const tokPerSec = tokenCount > 0 ? (tokenCount / (elapsed / 1000)) : 0

    postProgress(
      config, currentIndex, totalModels, 'generating',
      tokenCount, tokPerSec, loadTime + initTime + elapsed, streamedText
    )
  },
  // callback_function still handles text display
  callback_function: (text: string) => {
    streamedText += text
  },
})

// ... after generation completes:
const totalGenTime = performance.now() - genStart

// Post-generation: recalculate with tokenizer for definitive accuracy (D-01)
const finalTokenIds = generator.tokenizer.encode(streamedText)
const finalTokenCount = finalTokenIds.length
const tokensPerSecond = finalTokenCount > 0 ? (finalTokenCount / (totalGenTime / 1000)) : 0
```

**Important detail about `token_callback_function` signature:** The function receives `bigint[]` (an array), but for text generation it will always be a single-element array `[tokenId]` because generation produces one token at a time per batch item. The array wrapping matches the `put(value: bigint[][])` structure where `value[0]` (the first batch) is extracted and passed. [VERIFIED: streamers.js line 93-94, modeling_utils.js line 1006, 1012-1013]

**Note on `tokenizer.encode()` for final metrics:** The encode method adds special tokens by default (`add_special_tokens: true`). For counting only the generated output tokens, use `{ add_special_tokens: false }` to avoid inflating the count:
```typescript
const finalTokenIds = generator.tokenizer.encode(streamedText, { add_special_tokens: false })
```
[VERIFIED: tokenization_utils.js line 520, default parameter `add_special_tokens = true`]

### Pattern 3: Worker Format Declaration

**What:** Add `worker: { format: 'es' }` to Vite config.

**Why:** The worker is already instantiated with `type: 'module'` (in `workerBridge.ts` line 11). Setting `format: 'es'` in Vite config ensures the built worker bundle uses ES module format, matching the runtime expectation. The default is `'iife'` which could cause issues in production builds.

[VERIFIED: Vite worker options docs at https://vite.dev/config/worker-options, default is 'iife']
[VERIFIED: workerBridge.ts line 11, worker created with `{ type: 'module' }`]

### Anti-Patterns to Avoid

- **Counting callback_function calls as tokens:** This is the current bug. The text callback fires at word boundaries, not per token. Never use it for metrics.
- **Using a plugin for COOP/COEP headers when server.headers works:** The middleware plugin approach is a workaround for older Vite versions. In Vite 8, `server.headers` works correctly for all responses including HTML.
- **Using `require-corp` COEP without considering external resources:** COEP `require-corp` blocks loading any cross-origin resource that doesn't set `Cross-Origin-Resource-Policy`. For this POC (no external images/fonts loaded cross-origin), this is fine. If external CDN resources are ever added, consider `credentialless` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Manual character-based estimation | `token_callback_function` + `tokenizer.encode()` | Tokenization is model-specific; BPE token boundaries are not predictable from text |
| Cross-origin isolation | Custom service worker proxy | Vite `server.headers` config | Standard browser feature requiring only HTTP headers |
| WebGPU detection | Feature sniffing heuristics | `navigator.gpu.requestAdapter()` | Already implemented correctly in `webgpuDetect.ts` |

## Common Pitfalls

### Pitfall 1: COEP Breaks External Resource Loading
**What goes wrong:** Setting `Cross-Origin-Embedder-Policy: require-corp` blocks ALL cross-origin resources that don't include a `Cross-Origin-Resource-Policy` header.
**Why it happens:** COEP is a strict policy. External fonts, images, or scripts from CDNs that don't set CORP headers will be blocked.
**How to avoid:** This POC has no external cross-origin resources in dev mode (Tailwind is bundled, HuggingFace model downloads happen in a worker via fetch). If external resources are added later, use `credentialless` instead of `require-corp`.
**Warning signs:** Blank page or console errors about blocked resources after adding COOP/COEP.

### Pitfall 2: tokenizer.encode Includes Special Tokens by Default
**What goes wrong:** `tokenizer.encode(text)` adds BOS/EOS special tokens by default, inflating the token count by 1-2 tokens.
**Why it happens:** The `add_special_tokens` parameter defaults to `true`.
**How to avoid:** Pass `{ add_special_tokens: false }` when counting output tokens only.
**Warning signs:** Token count is consistently 1-2 higher than expected.
[VERIFIED: tokenization_utils.js line 520]

### Pitfall 3: TTFT Measurement with token_callback_function
**What goes wrong:** Moving TTFT measurement from `callback_function` to `token_callback_function` changes when it fires. The text callback fires later (after buffering), so TTFT was previously measured at first text flush, not first token generation.
**Why it happens:** `token_callback_function` fires on the very first generated token, before any text is decoded. This is actually MORE accurate for TTFT.
**How to avoid:** This is the desired behavior -- TTFT should measure time to first token, not time to first displayed text. No issue to avoid, just be aware the value will be slightly different (lower) than before.

### Pitfall 4: Preview Server Needs Separate Header Config
**What goes wrong:** `server.headers` only applies to the dev server. The `vite preview` command uses `preview.headers`.
**How to avoid:** Also add COOP/COEP headers to `preview.headers` in the Vite config.
**Warning signs:** SharedArrayBuffer works in dev but not in preview mode.

## Code Examples

### Complete Vite Config (Phase 1 target state)
```typescript
// Source: Vite 8 docs + project vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    headers: crossOriginHeaders,
  },
  preview: {
    headers: crossOriginHeaders,
  },
  worker: {
    format: 'es',
  },
})
```

### Token Counting Fix (key changes in runSingleModel)
```typescript
// Source: @huggingface/transformers 4.0.1 TextStreamer API
// File: src/workers/inference.worker.ts, function runSingleModel

// BEFORE (BUGGY):
const streamer = new TextStreamer(generator.tokenizer, {
  skip_prompt: true,
  callback_function: (text: string) => {
    tokenCount++  // BUG: counts text chunks, not tokens
    streamedText += text
    // ...
  },
})

// AFTER (FIXED):
const streamer = new TextStreamer(generator.tokenizer, {
  skip_prompt: true,
  token_callback_function: (_tokens: bigint[]) => {
    if (tokenCount === 0) {
      firstTokenTime = performance.now() - genStart
    }
    tokenCount++  // CORRECT: fires once per generated token
    const elapsed = performance.now() - genStart
    const tokPerSec = tokenCount > 0 ? (tokenCount / (elapsed / 1000)) : 0
    postProgress(config, currentIndex, totalModels, 'generating',
      tokenCount, tokPerSec, loadTime + initTime + elapsed, streamedText)
  },
  callback_function: (text: string) => {
    streamedText += text  // Only handles text display now
  },
})

// After generation completes -- recalculate definitive metrics (D-01):
const totalGenTime = performance.now() - genStart
const finalTokenIds = generator.tokenizer.encode(streamedText, {
  add_special_tokens: false,
})
const finalTokenCount = finalTokenIds.length
const tokensPerSecond = finalTokenCount > 0
  ? (finalTokenCount / (totalGenTime / 1000))
  : 0
```

### Verification: crossOriginIsolated in Console
```javascript
// Run in browser console after dev server restart
console.log('crossOriginIsolated:', crossOriginIsolated)
// Expected: true

console.log('SharedArrayBuffer:', typeof SharedArrayBuffer)
// Expected: 'function'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vite middleware plugin for COOP/COEP | `server.headers` config option | Vite 3.x (PR #5580) | Simpler config, no custom plugin needed |
| TextStreamer callback_function for token counting | token_callback_function (always available in v4) | transformers.js v4 | Accurate per-token callback vs per-chunk callback |
| `worker.rollupOptions` | `worker.rolldownOptions` | Vite 8 | Vite 8 migrated to Rolldown; rollupOptions deprecated |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `require-corp` COEP will not block any resources currently loaded by the app | Pitfall 1 | Page may break after adding headers; would need to switch to `credentialless` |
| A2 | HuggingFace model downloads via fetch in the worker are not affected by COEP (same-origin relative to the worker) | Architecture Patterns | Downloads might fail; would need CORS headers from HF or `credentialless` COEP |

**Note on A2:** HuggingFace CDN (huggingface.co) serves model files with appropriate CORS headers since the transformers.js library is designed for browser use. The fetch calls from the worker will include `Cross-Origin-Resource-Policy` or equivalent handling. This is LOW risk but noted for awareness. [ASSUMED]

## Open Questions

1. **COEP compatibility with HuggingFace CDN downloads**
   - What we know: HF transformers.js is designed for browser use, so their CDN likely sets CORS headers
   - What's unclear: Whether `require-corp` specifically causes issues with their CDN response headers
   - Recommendation: Test after implementing. If downloads break, switch to `credentialless` COEP which is less strict but still enables SharedArrayBuffer in Chrome

2. **Whether `token_callback_function` count matches `tokenizer.encode()` count exactly**
   - What we know: `token_callback_function` fires per generation step; `tokenizer.encode` re-tokenizes the decoded text
   - What's unclear: Edge cases like special tokens, BOS/EOS tokens that are part of generation but not in the decoded text
   - Recommendation: Both counts should be very close. Use `tokenizer.encode()` as the definitive count for final metrics (per D-01). The `token_callback_function` count is for real-time display only (per D-03).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FNDN-01 | crossOriginIsolated is true in browser | manual-only | Open browser console, check `crossOriginIsolated` | N/A |
| FNDN-02 | Worker format set to 'es' in config | manual-only | Inspect vite.config.ts | N/A |
| FNDN-03 | Token count matches tokenizer output | manual-only | Run generation, compare displayed count with `tokenizer.encode(output).length` | N/A |
| FNDN-04 | WebGPU badge shows in NavBar | manual-only | Visual check in browser | N/A |
| STNV-01 | NavBar displays name, links, badge | manual-only | Visual check in browser | N/A |
| STNV-05 | Color coding constants are centralized | manual-only | Verify index.css @theme block has correct hex values | N/A |

**Justification for manual-only:** No test framework is installed. Phase 1 changes are config-level (Vite headers) and worker-internal (token counting). Testing these requires either a running browser environment (for COOP/COEP and WebGPU detection) or actual model inference (for token counting). Installing a test framework is out of scope for this phase.

### Wave 0 Gaps
No test infrastructure exists. Installing Vitest is out of Phase 1 scope. All validation is manual for this phase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- no auth in this phase |
| V3 Session Management | No | N/A -- no sessions |
| V4 Access Control | No | N/A -- client-side only |
| V5 Input Validation | No | N/A -- no new user inputs in this phase |
| V6 Cryptography | No | N/A -- no crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| COOP/COEP enables SharedArrayBuffer (Spectre mitigation) | Information Disclosure | Cross-origin isolation is the browser's Spectre mitigation; enabling it IMPROVES security |

**Note:** COOP/COEP headers are a security improvement. They enable process isolation which prevents Spectre-class side-channel attacks. This phase adds security, it does not introduce risk.

## Sources

### Primary (HIGH confidence)
- Vite 8.0.8 source code (node_modules/vite/dist) -- verified server.headers applies to HTML responses
- @huggingface/transformers 4.0.1 source code -- verified TextStreamer token_callback_function, tokenizer.encode APIs
- Existing project source code -- verified current worker implementation, NavBar, color system

### Secondary (MEDIUM confidence)
- [Vite GitHub Issue #3909](https://github.com/vitejs/vite/issues/3909) -- server.headers support confirmed
- [Vite GitHub Issue #16536](https://github.com/vitejs/vite/issues/16536) -- HMR + COOP/COEP resolved
- [Vite Worker Options docs](https://vite.dev/config/worker-options) -- worker.format documentation

### Tertiary (LOW confidence)
- HuggingFace CDN CORS behavior with `require-corp` COEP -- not directly verified, based on assumption that browser-first library works in cross-origin isolated contexts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, versions verified from package.json
- Architecture: HIGH -- all APIs verified by reading library source code directly
- Pitfalls: HIGH -- verified from source code analysis (special tokens default, COEP behavior documented)
- Token counting fix: HIGH -- root cause verified by reading TextStreamer.put() source; both fix approaches verified in library types and source

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no moving targets; all libraries already pinned)
