export type Quantization = 'q4' | 'q8' | 'fp16' | 'fp32'
export type Backend = 'webgpu' | 'wasm' | 'api'
export type CloudProvider = 'openai' | 'anthropic' | 'google'
export type CloudErrorCategory = 'cors' | 'auth' | 'rate-limit' | 'timeout' | 'server' | 'unknown'

export type ExecutionStatus =
  | 'idle'
  | 'downloading'
  | 'running'
  | 'complete'
  | 'error'
  | 'cancelled'

export interface TestConfig {
  id: string
  modelId: string
  displayName: string
  quantization: Quantization
  backend: Backend
  provider?: CloudProvider
  cloudModel?: string
  estimatedSize?: number   // bytes, from HF API siblings
  cached?: boolean         // from browser Cache API
}

export interface TestMetrics {
  modelSize: number | null
  loadTime: number | null
  initTime: number | null
  ttft: number
  tokensPerSecond: number
  totalTime: number
  tokenCount: number
}

export interface TestResult {
  config: TestConfig
  metrics: TestMetrics
  output: string
  rating: number | null
  timestamp: number
  error?: string
  fallbackBackend?: Backend
  errorCategory?: CloudErrorCategory
  errorHint?: string
  rawError?: string
}

export interface GenerationParameters {
  temperature: number
  maxTokens: number
  topP: number
  repeatPenalty: number
}

export interface ComparisonRun {
  id: string
  prompt: string
  parameters: GenerationParameters
  configs: TestConfig[]
  results: TestResult[]
  startedAt: number
  completedAt: number
}

export interface HFModelResult {
  modelId: string
  name: string
  downloads: number
  likes: number
  pipelineTag: string
  libraryName: string
  availableQuantizations: Quantization[]
}

export interface RunProgress {
  configId: string
  modelName: string
  currentIndex: number
  totalModels: number
  phase: 'loading' | 'initializing' | 'generating' | 'disposing' | 'cloud-pending' | 'cloud-complete'
  tokensGenerated: number
  tokensPerSecond: number
  elapsedMs: number
  streamedText: string
}

export interface DownloadProgress {
  configId: string
  modelName: string
  progress: number
  loaded: number
  total: number
}

export interface ModelDownloadStatus {
  configId: string
  modelName: string
  status: 'waiting' | 'downloading' | 'complete' | 'error'
  progress: number   // 0-100
  loaded: number     // bytes loaded
  total: number      // bytes total
  error?: string
}

export interface MultiModelDownloadProgress {
  models: ModelDownloadStatus[]
  currentIndex: number
}

export interface CacheEntry {
  modelId: string      // e.g., "HuggingFaceTB/SmolLM2-135M-Instruct"
  filepath: string     // e.g., "onnx/model_q4.onnx"
  url: string          // full URL (cache key)
  size: number         // bytes from Content-Length or blob
}

export interface CachedQuantInfo {
  quantization: string          // e.g., "q4", "fp16"
  size: number                  // total bytes for this quant
  lastUsed: number | null       // from useModelUsageStore
  files: string[]               // list of cached filepaths
}

export interface CachedModelInfo {
  modelId: string
  totalSize: number
  lastUsed: number | null       // most recent across all quants
  quantizations: CachedQuantInfo[]
}
