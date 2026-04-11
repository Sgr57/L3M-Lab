import { useState, useMemo } from 'react'
import { useCompareStore } from '../../stores/useCompareStore'
import { getModelColor } from '../../lib/modelColors'
import { getDisambiguatedLabels } from '../../lib/disambiguate'
import { TypeBadge } from '../shared/TypeBadge'
import { StarRating } from '../shared/StarRating'

const INITIAL_VISIBLE = 3

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  cors: 'CORS Blocked',
  auth: 'Auth Failed',
  'rate-limit': 'Rate Limited',
  timeout: 'Timeout',
  server: 'Server Error',
  unknown: 'Unknown Error',
}

export function OutputComparison(): React.JSX.Element | null {
  const results = useCompareStore((s) => s.results)
  const configs = useCompareStore((s) => s.configs)
  const updateRating = useCompareStore((s) => s.updateRating)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const [rawErrorExpanded, setRawErrorExpanded] = useState<Set<string>>(new Set())

  const labels = useMemo(() => getDisambiguatedLabels(configs), [configs])

  if (results.length === 0) return null

  const visibleResults = showAll ? results : results.slice(0, INITIAL_VISIBLE)
  const hiddenCount = results.length - INITIAL_VISIBLE

  const toggleExpand = (configId: string): void => {
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

  const toggleRawError = (configId: string): void => {
    setRawErrorExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(configId)) {
        next.delete(configId)
      } else {
        next.add(configId)
      }
      return next
    })
  }

  const copyOutput = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Model Outputs
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {visibleResults.map((r, idx) => {
          const isExpanded = expanded.has(r.config.id)
          const type = r.config.backend === 'api' ? 'cloud' : 'local'

          return (
            <div
              key={`${r.config.id}-${idx}`}
              className={`rounded-xl border p-3.5 border-l-[3px] ${
                r.error ? 'border-error/30 bg-error/5' : 'border-border'
              }`}
              style={{ borderLeftColor: r.error ? '#cf222e' : getModelColor(configs, r.config.id) }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {labels.get(r.config.id) ?? r.config.displayName}
                  </span>
                  <TypeBadge type={type} backend={r.config.backend} />
                  <span className="text-xs text-text-tertiary">
                    {r.config.backend} / {r.config.quantization.toUpperCase()}
                  </span>
                  {r.fallbackBackend && (
                    <span className="text-xs text-warning font-semibold">
                      WebGPU &rarr; WASM
                    </span>
                  )}
                </div>
                {!r.error && (
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    <span>{r.metrics.tokensPerSecond.toFixed(1)} tok/s</span>
                    <span>{r.metrics.tokenCount} tokens</span>
                    <span>{formatTime(r.metrics.totalTime)}</span>
                  </div>
                )}
              </div>

              {/* Output text or error */}
              {r.error ? (
                <div className="mt-2.5 space-y-2">
                  {/* Error category badge + hint */}
                  <div className="rounded-lg border border-error/20 bg-error/5 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {r.errorCategory ? (
                        <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold bg-error/10 text-error">
                          {ERROR_CATEGORY_LABELS[r.errorCategory] ?? 'Error'}
                        </span>
                      ) : (
                        <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold bg-error/10 text-error">
                          Error
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">{r.errorHint ?? r.error}</p>
                  </div>
                  {/* Collapsible raw error */}
                  {r.rawError && (
                    <div>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => toggleRawError(r.config.id)}
                      >
                        {rawErrorExpanded.has(r.config.id) ? 'Hide raw error' : 'Show raw error'}
                      </button>
                      {rawErrorExpanded.has(r.config.id) && (
                        <div className="mt-1.5 rounded-lg bg-bg border border-border p-3 text-sm font-mono text-text-secondary break-words">
                          {r.rawError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`mt-2.5 text-sm leading-relaxed text-text-primary ${
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
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => toggleExpand(r.config.id)}
                >
                  {isExpanded ? 'Collapse' : 'Expand'}
                </button>

                <div className="flex items-center gap-3">
                  <StarRating
                    value={r.rating}
                    onChange={(rating) => updateRating(r.config.id, rating)}
                    size="lg"
                  />
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-secondary hover:border-primary hover:text-primary"
                    onClick={() => copyOutput(r.output)}
                  >
                    Copy Output
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
          className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more
        </button>
      )}

      {showAll && hiddenCount > 0 && (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary"
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
