import { pipeline, TextStreamer, type TextGenerationPipeline } from '@huggingface/transformers'
import type { WorkerCommand, WorkerEvent } from '../types/worker-messages'
import type { TestConfig, GenerationParameters, TestResult, TestMetrics } from '../types'

let cancelled = false

function post(event: WorkerEvent) {
  self.postMessage(event)
}

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data

  if (cmd.type === 'cancel') {
    cancelled = true
    return
  }

  if (cmd.type === 'download') {
    await handleDownload(cmd.configs)
    return
  }

  if (cmd.type === 'run') {
    cancelled = false
    await handleRun(cmd.prompt, cmd.params, cmd.configs)
    return
  }
}

async function handleDownload(configs: TestConfig[]) {
  cancelled = false
  const localConfigs = configs.filter((c) => c.backend !== 'api')

  for (const config of localConfigs) {
    if (cancelled) break

    try {
      post({
        type: 'download-progress',
        data: {
          configId: config.id,
          modelName: config.displayName,
          progress: 0,
          loaded: 0,
          total: 0,
        },
      })

      // Loading the pipeline triggers the download and caches it
      // Always WASM for pre-download to avoid GPU memory allocation (per CTRL-01)
      const generator = await pipeline('text-generation', config.modelId, {
        dtype: config.quantization as 'q4' | 'q8' | 'fp16' | 'fp32',
        device: 'wasm',
        progress_callback: (progress: Record<string, unknown>) => {
          post({
            type: 'download-progress',
            data: {
              configId: config.id,
              modelName: config.displayName,
              progress: (progress.progress as number) ?? 0,
              loaded: (progress.loaded as number) ?? 0,
              total: (progress.total as number) ?? 0,
            },
          })
        },
      })

      // Dispose immediately — we just wanted to cache the files
      await generator.dispose()

      if (cancelled) break

      post({
        type: 'download-progress',
        data: {
          configId: config.id,
          modelName: config.displayName,
          progress: 100,
          loaded: 0,
          total: 0,
        },
      })
    } catch (err) {
      post({
        type: 'error',
        configId: config.id,
        modelName: config.displayName,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  post({ type: 'download-complete' })
}

async function handleRun(
  prompt: string,
  params: GenerationParameters,
  configs: TestConfig[]
) {
  const localConfigs = configs.filter((c) => c.backend !== 'api')
  const total = localConfigs.length

  for (let i = 0; i < localConfigs.length; i++) {
    if (cancelled) break

    const config = localConfigs[i]

    post({
      type: 'run-started',
      configId: config.id,
      modelName: config.displayName,
      currentIndex: i,
      totalModels: total,
    })

    try {
      const result = await runSingleModel(config, prompt, params, i, total)
      post({ type: 'run-complete', result })
    } catch (err) {
      const errorResult: TestResult = {
        config,
        metrics: {
          modelSize: null,
          loadTime: null,
          initTime: null,
          ttft: 0,
          tokensPerSecond: 0,
          totalTime: 0,
          tokenCount: 0,
        },
        output: '',
        rating: null,
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      }
      post({ type: 'run-complete', result: errorResult })
    }
  }

  if (!cancelled) {
    post({ type: 'all-complete' })
  }
}

async function runSingleModel(
  config: TestConfig,
  prompt: string,
  params: GenerationParameters,
  currentIndex: number,
  totalModels: number
): Promise<TestResult> {
  // Phase: Loading
  postProgress(config, currentIndex, totalModels, 'loading', 0, 0, 0, '')
  const loadStart = performance.now()

  const generator = await pipeline('text-generation', config.modelId, {
    dtype: config.quantization as 'q4' | 'q8' | 'fp16' | 'fp32',
    device: config.backend as 'webgpu' | 'wasm',
  }) as TextGenerationPipeline

  const loadTime = performance.now() - loadStart

  // Phase: Initializing
  postProgress(config, currentIndex, totalModels, 'initializing', 0, 0, loadTime, '')
  const initStart = performance.now()

  // Warm-up with a short generation
  await generator('test', { max_new_tokens: 1 })
  const initTime = performance.now() - initStart

  // Phase: Generating
  let streamedText = ''
  let tokenCount = 0
  let firstTokenTime = 0
  const genStart = performance.now()

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
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
    callback_function: (text: string) => {
      streamedText += text
    },
  })

  const messages = [{ role: 'user' as const, content: prompt }]

  await generator(messages, {
    max_new_tokens: params.maxTokens,
    temperature: params.temperature,
    top_p: params.topP,
    repetition_penalty: params.repeatPenalty,
    do_sample: params.temperature > 0,
    streamer,
  })

  const totalGenTime = performance.now() - genStart

  // Post-generation: recalculate with tokenizer for definitive accuracy (per D-01)
  const finalTokenIds = generator.tokenizer.encode(streamedText, {
    add_special_tokens: false,
  })
  const finalTokenCount = Array.isArray(finalTokenIds) ? finalTokenIds.length : tokenCount

  const totalTime = loadTime + initTime + totalGenTime
  const tokensPerSecond = finalTokenCount > 0 ? (finalTokenCount / (totalGenTime / 1000)) : 0

  // Estimate model size from cache
  let modelSize: number | null = null
  try {
    const cache = await caches.open('transformers-cache')
    const keys = await cache.keys()
    const modelKeys = keys.filter((k) => k.url.includes(config.modelId.replace('/', '%2F')) || k.url.includes(config.modelId))
    let size = 0
    for (const key of modelKeys) {
      const response = await cache.match(key)
      if (response) {
        const blob = await response.clone().blob()
        size += blob.size
      }
    }
    if (size > 0) modelSize = size
  } catch {
    // Cache size estimation is best-effort
  }

  // Dispose
  postProgress(config, currentIndex, totalModels, 'disposing', finalTokenCount, tokensPerSecond, totalTime, streamedText)
  await generator.dispose()

  const metrics: TestMetrics = {
    modelSize,
    loadTime,
    initTime,
    ttft: firstTokenTime,
    tokensPerSecond,
    totalTime,
    tokenCount: finalTokenCount,
  }

  return {
    config,
    metrics,
    output: streamedText,
    rating: null,
    timestamp: Date.now(),
  }
}

function postProgress(
  config: TestConfig,
  currentIndex: number,
  totalModels: number,
  phase: 'loading' | 'initializing' | 'generating' | 'disposing',
  tokensGenerated: number,
  tokensPerSecond: number,
  elapsedMs: number,
  streamedText: string
) {
  post({
    type: 'run-progress',
    data: {
      configId: config.id,
      modelName: config.displayName,
      currentIndex,
      totalModels,
      phase,
      tokensGenerated,
      tokensPerSecond,
      elapsedMs,
      streamedText,
    },
  })
}
