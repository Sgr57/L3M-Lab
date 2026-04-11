import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { startComparison, cancelExecution } from '../../lib/workerBridge'

export function TestControls(): React.ReactElement {
  const prompt = useCompareStore((s) => s.prompt)
  const configs = useCompareStore((s) => s.configs)
  const status = useCompareStore((s) => s.executionStatus)
  const parameters = useSettingsStore((s) => s.parameters)

  const isBusy = status === 'running' || status === 'downloading'
  const hasConfigs = configs.length > 0
  const hasPrompt = prompt.trim().length > 0

  // Check if any local model still needs downloading
  const uncachedLocalModels = configs.filter((c) => c.backend !== 'api' && !c.cached)
  const hasUncachedModels = uncachedLocalModels.length > 0

  const canRun = !isBusy && hasConfigs && hasPrompt && !hasUncachedModels

  // Determine why the button is disabled
  let disabledReason = ''
  if (isBusy) disabledReason = 'Execution in progress...'
  else if (!hasConfigs) disabledReason = 'Select at least one model'
  else if (!hasPrompt) disabledReason = 'Enter a prompt'
  else if (hasUncachedModels) disabledReason = `${uncachedLocalModels.length} model${uncachedLocalModels.length !== 1 ? 's' : ''} not downloaded yet`

  return (
    <div className="flex items-center justify-between gap-4">
      {disabledReason ? (
        <span className="text-xs text-text-tertiary">{disabledReason}</span>
      ) : (
        <span className="text-xs text-text-secondary">
          {configs.length} model{configs.length !== 1 ? 's' : ''} ready
        </span>
      )}

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
          disabled={!canRun}
          onClick={() => startComparison(prompt, parameters, configs)}
          title={disabledReason || undefined}
        >
          Run Comparison
        </button>
      </div>
    </div>
  )
}
