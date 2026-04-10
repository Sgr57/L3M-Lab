import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { startDownload, startComparison, cancelExecution } from '../../lib/workerBridge'

export function TestControls() {
  const prompt = useCompareStore((s) => s.prompt)
  const parameters = useSettingsStore((s) => s.parameters)
  const configs = useCompareStore((s) => s.configs)
  const status = useCompareStore((s) => s.executionStatus)

  const isBusy = status === 'running' || status === 'downloading'
  const hasConfigs = configs.length > 0
  const hasPrompt = prompt.trim().length > 0

  const estimatedDownload = configs.reduce((acc, c) => {
    const sizeMap: Record<string, number> = { q4: 0.5, q8: 1, fp16: 2, fp32: 4 }
    return acc + (sizeMap[c.quantization] ?? 1)
  }, 0)

  const formatSize = (gb: number) =>
    gb >= 1 ? `${gb.toFixed(1)} GB` : `${(gb * 1024).toFixed(0)} MB`

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-text-secondary">
        {configs.length} model{configs.length !== 1 ? 's' : ''} selected
        {' \u00b7 '}
        Est. download: {formatSize(estimatedDownload)}
      </span>

      <div className="flex items-center gap-3">
        {isBusy && (
          <button
            type="button"
            className="rounded-lg border border-primary px-6 py-2.5 text-sm font-semibold text-primary bg-surface"
            onClick={() => cancelExecution()}
          >
            Cancel
          </button>
        )}

        <button
          type="button"
          className="rounded-lg border border-primary px-6 py-2.5 text-sm font-semibold text-primary bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={isBusy || !hasConfigs}
          onClick={() => startDownload(configs)}
        >
          Pre-Download Models
        </button>

        <button
          type="button"
          className="bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={isBusy || !hasConfigs || !hasPrompt}
          onClick={() => startComparison(prompt, parameters, configs)}
        >
          Run Comparison
        </button>
      </div>
    </div>
  )
}
