import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { startComparison, cancelExecution } from '../../lib/workerBridge'
import { formatSize } from '../../lib/formatSize'

export function TestControls(): React.ReactElement {
  const prompt = useCompareStore((s) => s.prompt)
  const configs = useCompareStore((s) => s.configs)
  const status = useCompareStore((s) => s.executionStatus)
  const parameters = useSettingsStore((s) => s.parameters)

  const isBusy = status === 'running' || status === 'downloading'
  const hasConfigs = configs.length > 0
  const hasPrompt = prompt.trim().length > 0

  // Calculate estimated download from real estimatedSize bytes (per D-10)
  const totalDownloadSize = configs
    .filter((c) => c.backend !== 'api' && !c.cached)
    .reduce((acc, c) => acc + (c.estimatedSize ?? 0), 0)

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-text-secondary">
        {configs.length} model{configs.length !== 1 ? 's' : ''} selected
        {totalDownloadSize > 0 ? ` \u00b7 Est. download: ${formatSize(totalDownloadSize)}` : ''}
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
