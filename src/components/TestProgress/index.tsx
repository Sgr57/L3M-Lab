import { useCompareStore } from '../../stores/useCompareStore'

const PHASE_LABELS: Record<string, string> = {
  loading: 'Loading model\u2026',
  initializing: 'Initializing\u2026',
  generating: 'Generating\u2026',
  disposing: 'Cleaning up\u2026',
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return minutes > 0
    ? `${minutes}m ${remaining.toString().padStart(2, '0')}s`
    : `${seconds}s`
}

export function TestProgress() {
  const runProgress = useCompareStore((s) => s.runProgress)
  const status = useCompareStore((s) => s.executionStatus)

  // Download progress is shown exclusively in the PreDownload component
  if (status === 'downloading' || !runProgress) return null

  const {
    modelName,
    currentIndex,
    totalModels,
    phase,
    tokensGenerated,
    tokensPerSecond,
    elapsedMs,
    streamedText,
  } = runProgress

  const progressPct = totalModels > 0
    ? Math.round(((currentIndex + 1) / totalModels) * 100)
    : 0

  return (
    <div className="rounded-xl border border-border border-l-[3px] border-l-warning bg-surface p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary">{modelName}</span>
          <span className="text-text-tertiary">
            ({currentIndex + 1}/{totalModels})
          </span>
        </div>
        <span className="text-text-secondary">{PHASE_LABELS[phase] ?? phase}</span>
      </div>

      {/* Stats */}
      <div className="mb-3 flex gap-5 text-xs text-text-secondary">
        <span>
          Tokens: <span className="font-semibold text-text-primary">{tokensGenerated}</span>
        </span>
        <span>
          Speed: <span className="font-semibold text-text-primary">{tokensPerSecond.toFixed(1)} tok/s</span>
        </span>
        <span>
          Elapsed: <span className="font-semibold text-text-primary">{formatElapsed(elapsedMs)}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-border-light rounded-md h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-primary to-[#218bff] h-full rounded-md transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Streaming output */}
      {streamedText && (
        <div className="mt-3 rounded-lg border border-border bg-bg p-3 text-[13px] text-text-secondary max-h-[60px] overflow-hidden">
          {streamedText}
        </div>
      )}
    </div>
  )
}
