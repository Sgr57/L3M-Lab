import type { TestConfig, GenerationParameters, TestResult, RunProgress, DownloadProgress, ErrorCategory } from '.'

// Main thread → Worker
export type WorkerCommand =
  | { type: 'download'; configs: TestConfig[] }
  | { type: 'run'; prompt: string; params: GenerationParameters; configs: TestConfig[] }
  | { type: 'cancel' }

// Worker → Main thread
export type WorkerEvent =
  | { type: 'download-progress'; data: DownloadProgress }
  | { type: 'download-complete' }
  | { type: 'run-started'; configId: string; modelName: string; currentIndex: number; totalModels: number }
  | { type: 'run-progress'; data: RunProgress }
  | { type: 'run-complete'; result: TestResult }
  | { type: 'all-complete' }
  | { type: 'error'; configId?: string; modelName?: string; message: string; retryable?: boolean; errorCategory?: ErrorCategory; errorHint?: string }
  | { type: 'device-lost'; message: string }
