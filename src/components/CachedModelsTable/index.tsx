import { useState, useEffect, useImperativeHandle, forwardRef, Fragment } from 'react'
import { enumerateCache, groupByModelAndQuant, deleteCachedModel, getStaleModelKeys } from '../../lib/cacheManager'
import { useModelUsageStore } from '../../stores/useModelUsageStore'
import { useCompareStore } from '../../stores/useCompareStore'
import { isModelCached } from '../../lib/cacheCheck'
import { formatSize } from '../../lib/formatSize'
import { ConfirmModal } from '../ConfirmModal'
import type { CachedModelInfo } from '../../types'

/**
 * Format a timestamp into a relative time string (e.g., "2 hours ago").
 */
function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} minutes ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} hours ago`
  if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)} days ago`
  if (diffMs < 2_592_000_000) return `${Math.floor(diffMs / 604_800_000)} weeks ago`
  return `${Math.floor(diffMs / 2_592_000_000)} months ago`
}

/**
 * Return a Tailwind color class for the last-used timestamp.
 * - null (never used) -> tertiary
 * - Older than 2 weeks -> warning (stale)
 * - Otherwise -> secondary (recent)
 */
function lastUsedColorClass(lastUsed: number | null): string {
  if (lastUsed === null) return 'text-text-tertiary'
  if (Date.now() - lastUsed > 14 * 24 * 60 * 60 * 1000) return 'text-warning'
  return 'text-text-secondary'
}

const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000

export interface CachedModelsTableHandle {
  refresh: () => void
}

