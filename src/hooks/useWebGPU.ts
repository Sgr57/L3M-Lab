import { useEffect } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { detectWebGPU } from '../lib/webgpuDetect'

export function useWebGPU() {
  const setWebGPUSupported = useSettingsStore((s) => s.setWebGPUSupported)

  useEffect(() => {
    detectWebGPU().then(setWebGPUSupported)
  }, [setWebGPUSupported])
}
