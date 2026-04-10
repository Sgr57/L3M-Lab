export type Quantization = 'q4' | 'q8' | 'fp16' | 'fp32'
export type Backend = 'webgpu' | 'wasm' | 'api'
export type CloudProvider = 'openai' | 'anthropic' | 'google'

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
  phase: 'loading' | 'initializing' | 'generating' | 'disposing'
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
