import type { WorkerCommand, WorkerEvent } from '../types/worker-messages'
import type { TestConfig, GenerationParameters, ModelDownloadStatus } from '../types'
import { useCompareStore } from '../stores/useCompareStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useModelUsageStore } from '../stores/useModelUsageStore'
import { callOpenAI, callAnthropic, callGoogle, CloudApiError, classifyCloudError } from './cloudApis'

let worker: Worker | null = null
let totalModelCount = 0  // Set by startComparison, used to adjust worker progress
let cloudModelOffset = 0  // Number of cloud models completed before worker starts

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = handleWorkerEvent
  }
  return worker
}

function handleWorkerEvent(e: MessageEvent<WorkerEvent>) {
  const store = useCompareStore.getState()
  const event = e.data

  switch (event.type) {
    case 'download-progress': {
      const { configId, progress } = event.data
      const currentStatus = progress >= 100 ? 'complete' as const : 'downloading' as const
      store.updateModelDownloadStatus(configId, {
        status: currentStatus,
        progress: event.data.progress,
        loaded: event.data.loaded,
        total: event.data.total,
      })

      // Update currentIndex to match this configId's position
      const dp = store.downloadProgress
      if (dp) {
        const idx = dp.models.findIndex((m) => m.configId === configId)
        if (idx >= 0 && idx !== dp.currentIndex) {
          store.setDownloadProgress({ ...dp, currentIndex: idx })
        }
      }
      break
    }

    case 'download-complete': {
      // Mark all successfully downloaded models as cached in configs
      const dp = store.downloadProgress
      if (dp) {
        for (const model of dp.models) {
          if (model.status === 'complete') {
            store.updateConfig(model.configId, { cached: true })
          }
        }
      }
      store.setExecutionStatus('idle')
      store.setDownloadProgress(null)

      // Terminate worker after download to clean up WASM/ONNX runtime state.
      // A fresh worker is created on the next operation.
      if (worker) {
        worker.terminate()
        worker = null
      }
      break
    }

    case 'run-started':
      store.setRunProgress({
        configId: event.configId,
        modelName: event.modelName,
        currentIndex: cloudModelOffset + event.currentIndex,
        totalModels: totalModelCount,
        phase: 'loading',
        tokensGenerated: 0,
        tokensPerSecond: 0,
        elapsedMs: 0,
        streamedText: '',
      })
      break

    case 'run-progress':
      store.setRunProgress({
        ...event.data,
        currentIndex: cloudModelOffset + event.data.currentIndex,
        totalModels: totalModelCount,
      })
      break

    case 'run-complete':
      store.addResult(event.result)
      break

    case 'all-complete':
      store.setExecutionStatus('complete')
      store.setRunProgress(null)
      break

    case 'error':
      // Mark model as errored in download progress if downloading
      if (event.configId && store.downloadProgress) {
        store.updateModelDownloadStatus(event.configId, {
          status: 'error',
          error: event.message,
        })
      }
      // Existing run-error handling
      if (event.configId && store.executionStatus === 'running') {
        store.addResult({
          config: store.configs.find((c) => c.id === event.configId)!,
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
          error: event.message,
        })
      }
      break

    case 'device-lost':
      store.setFallbackWarning(event.message)
      break
  }
}

export function startDownload(configs: TestConfig[]) {
  const store = useCompareStore.getState()
  // Only download uncached local models — cached models already have files
  // in the Cache API and don't need pipeline() (which would fail for some
  // quantized ops not supported in WASM)
  const uncachedLocal = configs.filter((c) => c.backend !== 'api' && !c.cached)

  if (uncachedLocal.length === 0) return

  // Initialize multi-model download progress
  const models: ModelDownloadStatus[] = uncachedLocal.map((c) => ({
    configId: c.id,
    modelName: c.displayName,
    status: 'waiting' as const,
    progress: 0,
    loaded: 0,
    total: 0,
  }))

  store.setDownloadProgress({ models, currentIndex: 0 })
  store.setExecutionStatus('downloading')

  const cmd: WorkerCommand = { type: 'download', configs: uncachedLocal }
  getWorker().postMessage(cmd)
}