export const CachedModelsTable = forwardRef<CachedModelsTableHandle>(function CachedModelsTable(_props, ref): React.ReactElement {
  const [models, setModels] = useState<CachedModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<'modelId' | 'totalSize' | 'lastUsed'>('modelId')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  // Sync cache status with Compare page configs after any cache mutation
  async function syncCompareCacheStatus(): Promise<void> {
    const { configs, updateConfig } = useCompareStore.getState()
    const localConfigs = configs.filter((c) => c.backend !== 'api')
    for (const config of localConfigs) {
      const cached = await isModelCached(config.modelId, config.quantization)
      updateConfig(config.id, { cached })
    }
  }

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: () => setRefreshCounter((c) => c + 1),
  }))

  // Load cache entries on mount and whenever refreshCounter changes
  useEffect(() => {
    let cancelled = false

    async function loadCache(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const entries = await enumerateCache()
        if (cancelled) return
        const grouped = groupByModelAndQuant(entries, useModelUsageStore.getState())
        setModels(grouped)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(`Unable to read browser cache. Make sure you're using HTTPS and a supported browser. (${message})`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCache()
    return () => { cancelled = true }
  }, [refreshCounter])

  // Compute stale keys from current models
  const staleKeys = getStaleModelKeys(models, STALE_THRESHOLD_MS)

  // Sorting
  function handleSort(key: 'modelId' | 'totalSize' | 'lastUsed'): void {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Default direction: asc for text, desc for numeric/date
      setSortDir(key === 'modelId' ? 'asc' : 'desc')
    }
  }

  function sortIndicator(key: 'modelId' | 'totalSize' | 'lastUsed'): string {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  function ariaSortValue(key: 'modelId' | 'totalSize' | 'lastUsed'): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  const sortedModels = [...models].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'modelId') {
      return dir * a.modelId.localeCompare(b.modelId)
    }
    if (sortKey === 'totalSize') {
      return dir * (a.totalSize - b.totalSize)
    }
    // lastUsed: treat null as -Infinity (sorts to end for desc, beginning for asc)
    const aVal = a.lastUsed ?? -Infinity
    const bVal = b.lastUsed ?? -Infinity
    return dir * (aVal - bVal)
  })

  // Expand/collapse
  function toggleExpand(modelId: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  // Delete a single quantization
  function handleDeleteQuant(modelId: string, quantization: string): void {
    const shortName = modelId.split('/').pop() ?? modelId
    setConfirmState({
      title: `Delete ${quantization.toUpperCase()}`,
      message: `Delete ${quantization} cache for ${shortName}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null)
        setDeleting(`${modelId}::${quantization}`)
        try {
          await deleteCachedModel(modelId, quantization)
          // If this was the last quantization, also remove shared model files
          const model = models.find((m) => m.modelId === modelId)
          if (model && model.quantizations.length <= 1) {
            await deleteCachedModel(modelId)
            useModelUsageStore.getState().removeUsage(modelId)
          } else {
            useModelUsageStore.getState().removeUsage(modelId, quantization)
          }
          await syncCompareCacheStatus()
          setRefreshCounter((c) => c + 1)
        } finally {
          setDeleting(null)
        }
      },
    })
  }

  // Delete all quantizations for a model
  function handleDeleteModel(modelId: string): void {
    const shortName = modelId.split('/').pop() ?? modelId
    const model = models.find((m) => m.modelId === modelId)
    if (!model) return
    setConfirmState({
      title: `Delete ${shortName}`,
      message: `Delete all cached files for ${shortName}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null)
        setDeleting(modelId)
        try {
          for (const q of model.quantizations) {
            await deleteCachedModel(modelId, q.quantization)
          }
          await deleteCachedModel(modelId)
          useModelUsageStore.getState().removeUsage(modelId)
          await syncCompareCacheStatus()
          setRefreshCounter((c) => c + 1)
        } finally {
          setDeleting(null)
        }
      },
    })
  }

  // Delete all cached models
  function handleDeleteAll(): void {
    const totalSize = models.reduce((sum, m) => sum + m.totalSize, 0)
    setConfirmState({
      title: 'Delete All Models',
      message: `Delete all ${models.length} cached model(s) (${formatSize(totalSize)})? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null)
        setDeleting('delete-all')
        try {
          for (const model of models) {
            for (const q of model.quantizations) {
              await deleteCachedModel(model.modelId, q.quantization)
            }
            await deleteCachedModel(model.modelId)
            useModelUsageStore.getState().removeUsage(model.modelId)
          }
          await syncCompareCacheStatus()
          setRefreshCounter((c) => c + 1)
        } finally {
          setDeleting(null)
        }
      },
    })
  }

  // Bulk cleanup of stale models
  function handleCleanup(): void {
    if (staleKeys.length === 0) return

    // Calculate total stale size for the confirmation message
    let totalStaleSize = 0
    for (const key of staleKeys) {
      const model = models.find((m) => m.modelId === key.modelId)
      const quant = model?.quantizations.find((q) => q.quantization === key.quantization)
      if (quant) totalStaleSize += quant.size
    }

    setConfirmState({
      title: 'Clean Up Stale Models',
      message: `Delete ${staleKeys.length} model(s) not used in over 2 weeks? This frees approximately ${formatSize(totalStaleSize)}.`,
      onConfirm: async () => {
        setConfirmState(null)
        setDeleting('cleanup')
        try {
          for (const key of staleKeys) {
            await deleteCachedModel(key.modelId, key.quantization)
            useModelUsageStore.getState().removeUsage(key.modelId, key.quantization)
          }
          await syncCompareCacheStatus()
          setRefreshCounter((c) => c + 1)
        } finally {
          setDeleting(null)
        }
      },
    })
  }

  const thClass = 'cursor-pointer whitespace-nowrap px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-primary'

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      {/* Toolbar: section header + action buttons */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Cached Models
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-error/50 px-4 py-2 text-xs font-semibold text-error hover:bg-error/5 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={models.length === 0 || deleting !== null}
            onClick={() => handleDeleteAll()}
          >
            Delete All
          </button>
          <button
            type="button"
            className="rounded-lg border border-error/50 px-4 py-2 text-xs font-semibold text-error hover:bg-error/5 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={staleKeys.length === 0 || deleting !== null}
            onClick={() => handleCleanup()}
          >
            {staleKeys.length > 0 ? `Clean Up (${staleKeys.length} unused)` : 'Clean Up'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <p className="py-8 text-center text-xs text-text-tertiary">Loading cached models...</p>
      )}

      {/* Error state */}
      {error && (
        <p className="py-8 text-center text-xs text-error">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && models.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm font-semibold text-text-secondary">No cached models</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Download a model below to get started. Cached models run entirely in your browser.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && models.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className={thClass} onClick={() => handleSort('modelId')} aria-sort={ariaSortValue('modelId')}>
                  Model Name{sortIndicator('modelId')}
                </th>
                <th className={thClass} onClick={() => handleSort('totalSize')} aria-sort={ariaSortValue('totalSize')}>
                  Size{sortIndicator('totalSize')}
                </th>
                <th className={thClass} onClick={() => handleSort('lastUsed')} aria-sort={ariaSortValue('lastUsed')}>
                  Last Used{sortIndicator('lastUsed')}
                </th>
                <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedModels.map((model) => {
                const isExpanded = expanded.has(model.modelId)
                return (
                  <Fragment key={model.modelId}>
                    {/* Parent row */}
                    <tr
                      className="border-b border-border-light cursor-pointer hover:bg-bg/30"
                      aria-expanded={isExpanded}
                      onClick={(e) => {
                        // Don't toggle if clicking the delete button
                        if ((e.target as HTMLElement).closest('button')) return
                        toggleExpand(model.modelId)
                      }}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`flex-shrink-0 text-text-tertiary transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          <span
                            className="truncate max-w-[300px] font-semibold text-text-primary"
                            title={model.modelId}
                          >
                            {model.modelId}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-text-secondary">{formatSize(model.totalSize)}</td>
                      <td className="px-2 py-2">
                        <span className={lastUsedColorClass(model.lastUsed)}>
                          {model.lastUsed ? formatRelativeTime(model.lastUsed) : 'Never'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          className="p-2 text-text-tertiary hover:text-error disabled:opacity-40"
                          onClick={() => handleDeleteModel(model.modelId)}
                          disabled={deleting !== null}
                          aria-label={`Delete ${model.modelId}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* Child rows (when expanded) */}
                    {isExpanded && model.quantizations.map((q) => (
                      <tr
                        key={`${model.modelId}-${q.quantization}`}
                        className="border-b border-border-light bg-bg/50"
                      >
                        <td className="px-2 py-2 pl-8">
                          <span className="rounded bg-webgpu-bg px-2 py-1 text-xs font-semibold text-primary">
                            {q.quantization.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-text-secondary">{formatSize(q.size)}</td>
                        <td className="px-2 py-2">
                          <span className={lastUsedColorClass(q.lastUsed)}>
                            {q.lastUsed ? formatRelativeTime(q.lastUsed) : 'Never'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            className="p-2 text-text-tertiary hover:text-error disabled:opacity-40"
                            onClick={() => handleDeleteQuant(model.modelId, q.quantization)}
                            disabled={deleting !== null}
                            aria-label={`Delete ${q.quantization} for ${model.modelId}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        onConfirm={() => { if (confirmState?.onConfirm) void confirmState.onConfirm() }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
})
