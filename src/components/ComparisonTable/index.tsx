import { useState, useMemo } from 'react'
import { useCompareStore } from '../../stores/useCompareStore'
import { getModelColor } from '../../lib/modelColors'
import { getDisambiguatedLabels } from '../../lib/disambiguate'
import { TypeBadge } from '../shared/TypeBadge'
import { BackendBadge } from '../shared/BackendBadge'
import { StarRating } from '../shared/StarRating'
import type { TestResult, Backend } from '../../types'

type SortKey =
  | 'displayName'
  | 'backend'
  | 'quantization'
  | 'modelSize'
  | 'loadTime'
  | 'ttft'
  | 'tokensPerSecond'
  | 'totalTime'
  | 'tokenCount'
  | 'rating'

type SortDir = 'asc' | 'desc'

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  cors: 'CORS Blocked',
  auth: 'Auth Failed',
  'rate-limit': 'Rate Limited',
  timeout: 'Timeout',
  server: 'Server Error',
  'session-init': 'Session Failed',
  'model-compat': 'Not Compatible',
  unknown: 'Unknown Error',
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatMs(ms: number | null): string {
  if (ms === null) return '--'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function getSortValue(r: TestResult, key: SortKey): number | string {
  switch (key) {
    case 'displayName':
      return r.config.displayName.toLowerCase()
    case 'backend':
      return r.config.backend
    case 'quantization':
      return r.config.quantization
    case 'modelSize':
      return r.metrics.modelSize ?? 0
    case 'loadTime':
      return r.metrics.loadTime ?? 0
    case 'ttft':
      return r.metrics.ttft
    case 'tokensPerSecond':
      return r.metrics.tokensPerSecond
    case 'totalTime':
      return r.metrics.totalTime
    case 'tokenCount':
      return r.metrics.tokenCount
    case 'rating':
      return r.rating ?? 0
  }
}

function getType(backend: Backend): string {
  return backend === 'api' ? 'cloud' : 'local'
}

export function ComparisonTable(): React.JSX.Element | null {
  const results = useCompareStore((s) => s.results)
  const configs = useCompareStore((s) => s.configs)
  const updateRating = useCompareStore((s) => s.updateRating)
  const [sortKey, setSortKey] = useState<SortKey>('tokensPerSecond')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const labels = useMemo(() => getDisambiguatedLabels(configs), [configs])

  const handleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'displayName' || key === 'backend' || key === 'quantization' ? 'asc' : 'desc')
    }
  }

  const bestWorst = useMemo(() => {
    const successful = results.filter((r) => !r.error)
    if (successful.length < 2) return { bestTokS: -1, worstTokS: -1, bestTotal: -1, worstTotal: -1 }
    const speeds = successful.map((r) => r.metrics.tokensPerSecond)
    const totals = successful.map((r) => r.metrics.totalTime)
    return {
      bestTokS: Math.max(...speeds),
      worstTokS: Math.min(...speeds),
      bestTotal: Math.min(...totals),
      worstTotal: Math.max(...totals),
    }
  }, [results])

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const aVal = getSortValue(a, sortKey)
      const bVal = getSortValue(b, sortKey)
      const cmp = typeof aVal === 'string' && typeof bVal === 'string'
        ? aVal.localeCompare(bVal)
        : (aVal as number) - (bVal as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [results, sortKey, sortDir])

  if (results.length === 0) return null

  const arrow = (key: SortKey): string =>
    sortKey === key ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ''

  const columns: { label: string; key: SortKey }[] = [
    { label: 'Model', key: 'displayName' },
    { label: 'Type', key: 'backend' },
    { label: 'Quant', key: 'quantization' },
    { label: 'Backend', key: 'backend' },
    { label: 'Size', key: 'modelSize' },
    { label: 'Load', key: 'loadTime' },
    { label: 'TTFT', key: 'ttft' },
    { label: 'Tok/s', key: 'tokensPerSecond' },
    { label: 'Total', key: 'totalTime' },
    { label: 'Tokens', key: 'tokenCount' },
    { label: 'Rating', key: 'rating' },
  ]

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Detailed Comparison
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.label}
                  className="cursor-pointer whitespace-nowrap px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-primary"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}{arrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const isError = !!r.error
              const rowClasses = `border-b border-border-light border-l-[3px] ${isError ? 'bg-error/5' : ''}`

              const tokClass =
                !r.error && r.metrics.tokensPerSecond === bestWorst.bestTokS
                  ? 'text-success font-semibold'
                  : !r.error && r.metrics.tokensPerSecond === bestWorst.worstTokS
                    ? 'text-error'
                    : ''

              const totalClass =
                !r.error && r.metrics.totalTime === bestWorst.bestTotal
                  ? 'text-success font-semibold'
                  : !r.error && r.metrics.totalTime === bestWorst.worstTotal
                    ? 'text-error'
                    : ''

              const type = getType(r.config.backend)

              return (
                <tr
                  key={`${r.config.id}-${idx}`}
                  className={rowClasses}
                  style={{ borderLeftColor: isError ? '#cf222e' : getModelColor(configs, r.config.id) }}
                >
                  <td className="px-2 py-2 font-medium text-text-primary">
                    {labels.get(r.config.id) ?? r.config.displayName}
                    {isError && r.errorCategory && (
                      <div className="text-xs font-normal text-error">
                        {ERROR_CATEGORY_LABELS[r.errorCategory] ?? 'Error'}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <TypeBadge type={type} backend={r.config.backend} />
                  </td>
                  <td className="px-2 py-2 text-text-secondary">
                    {r.config.backend === 'api' ? '--' : r.config.quantization.toUpperCase()}
                  </td>
                  <td className="px-2 py-2">
                    <BackendBadge backend={r.config.backend} />
                  </td>
                  <td className="px-2 py-2 text-text-secondary">
                    {r.error ? <span className="text-error">Error</span> : formatBytes(r.metrics.modelSize)}
                  </td>
                  <td className="px-2 py-2 text-text-secondary">
                    {r.error ? <span className="text-error">Error</span> : formatMs(r.metrics.loadTime)}
                  </td>
                  <td className="px-2 py-2 text-text-secondary">
                    {r.error ? <span className="text-error">Error</span> : formatMs(r.metrics.ttft)}
                  </td>
                  <td className={`px-2 py-2 ${tokClass}`}>
                    {r.error ? <span className="text-error">Error</span> : <span className={tokClass}>{r.metrics.tokensPerSecond.toFixed(1)}</span>}
                  </td>
                  <td className={`px-2 py-2 ${totalClass}`}>
                    {r.error ? <span className="text-error">Error</span> : <span className={totalClass}>{formatMs(r.metrics.totalTime)}</span>}
                  </td>
                  <td className="px-2 py-2 text-text-secondary">
                    {r.error ? <span className="text-error">Error</span> : r.metrics.tokenCount}
                  </td>
                  <td className="px-2 py-2">
                    <StarRating
                      value={r.rating}
                      onChange={(rating) => updateRating(r.config.id, rating)}
                      size="sm"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
