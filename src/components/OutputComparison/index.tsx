import { useState } from 'react'
import { useCompareStore } from '../../stores/useCompareStore'
import type { Backend } from '../../types'

const BORDER_COLORS: Record<Backend, string> = {
  api: '#8250df',
  webgpu: '#0969da',
  wasm: '#1a7f37',
}

const INITIAL_VISIBLE = 3

export function OutputComparison() {
  const results = useCompareStore((s) => s.results)
  const updateRating = useCompareStore((s) => s.updateRating)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  if (results.length === 0) return null

  const visibleResults = showAll ? results : results.slice(0, INITIAL_VISIBLE)
  const hiddenCount = results.length - INITIAL_VISIBLE

  const toggleExpand = (configId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(configId)) {
        next.delete(configId)
      } else {
        next.add(configId)
      }
      return next
    })
  }

  const copyOutput = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Model Outputs
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
              viewMode === 'list'
                ? 'bg-webgpu-bg text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
              viewMode === 'grid'
                ? 'bg-webgpu-bg text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {visibleResults.map((r, idx) => {
          const isExpanded = expanded.has(r.config.id)
          const type = r.config.backend === 'api' ? 'cloud' : 'local'

          return (
            <div
              key={`${r.config.id}-${idx}`}
              className="rounded-xl border border-border p-3.5 border-l-[3px]"
              style={{ borderLeftColor: BORDER_COLORS[r.config.backend] }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {r.config.displayName}
                  </span>
                  <TypeBadge type={type} backend={r.config.backend} />
                  <span className="text-[11px] text-text-tertiary">
                    {r.config.backend} / {r.config.quantization.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-text-secondary">
                  <span>{r.metrics.tokensPerSecond.toFixed(1)} tok/s</span>
                  <span>{r.metrics.tokenCount} tokens</span>
                  <span>{formatTime(r.metrics.totalTime)}</span>
                </div>
              </div>

              {/* Output text or error */}
              {r.error ? (
                <div className="mt-2.5 rounded-lg border border-error/20 bg-error/5 p-3 text-[13px] text-error">
                  <span className="font-semibold">Error: </span>{r.error}
                </div>
              ) : (
                <div
                  className={`mt-2.5 text-[13px] leading-relaxed text-text-primary ${
                    isExpanded ? '' : 'max-h-20 overflow-hidden'
                  }`}
                >
                  {r.output}
                </div>
              )}

              {/* Footer: expand toggle, rating, copy */}
              <div className="mt-2.5 flex items-center justify-between">
                <button
                  type="button"
                  className="text-[11px] font-medium text-primary hover:underline"
                  onClick={() => toggleExpand(r.config.id)}
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </button>

                <div className="flex items-center gap-3">
                  <StarRating
                    value={r.rating}
                    onChange={(rating) => updateRating(r.config.id, rating)}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:border-primary hover:text-primary"
                    onClick={() => copyOutput(r.output)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary"
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more
        </button>
      )}

      {showAll && hiddenCount > 0 && (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary"
          onClick={() => setShowAll(false)}
        >
          Show less
        </button>
      )}
    </div>
  )
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
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
        <span
          key={star}
          className={`cursor-pointer text-lg leading-none ${
            value !== null && star <= value
              ? 'text-star-filled'
              : 'text-star-empty'
          }`}
          onClick={() => onChange(star)}
        >
          ★
        </span>
      ))}
    </span>
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
