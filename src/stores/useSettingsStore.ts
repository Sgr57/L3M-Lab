import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  apiKeys: {
    openai: string
    anthropic: string
    google: string
  }
  webgpuSupported: boolean | null
  setApiKey: (provider: 'openai' | 'anthropic' | 'google', key: string) => void
  setWebGPUSupported: (supported: boolean) => void
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
      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),
      setWebGPUSupported: (supported) =>
        set({ webgpuSupported: supported }),
    }),
    {
      name: 'compare-llm-settings',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
      }),
    }
  )
)
