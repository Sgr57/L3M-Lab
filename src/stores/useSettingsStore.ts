import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GenerationParameters } from '../types'

interface SettingsState {
  apiKeys: {
    openai: string
    anthropic: string
    google: string
  }
  webgpuSupported: boolean | null
  parameters: GenerationParameters
  setApiKey: (provider: 'openai' | 'anthropic' | 'google', key: string) => void
  setWebGPUSupported: (supported: boolean) => void
  setParameter: <K extends keyof GenerationParameters>(key: K, value: GenerationParameters[K]) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {
        openai: '',
        anthropic: '',
        google: '',
      },
      webgpuSupported: null,
      parameters: {
        temperature: 0.7,
        maxTokens: 256,
        topP: 0.9,
        repeatPenalty: 1.1,
      },
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),
      setWebGPUSupported: (supported) =>
        set({ webgpuSupported: supported }),
      setParameter: (key, value) =>
        set((state) => ({
          parameters: { ...state.parameters, [key]: value },
        })),
    }),
    {
      name: 'compare-llm-settings',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        parameters: state.parameters,
      }),
    }
  )
)
