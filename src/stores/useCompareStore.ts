import { create } from 'zustand'
import type {
  TestConfig,
  TestResult,
  ExecutionStatus,
  RunProgress,
  MultiModelDownloadProgress,
  ModelDownloadStatus,
} from '../types'

interface CompareState {
  prompt: string
  configs: TestConfig[]
  results: TestResult[]
  executionStatus: ExecutionStatus
  runProgress: RunProgress | null
  downloadProgress: MultiModelDownloadProgress | null

  setPrompt: (prompt: string) => void
  addConfig: (config: TestConfig) => void
  removeConfig: (configId: string) => void
  updateConfig: (configId: string, updates: Partial<Pick<TestConfig, 'quantization' | 'backend' | 'estimatedSize' | 'cached'>>) => void
  setExecutionStatus: (status: ExecutionStatus) => void
  setRunProgress: (progress: RunProgress | null) => void
  setDownloadProgress: (progress: MultiModelDownloadProgress | null) => void
  updateModelDownloadStatus: (configId: string, update: Partial<Pick<ModelDownloadStatus, 'status' | 'progress' | 'loaded' | 'total' | 'error'>>) => void
  addResult: (result: TestResult) => void
  updateRating: (configId: string, rating: number) => void
  reset: () => void
}

export const useCompareStore = create<CompareState>()((set) => ({
  prompt: '',
  configs: [],
  results: [],
  executionStatus: 'idle',
  runProgress: null,
  downloadProgress: null,

  setPrompt: (prompt) => set({ prompt }),

  addConfig: (config) =>
    set((state) => ({
      configs: [...state.configs, config],
    })),

  removeConfig: (configId) =>
    set((state) => ({
      configs: state.configs.filter((c) => c.id !== configId),
    })),

  updateConfig: (configId, updates) =>
    set((state) => ({
      configs: state.configs.map((c) =>
        c.id === configId ? { ...c, ...updates } : c
      ),
    })),

  setExecutionStatus: (status) => set({ executionStatus: status }),

  setRunProgress: (progress) => set({ runProgress: progress }),

  setDownloadProgress: (progress) => set({ downloadProgress: progress }),

  updateModelDownloadStatus: (configId, update) =>
    set((state) => ({
      downloadProgress: state.downloadProgress ? {
        ...state.downloadProgress,
        models: state.downloadProgress.models.map((m) =>
          m.configId === configId ? { ...m, ...update } : m
        ),
      } : null,
    })),

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
