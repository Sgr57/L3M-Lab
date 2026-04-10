import { create } from 'zustand'
import type {
  TestConfig,
  TestResult,
  GenerationParameters,
  ExecutionStatus,
  RunProgress,
  DownloadProgress,
} from '../types'

interface CompareState {
  prompt: string
  parameters: GenerationParameters
  configs: TestConfig[]
  results: TestResult[]
  executionStatus: ExecutionStatus
  runProgress: RunProgress | null
  downloadProgress: DownloadProgress | null

  setPrompt: (prompt: string) => void
  setParameter: <K extends keyof GenerationParameters>(key: K, value: GenerationParameters[K]) => void
  addConfig: (config: TestConfig) => void
  removeConfig: (configId: string) => void
  setExecutionStatus: (status: ExecutionStatus) => void
  setRunProgress: (progress: RunProgress | null) => void
  setDownloadProgress: (progress: DownloadProgress | null) => void
  addResult: (result: TestResult) => void
  updateRating: (configId: string, rating: number) => void
  reset: () => void
}

const defaultParameters: GenerationParameters = {
  temperature: 0.7,
  maxTokens: 256,
  topP: 0.9,
  repeatPenalty: 1.1,
}

export const useCompareStore = create<CompareState>()((set) => ({
  prompt: '',
  parameters: defaultParameters,
  configs: [],
  results: [],
  executionStatus: 'idle',
  runProgress: null,
  downloadProgress: null,

  setPrompt: (prompt) => set({ prompt }),

  setParameter: (key, value) =>
    set((state) => ({
      parameters: { ...state.parameters, [key]: value },
    })),

  addConfig: (config) =>
    set((state) => ({
      configs: [...state.configs, config],
    })),

  removeConfig: (configId) =>
    set((state) => ({
      configs: state.configs.filter((c) => c.id !== configId),
    })),

  setExecutionStatus: (status) => set({ executionStatus: status }),

  setRunProgress: (progress) => set({ runProgress: progress }),

  setDownloadProgress: (progress) => set({ downloadProgress: progress }),

  addResult: (result) =>
    set((state) => ({
      results: [...state.results, result],
    })),

  updateRating: (configId, rating) =>
    set((state) => ({
      results: state.results.map((r) =>
        r.config.id === configId ? { ...r, rating } : r
      ),
    })),

  reset: () =>
    set({
      results: [],
      executionStatus: 'idle',
      runProgress: null,
      downloadProgress: null,
    }),
}))
