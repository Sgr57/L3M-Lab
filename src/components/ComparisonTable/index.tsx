import { useState, useMemo } from 'react'
import { useCompareStore } from '../../stores/useCompareStore'
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

function StarRating({
  value,
  onChange,
}: {
  value: number | null
  onChange: (rating: number) => void
}) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`cursor-pointer text-sm leading-none ${
            value !== null && star <= value
              ? 'text-star-filled'
              : 'text-star-empty'
          }`}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </span>
  )
}

export function ComparisonTable() {
  const results = useCompareStore((s) => s.results)
  const updateRating = useCompareStore((s) => s.updateRating)
  const [sortKey, setSortKey] = useState<SortKey>('tokensPerSecond')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'displayName' || key === 'backend' || key === 'quantization' ? 'asc' : 'desc')
    }
  }

  const bestWorst = useMemo(() => {
    if (results.length < 2) return { bestTokS: -1, worstTokS: -1, bestTotal: -1, worstTotal: -1 }
    const speeds = results.map((r) => r.metrics.tokensPerSecond)
    const totals = results.map((r) => r.metrics.totalTime)
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

  const arrow = (key: SortKey) =>
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
    <div className="rounded-xl border border-border bg-surface p-5">
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
                  className="cursor-pointer whitespace-nowrap px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary hover:text-primary"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}{arrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const rowBg =
                r.config.backend === 'api'
                  ? 'bg-cloud-light'
                  : r.config.backend === 'wasm'
                    ? 'bg-wasm-light'
                    : ''

              const tokClass =
                r.metrics.tokensPerSecond === bestWorst.bestTokS
                  ? 'text-success font-bold'
                  : r.metrics.tokensPerSecond === bestWorst.worstTokS
                    ? 'text-error'
                    : ''

              const totalClass =
                r.metrics.totalTime === bestWorst.bestTotal
                  ? 'text-success font-bold'
                  : r.metrics.totalTime === bestWorst.worstTotal
                    ? 'text-error'
                    : ''

              const type = getType(r.config.backend)

              return (
                <tr
                  key={`${r.config.id}-${idx}`}
                  className={`border-b border-border-light ${rowBg}`}
                >
                  <td className="px-2.5 py-2 font-medium text-text-primary">
                    {r.config.displayName}
                  </td>
                  <td className="px-2.5 py-2">
                    <TypeBadge type={type} backend={r.config.backend} />
                  </td>
                  <td className="px-2.5 py-2 text-text-secondary">
                    {r.config.quantization.toUpperCase()}
                  </td>
                  <td className="px-2.5 py-2">
                    <BackendBadge backend={r.config.backend} />
                  </td>
                  <td className="px-2.5 py-2 text-text-secondary">
                    {formatBytes(r.metrics.modelSize)}
                  </td>
                  <td className="px-2.5 py-2 text-text-secondary">
                    {formatMs(r.metrics.loadTime)}
                  </td>
                  <td className="px-2.5 py-2 text-text-secondary">
                    {formatMs(r.metrics.ttft)}
                  </td>
                  <td className={`px-2.5 py-2 ${tokClass}`}>
                    {r.metrics.tokensPerSecond.toFixed(1)}
                  </td>
                  <td className={`px-2.5 py-2 ${totalClass}`}>
                    {formatMs(r.metrics.totalTime)}
                  </td>
                  <td className="px-2.5 py-2 text-text-secondary">
                    {r.metrics.tokenCount}
                  </td>
                  <td className="px-2.5 py-2">
                    <StarRating
                      value={r.rating}
                      onChange={(rating) => updateRating(r.config.id, rating)}
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

function TypeBadge({ type, backend }: { type: string; backend: Backend }) {
  const cls =
    type === 'cloud'
      ? 'bg-cloud-bg text-cloud'
      : backend === 'wasm'
        ? 'bg-wasm-bg text-wasm'
        : 'bg-webgpu-bg text-primary'

  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {type === 'cloud' ? 'cloud' : backend === 'wasm' ? 'local-wasm' : 'local'}
    </span>
  )
}

function BackendBadge({ backend }: { backend: Backend }) {
  const cls =
    backend === 'api'
      ? 'bg-cloud-bg text-cloud'
      : backend === 'wasm'
        ? 'bg-wasm-bg text-wasm'
        : 'bg-webgpu-bg text-primary'

  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {backend}
    </span>
  )
}