export async function startComparison(
  prompt: string,
  params: GenerationParameters,
  configs: TestConfig[]
) {
  const store = useCompareStore.getState()
  store.reset()
  store.setExecutionStatus('running')

  // Track model usage timestamps for cache management
  for (const config of configs) {
    if (config.backend !== 'api') {
      useModelUsageStore.getState().setLastUsed(config.modelId, config.quantization)
    }
  }

  // Separate cloud and local configs
  const cloudConfigs = configs.filter((c) => c.backend === 'api')
  const localConfigs = configs.filter((c) => c.backend !== 'api')

  // Set module-level counters for worker progress adjustment
  cloudModelOffset = cloudConfigs.length
  totalModelCount = configs.length

  // Run cloud models from main thread
  for (let i = 0; i < cloudConfigs.length; i++) {
    const config = cloudConfigs[i]
    try {
      store.setRunProgress({
        configId: config.id,
        modelName: config.displayName,
        currentIndex: i,
        totalModels: configs.length,
        phase: 'cloud-pending',
        tokensGenerated: 0,
        tokensPerSecond: 0,
        elapsedMs: 0,
        streamedText: '',
      })

      const result = await runCloudModel(config, prompt, params)

      // Update progress to cloud-complete before adding result
      store.setRunProgress({
        configId: config.id,
        modelName: config.displayName,
        currentIndex: i,
        totalModels: configs.length,
        phase: 'cloud-complete',
        tokensGenerated: result.metrics.tokenCount,
        tokensPerSecond: result.metrics.tokensPerSecond,
        elapsedMs: result.metrics.totalTime,
        streamedText: '',
      })
      store.addResult(result)
    } catch (err) {
      // Classify the error using the new error classification system
      let category: import('../types').CloudErrorCategory = 'unknown'
      let hint = 'An unexpected error occurred.'
      let rawError = err instanceof Error ? err.message : String(err)

      if (err instanceof CloudApiError) {
        const classified = classifyCloudError(err, err.provider, err.status)
        category = classified.category
        hint = classified.hint
        rawError = classified.rawError
      } else {
        const classified = classifyCloudError(err, config.provider ?? 'unknown')
        category = classified.category
        hint = classified.hint
        rawError = classified.rawError
      }

      store.addResult({
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
        error: hint,
        errorCategory: category,
        errorHint: hint,
        rawError: rawError,
      })
    }
  }

  // Run local models in worker
  if (localConfigs.length > 0) {
    const cmd: WorkerCommand = { type: 'run', prompt, params, configs: localConfigs }
    getWorker().postMessage(cmd)
  } else {
    store.setExecutionStatus('complete')
    store.setRunProgress(null)
  }
}

async function runCloudModel(
  config: TestConfig,
  prompt: string,
  params: GenerationParameters
) {
  const apiKeys = useSettingsStore.getState().apiKeys
  const model = config.cloudModel ?? ''

  let response
  switch (config.provider) {
    case 'openai':
      response = await callOpenAI(apiKeys.openai, model, prompt, params)
      break
    case 'anthropic':
      response = await callAnthropic(apiKeys.anthropic, model, prompt, params)
      break
    case 'google':
      response = await callGoogle(apiKeys.google, model, prompt, params)
      break
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }

  return {
    config,
    metrics: {
      modelSize: null,
      loadTime: null,
      initTime: null,
      ...response.metrics,
    },
    output: response.output,
    rating: null,
    timestamp: Date.now(),
  }
}

export function cancelExecution() {
  const store = useCompareStore.getState()
  store.setExecutionStatus('cancelled')
  store.setRunProgress(null)
  store.setDownloadProgress(null)
  totalModelCount = 0
  cloudModelOffset = 0

  // Terminate the worker to force-stop downloads/runs.
  // pipeline() is not abortable, so posting 'cancel' only works between models.
  // Terminating ensures the WASM/ONNX runtime is fully cleaned up — a fresh
  // worker is created on the next startDownload/startComparison call.
  if (worker) {
    worker.terminate()
    worker = null
  }
}
