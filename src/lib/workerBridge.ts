import type { WorkerCommand, WorkerEvent } from '../types/worker-messages'
import type { TestConfig, GenerationParameters } from '../types'
import { useCompareStore } from '../stores/useCompareStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { callOpenAI, callAnthropic, callGoogle } from './cloudApis'

let worker: Worker | null = null

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
    case 'download-progress':
      store.setDownloadProgress(event.data)
      break

    case 'download-complete':
      store.setExecutionStatus('idle')
      store.setDownloadProgress(null)
      break

    case 'run-started':
      store.setRunProgress({
        configId: event.configId,
        modelName: event.modelName,
        currentIndex: event.currentIndex,
        totalModels: event.totalModels,
        phase: 'loading',
        tokensGenerated: 0,
        tokensPerSecond: 0,
        elapsedMs: 0,
        streamedText: '',
      })
      break

    case 'run-progress':
      store.setRunProgress(event.data)
      break

    case 'run-complete':
      store.addResult(event.result)
      break

    case 'all-complete':
      store.setExecutionStatus('complete')
      store.setRunProgress(null)
      break

    case 'error':
      if (event.configId) {
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
  }
}

export function startDownload(configs: TestConfig[]) {
  const store = useCompareStore.getState()
  store.setExecutionStatus('downloading')

  const cmd: WorkerCommand = { type: 'download', configs }
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

  // Separate cloud and local configs
  const cloudConfigs = configs.filter((c) => c.backend === 'api')
  const localConfigs = configs.filter((c) => c.backend !== 'api')

  // Run cloud models from main thread
  for (const config of cloudConfigs) {
    try {
      store.setRunProgress({
        configId: config.id,
        modelName: config.displayName,
        currentIndex: configs.indexOf(config),
        totalModels: configs.length,
        phase: 'generating',
        tokensGenerated: 0,
        tokensPerSecond: 0,
        elapsedMs: 0,
        streamedText: '',
      })

      const result = await runCloudModel(config, prompt, params)
      store.addResult(result)
    } catch (err) {
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
        error: err instanceof Error ? err.message : String(err),
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

  const cmd: WorkerCommand = { type: 'cancel' }
  getWorker().postMessage(cmd)
}
