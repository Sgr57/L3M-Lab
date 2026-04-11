import { useCompareStore } from '../../stores/useCompareStore'
import { startDownload, cancelExecution } from '../../lib/workerBridge'
import { formatSize } from '../../lib/formatSize'

export function PreDownload(): React.ReactElement | null {
  const configs = useCompareStore((s) => s.configs)
  const status = useCompareStore((s) => s.executionStatus)
  const downloadProgress = useCompareStore((s) => s.downloadProgress)

  const isBusy = status === 'running' || status === 'downloading'
  const isDownloading = status === 'downloading'

  // Filter to local models only (backend !== 'api')
  const localConfigs = configs.filter((c) => c.backend !== 'api')

  // If no local models selected, hide the section entirely.
  // D-05 says "always visible when local models are selected,"
  // which implies no purpose when none are selected.
  if (localConfigs.length === 0) return null

  // Separate cached vs uncached
  const uncachedConfigs = localConfigs.filter((c) => !c.cached)
  const allCached = uncachedConfigs.length === 0

  // Calculate total estimated download size from real estimatedSize (per D-08)
  // Use estimatedSize from TestConfig (bytes from HF API), default to 0 if undefined
  const totalSize = uncachedConfigs.reduce((acc, c) => acc + (c.estimatedSize ?? 0), 0)

  // Filter to local configs before calling startDownload to make intent explicit.
  // Note: startDownload() also filters internally, but passing only local configs
  // at the call site makes the intent clear and avoids confusion.
  const handleDownload = (): void => startDownload(localConfigs)

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Pre-Download
        </div>
        <div className="flex items-center gap-3">
          {isDownloading && (
            <button
              type="button"
              className="rounded-lg border border-primary px-4 py-1.5 text-xs font-semibold text-primary bg-surface"
              onClick={() => cancelExecution()}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="rounded-lg border border-primary px-4 py-1.5 text-xs font-semibold text-primary bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isBusy || allCached}
            onClick={handleDownload}
          >
            {allCached ? 'All Models Cached' : `Download ${uncachedConfigs.length} Model${uncachedConfigs.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Info line: model count and total size (per D-08) */}
      {!allCached && !isDownloading && (
        <div className="mb-3 text-xs text-text-secondary">
          {uncachedConfigs.length} model{uncachedConfigs.length !== 1 ? 's' : ''} to download
          {totalSize > 0 ? ` \u00b7 ${formatSize(totalSize)}` : ''}
        </div>
      )}

      {allCached && !isDownloading && (
        <div className="text-xs text-success">
          All {localConfigs.length} local model{localConfigs.length !== 1 ? 's' : ''} cached
        </div>
      )}

      {/* Per-model progress list during download (per D-06) */}
      {isDownloading && downloadProgress && (
        <div className="space-y-2">
          {downloadProgress.models.map((model) => (
            <div key={model.configId} className="flex items-center gap-3 text-xs">
              {/* Status indicator */}
              <div className="w-4 flex-shrink-0 text-center">
                {model.status === 'complete' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {model.status === 'error' && (
                  <span className="text-error font-bold">!</span>
                )}
                {model.status === 'downloading' && (
                  <span className="text-primary font-bold animate-pulse">&darr;</span>
                )}
                {model.status === 'waiting' && (
                  <span className="text-text-tertiary">&middot;</span>
                )}
              </div>

              {/* Model name */}
              <span className={`w-48 truncate ${model.status === 'complete' ? 'text-text-secondary' : model.status === 'downloading' ? 'text-text-primary font-medium' : 'text-text-tertiary'}`}>
                {model.modelName}
              </span>

              {/* Progress bar or status text */}
              <div className="flex-1">
                {(model.status === 'downloading' || model.status === 'complete') && (
                  <div className="h-1.5 w-full rounded-full bg-border-light overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${model.status === 'complete' ? 'bg-success' : 'bg-primary'}`}
                      style={{ width: `${model.status === 'complete' ? 100 : Math.min(model.progress, 100)}%` }}
                    />
                  </div>
                )}
                {model.status === 'waiting' && (
                  <span className="text-text-tertiary">Waiting</span>
                )}
                {model.status === 'error' && (
                  <span className="text-error">{model.error ?? 'Error'}</span>
                )}
              </div>

              {/* Percentage or Done label */}
              <span className="w-12 text-right text-text-secondary text-[11px]">
                {model.status === 'downloading' && `${Math.round(model.progress)}%`}
                {model.status === 'complete' && <span className="text-success">Done</span>}
                {model.status === 'waiting' && ''}
                {model.status === 'error' && ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
