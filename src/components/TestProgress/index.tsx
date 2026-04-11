import { useState, useEffect, useRef } from 'react'
import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import type { RunProgress } from '../../types'

const PHASE_LABELS: Record<string, string> = {
  loading: 'Loading model\u2026',
  initializing: 'Initializing\u2026',
  generating: 'Generating\u2026',
  disposing: 'Cleaning up\u2026',
  'cloud-pending': 'Waiting for response\u2026',
  'cloud-complete': 'Complete',
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return minutes > 0
    ? `${minutes}m ${remaining.toString().padStart(2, '0')}s`
    : `${seconds}s`
}

function formatCloudElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

function calculateWeightedProgress(
  currentIndex: number,
  totalModels: number,
  phase: RunProgress['phase'],
  tokensGenerated: number,
  maxTokens: number
): number {
  if (totalModels === 0) return 0

  const completedSlice = (currentIndex / totalModels) * 100
  const modelSlice = 100 / totalModels

  let phaseProgress: number
  switch (phase) {
    case 'loading':
      phaseProgress = 0.05 // midpoint of 0-10% range for visual smoothness
      break
    case 'initializing':
      phaseProgress = 0.15 // midpoint of 10-20% range
      break
    case 'generating': {
      const genProgress = maxTokens > 0
        ? Math.min(tokensGenerated / maxTokens, 1)
        : 0
      phaseProgress = 0.20 + (genProgress * 0.80)
      break
    }
    case 'disposing':
      phaseProgress = 1.0
      break
    case 'cloud-pending':
      phaseProgress = 0
      break
    case 'cloud-complete':
      phaseProgress = 1.0
      break
    default:
      phaseProgress = 0
  }

  return Math.min(completedSlice + (modelSlice * phaseProgress), 100)
}

export function TestProgress(): React.ReactNode {
  const runProgress = useCompareStore((s) => s.runProgress)
  const status = useCompareStore((s) => s.executionStatus)
  const maxTokens = useSettingsStore((s) => s.parameters.maxTokens)

  const [cloudElapsed, setCloudElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (runProgress?.phase === 'cloud-pending') {
      const start = Date.now()
      intervalRef.current = setInterval(() => {
        setCloudElapsed(Date.now() - start)
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setCloudElapsed(0)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [runProgress?.phase, runProgress?.configId])

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

  const isCloud = phase === 'cloud-pending' || phase === 'cloud-complete'
  const backendLabel = isCloud ? 'cloud' : 'local'
  const backendType = isCloud ? 'api' : 'webgpu' // badge color key

  // Weighted progress bar calculation per D-01, D-02
  const progressPct = Math.round(
    calculateWeightedProgress(currentIndex, totalModels, phase, tokensGenerated, maxTokens)
  )

  return (
    <div className="rounded-xl border border-border border-l-[3px] border-l-warning bg-surface p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary">{modelName}</span>
          <BackendBadge type={backendLabel} backend={backendType} />
          <span className="text-text-tertiary">
            ({currentIndex + 1}/{totalModels})
          </span>
        </div>
        <span className="text-text-secondary">{PHASE_LABELS[phase] ?? phase}</span>
      </div>

      {/* Stats -- show cloud timer OR local metrics */}
      {phase === 'cloud-pending' ? (
        <div className="mb-3 flex gap-5 text-xs text-text-secondary">
          <span>
            Elapsed: <span className="font-semibold text-text-primary">{formatCloudElapsed(cloudElapsed)}</span>
          </span>
        </div>
      ) : (
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
      )}

      {/* Progress bar */}
      <div className="bg-border-light rounded-md h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-primary to-[#218bff] h-full rounded-md transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Streaming output -- only for local models during generation */}
      {streamedText && phase !== 'cloud-pending' && phase !== 'cloud-complete' && (
        <div className="mt-3 rounded-lg border border-border bg-bg p-3 text-[13px] text-text-secondary max-h-[60px] overflow-hidden">
          {streamedText}
        </div>
      )}
    </div>
  )
}

function BackendBadge({ type, backend }: { type: string; backend: string }): React.ReactNode {
  const cls =
    type === 'cloud'
      ? 'bg-cloud-bg text-cloud'
      : backend === 'wasm'
        ? 'bg-wasm-bg text-wasm'
        : 'bg-webgpu-bg text-primary'

  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {type === 'cloud' ? 'cloud' : backend === 'wasm' ? 'wasm' : 'webgpu'}
    </span>
  )
}
