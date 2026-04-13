import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ModelUsageState {
  lastUsed: Record<string, number>  // key: "modelId::quantization", value: timestamp ms
  setLastUsed: (modelId: string, quantization: string) => void
  getLastUsed: (modelId: string, quantization: string) => number | null
  removeUsage: (modelId: string, quantization?: string) => void
}

export const useModelUsageStore = create<ModelUsageState>()(
  persist(
    (set, get) => ({
      lastUsed: {},
      setLastUsed: (modelId: string, quantization: string): void =>
        set((state) => ({
          lastUsed: { ...state.lastUsed, [`${modelId}::${quantization}`]: Date.now() },
        })),
      getLastUsed: (modelId: string, quantization: string): number | null =>
        get().lastUsed[`${modelId}::${quantization}`] ?? null,
      removeUsage: (modelId: string, quantization?: string): void =>
        set((state) => {
          const next = { ...state.lastUsed }
          if (quantization) {
            delete next[`${modelId}::${quantization}`]
          } else {
            for (const key of Object.keys(next)) {
              if (key.startsWith(`${modelId}::`)) delete next[key]
            }
          }
          return { lastUsed: next }
        }),
    }),
    { name: 'model-usage-tracking' }
  )
)
