import { useState, useEffect, useRef } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { searchModels, fetchModelDetails } from '../../lib/hfSearch'
import type { ModelDetails } from '../../lib/hfSearch'
import { isModelCached } from '../../lib/cacheCheck'
import { formatSize } from '../../lib/formatSize'
import { enumerateCache, groupByModelAndQuant } from '../../lib/cacheManager'
import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useModelUsageStore } from '../../stores/useModelUsageStore'
import type {
  Quantization,
  Backend,
  CloudProvider,
  TestConfig,
  HFModelResult,
} from '../../types'

const BACKEND_OPTIONS: Backend[] = ['webgpu', 'wasm']

// Sequential color palette for distinguishing A/B configs in chips and reports
const CONFIG_COLORS = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f43f5e', // rose
  '#6366f1', // indigo
]

const CLOUD_MODELS: {
  provider: CloudProvider
  displayName: string
  cloudModel: string
}[] = [
  // OpenAI
  { provider: 'openai', displayName: 'GPT-4o-mini', cloudModel: 'gpt-4o-mini' },
  { provider: 'openai', displayName: 'GPT-4o', cloudModel: 'gpt-4o' },
  // Anthropic
  { provider: 'anthropic', displayName: 'Claude 3.5 Haiku', cloudModel: 'claude-3-5-haiku-latest' },
  { provider: 'anthropic', displayName: 'Claude 3.5 Sonnet', cloudModel: 'claude-3-5-sonnet-latest' },
  // Google
  { provider: 'google', displayName: 'Gemini 2.0 Flash', cloudModel: 'gemini-2.0-flash' },
  { provider: 'google', displayName: 'Gemini 2.0 Flash Lite', cloudModel: 'gemini-2.0-flash-lite' },
]

// Module-level cache: modelId -> ModelDetails (replaces quantCache)
const modelDetailsCache = new Map<string, ModelDetails>()

export function ModelSelector() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HFModelResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // Track model details per config (quantizations + sizes, loaded on-demand)
  const [configDetails, setConfigDetails] = useState<Record<string, { quants: Quantization[]; sizeByQuant: Record<string, number> }>>({})
  const [cloudAccordionOpen, setCloudAccordionOpen] = useState(false)
  const [cachedAccordionOpen, setCachedAccordionOpen] = useState(false)
  const [cachedRows, setCachedRows] = useState<{ modelId: string; quantization: string; size: number; lastUsed: number | null }[]>([])
  const [cachedLoading, setCachedLoading] = useState(false)
  const [customModelInputs, setCustomModelInputs] = useState<Record<CloudProvider, { open: boolean; value: string }>>({
    openai: { open: false, value: '' },
    anthropic: { open: false, value: '' },
    google: { open: false, value: '' },
  })
  const debouncedQuery = useDebouncedValue(query, 300)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const configs = useCompareStore((s) => s.configs)
  const addConfig = useCompareStore((s) => s.addConfig)
  const removeConfig = useCompareStore((s) => s.removeConfig)
  const updateConfig = useCompareStore((s) => s.updateConfig)
  const executionStatus = useCompareStore((s) => s.executionStatus)

  const apiKeys = useSettingsStore((s) => s.apiKeys)
  const webgpuSupported = useSettingsStore((s) => s.webgpuSupported)

  const disabled = executionStatus === 'running' || executionStatus === 'downloading'

  // Search HuggingFace when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    let cancelled = false
    setLoading(true)

    searchModels(debouncedQuery).then((models) => {
      if (!cancelled) {
        setResults(models)
        setIsOpen(models.length > 0)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load cached models when accordion opens, and reload when executionStatus transitions to idle
  useEffect(() => {
    // Only load when accordion is open, and not during active download
    if (!cachedAccordionOpen || executionStatus === 'downloading') return

    let cancelled = false
    setCachedLoading(true)

    enumerateCache().then((entries) => {
      if (cancelled) return
      const grouped = groupByModelAndQuant(entries, useModelUsageStore.getState())
      // Flatten: one row per model+quantization
      const rows = grouped.flatMap((m) =>
        m.quantizations.map((q) => ({
          modelId: m.modelId,
          quantization: q.quantization,
          size: q.size,
          lastUsed: q.lastUsed,
        }))
      )
      setCachedRows(rows)
      setCachedLoading(false)
    })

    return () => { cancelled = true }
  }, [cachedAccordionOpen, executionStatus])

  async function handleAddCachedModel(row: { modelId: string; quantization: string; size: number }): Promise<void> {
    const backend: Backend = webgpuSupported ? 'webgpu' : 'wasm'

    const config: TestConfig = {
      id: `${row.modelId}-${row.quantization}-${backend}-${crypto.randomUUID()}`,
      modelId: row.modelId,
      displayName: row.modelId.split('/').pop() ?? row.modelId,
      quantization: row.quantization as Quantization,
      backend,
      estimatedSize: row.size,
      cached: true,
    }
    addConfig(config)

    // Fetch ALL HF quants (same as HF search flow), with cache-only fallback
    let details = modelDetailsCache.get(row.modelId)
    if (!details) {
      try {
        details = await fetchModelDetails(row.modelId)
        modelDetailsCache.set(row.modelId, details)
      } catch {
        // Offline fallback: use only cached quants
        const modelRows = cachedRows.filter((r) => r.modelId === row.modelId)
        const quants = modelRows.map((r) => r.quantization as Quantization)
        const sizeByQuant: Record<string, number> = {}
        for (const r of modelRows) sizeByQuant[r.quantization] = r.size
        details = { quantizations: quants, sizeByQuant }
      }
    }

    setConfigDetails((prev) => ({
      ...prev,
      [config.id]: { quants: details!.quantizations, sizeByQuant: details!.sizeByQuant },
    }))
  }

  async function handleSelectModel(model: HFModelResult) {
    const defaultBackend: Backend = webgpuSupported ? 'webgpu' : 'wasm'

    // Fetch model details (from cache or API)
    let details = modelDetailsCache.get(model.modelId)
    if (!details) {
      details = await fetchModelDetails(model.modelId)
      modelDetailsCache.set(model.modelId, details)
    }

    const defaultQuant = details.quantizations.includes('q4') ? 'q4' : details.quantizations[0]
    const estimatedSize = details.sizeByQuant[defaultQuant] ?? 0

    // Check cache status
    const cached = await isModelCached(model.modelId, defaultQuant)

    const config: TestConfig = {
      id: `${model.modelId}-${defaultQuant}-${defaultBackend}-${crypto.randomUUID()}`,
      modelId: model.modelId,
      displayName: model.name,
      quantization: defaultQuant,
      backend: defaultBackend,
      estimatedSize,
      cached,
    }
    addConfig(config)

    // Store details for this config's selectors
    setConfigDetails((prev) => ({
      ...prev,
      [config.id]: { quants: details!.quantizations, sizeByQuant: details!.sizeByQuant },
    }))

    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  function handleAddCloudModel(provider: CloudProvider, displayName: string, cloudModel: string) {
    const config: TestConfig = {
      id: `cloud-${provider}-${cloudModel}-${crypto.randomUUID()}`,
      modelId: cloudModel,
      displayName,
      quantization: 'fp16',
      backend: 'api',
      provider,
      cloudModel,
    }
    addConfig(config)
  }

  function handleAddCustomCloudModel(provider: CloudProvider) {
    const input = customModelInputs[provider]
    if (!input.value.trim()) return
    handleAddCloudModel(provider, input.value.trim(), input.value.trim())
    setCustomModelInputs((prev) => ({
      ...prev,
      [provider]: { open: false, value: '' },
    }))
  }

  async function handleQuantChange(configId: string, quantization: Quantization) {
    const existing = configs.find((c) => c.id === configId)
    if (!existing) return

    const details = configDetails[configId]
    const estimatedSize = details?.sizeByQuant[quantization] ?? 0

    // Re-check cache for new quantization (per D-13)
    const cached = await isModelCached(existing.modelId, quantization)

    updateConfig(configId, { quantization, estimatedSize, cached })
  }

  function handleBackendChange(configId: string, backend: Backend) {
    updateConfig(configId, { backend })
  }

  function handleRemoveConfig(configId: string) {
    removeConfig(configId)
    setConfigDetails((prev) => {
      const next = { ...prev }
      delete next[configId]
      return next
    })
  }

  const localConfigs = configs.filter((c) => c.backend !== 'api')
  const cloudConfigs = configs.filter((c) => c.backend === 'api')

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Models
      </div>

      {/* Cached Models Accordion -- before HF search */}
      <div className="mb-4 rounded-lg border border-border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-secondary"
          onClick={() => setCachedAccordionOpen(!cachedAccordionOpen)}
          disabled={disabled}
        >
          <span>Cached Models</span>
          <svg
            xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${cachedAccordionOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {cachedAccordionOpen && (
          <div className="border-t border-border px-4 pb-3 pt-2">
            {cachedLoading ? (
              <div className="text-xs text-text-tertiary">Loading cached models...</div>
            ) : cachedRows.length === 0 ? (
              <div className="text-xs text-text-tertiary">No models cached yet. Download models to see them here.</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary">
                    <th className="pb-1.5 font-semibold">Model</th>
                    <th className="pb-1.5 font-semibold">Quant</th>
                    <th className="pb-1.5 font-semibold text-right">Size</th>
                    <th className="pb-1.5 font-semibold text-right">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {cachedRows.map((row) => (
                    <tr
                      key={`${row.modelId}-${row.quantization}`}
                      className="border-t border-border/50 hover:bg-bg cursor-pointer"
                      onClick={() => !disabled && handleAddCachedModel(row)}
                    >
                      <td className="py-1.5 pr-2 truncate max-w-[200px]" title={row.modelId}>
                        {row.modelId.split('/').pop() ?? row.modelId}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="rounded bg-webgpu-bg px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {row.quantization}
                        </span>
                      </td>
                      <td className="py-1.5 text-right text-text-tertiary">{formatSize(row.size)}</td>
                      <td className="py-1.5 text-right text-text-tertiary">
                        {row.lastUsed ? formatRelativeTime(row.lastUsed) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Cloud Models Accordion -- table rows style, after cached accordion */}
      {(['openai', 'anthropic', 'google'] as CloudProvider[]).some((p) => apiKeys[p]) && (
        <div className="mb-4 rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-secondary"
            onClick={() => setCloudAccordionOpen(!cloudAccordionOpen)}
            disabled={disabled}
          >
            <span>Cloud Models</span>
            <svg
              xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${cloudAccordionOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {cloudAccordionOpen && (
            <div className="border-t border-border px-4 pb-3 pt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary">
                    <th className="pb-1.5 font-semibold">Provider</th>
                    <th className="pb-1.5 font-semibold">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {(['openai', 'anthropic', 'google'] as CloudProvider[])
                    .filter((p) => apiKeys[p])
                    .flatMap((provider) =>
                      CLOUD_MODELS
                        .filter((cm) => cm.provider === provider)
                        .map((cm) => {
                          const alreadyAdded = configs.some(
                            (c) => c.provider === cm.provider && c.cloudModel === cm.cloudModel
                          )
                          return (
                            <tr
                              key={cm.cloudModel}
                              className={`border-t border-border/50 ${
                                alreadyAdded
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'hover:bg-bg cursor-pointer'
                              }`}
                              onClick={() =>
                                !alreadyAdded && !disabled &&
                                handleAddCloudModel(cm.provider, cm.displayName, cm.cloudModel)
                              }
                            >
                              <td className="py-1.5 pr-2">
                                <span className="rounded bg-cloud-bg px-1.5 py-0.5 text-[10px] font-semibold text-cloud">
                                  {cm.provider}
                                </span>
                              </td>
                              <td className="py-1.5 font-medium text-text-primary">
                                {cm.displayName}
                              </td>
                            </tr>
                          )
                        })
                    )}
                </tbody>
              </table>
              {/* Custom model inputs -- per provider, below the table */}
              {(['openai', 'anthropic', 'google'] as CloudProvider[])
                .filter((p) => apiKeys[p])
                .map((provider) => {
                  const customInput = customModelInputs[provider]
                  return (
                    <div key={provider} className="mt-2 first:mt-3">
                      {!customInput.open ? (
                        <button
                          type="button"
                          className="text-[11px] text-text-tertiary hover:text-text-secondary"
                          onClick={() => setCustomModelInputs((prev) => ({
                            ...prev,
                            [provider]: { ...prev[provider], open: true },
                          }))}
                          disabled={disabled}
                        >
                          + Custom {provider} model
                        </button>
                      ) : (
                        <div className="flex gap-1.5">
                          <span className="flex items-center rounded bg-cloud-bg px-1.5 py-0.5 text-[10px] font-semibold text-cloud">
                            {provider}
                          </span>
                          <input
                            type="text"
                            className="flex-1 rounded border border-border bg-bg px-2 py-1 text-[11px] text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none"
                            placeholder="model-id (e.g. gpt-4-turbo)"
                            value={customInput.value}
                            onChange={(e) => setCustomModelInputs((prev) => ({
                              ...prev,
                              [provider]: { ...prev[provider], value: e.target.value },
                            }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddCustomCloudModel(provider)
                              if (e.key === 'Escape') setCustomModelInputs((prev) => ({
                                ...prev,
                                [provider]: { open: false, value: '' },
                              }))
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="rounded border border-border bg-bg px-2 py-1 text-[11px] text-primary hover:bg-surface"
                            onClick={() => handleAddCustomCloudModel(provider)}
                            disabled={!customInput.value.trim()}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Search input with autocomplete */}
      <div ref={wrapperRef} className="relative mb-4">
        <input
          type="text"
          className="w-full rounded-lg border border-border bg-bg p-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none"
          placeholder="Search HuggingFace ONNX models..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          disabled={disabled}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            Searching...
          </div>
        )}

        {isOpen && results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
            {results.map((model) => (
              <li key={model.modelId}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg"
                  onClick={() => handleSelectModel(model)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-text-primary">
                      {model.modelId}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <span>{model.pipelineTag}</span>
                      <span className="rounded bg-webgpu-bg px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        ONNX
                      </span>
                      {model.libraryName === 'transformers.js' && (
                        <span className="rounded bg-wasm-bg px-1.5 py-0.5 text-[10px] font-semibold text-wasm">
                          transformers.js
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 gap-3 text-[11px] text-text-tertiary">
                    <span className="flex items-center gap-0.5" title="Downloads">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {formatCount(model.downloads)}
                    </span>
                    <span className="flex items-center gap-0.5" title="Likes">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {formatCount(model.likes)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Local model chips (two-row layout per D-04) */}
      {localConfigs.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {localConfigs.map((config) => {
            const details = configDetails[config.id]
            const quants = details?.quants ?? [config.quantization]
            const colorIndex = configs.indexOf(config)
            const color = CONFIG_COLORS[colorIndex % CONFIG_COLORS.length]
            return (
              <div
                key={config.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs"
                style={{ borderLeftWidth: '3px', borderLeftColor: color }}
              >
                {/* Row 1: Name + Controls (per D-04) */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary truncate max-w-[180px]" title={config.modelId}>
                    {config.displayName}
                  </span>
                  <select
                    className="rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-text-primary focus:outline-none"
                    value={config.quantization}
                    onChange={(e) => handleQuantChange(config.id, e.target.value as Quantization)}
                    disabled={disabled}
                  >
                    {quants.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <select
                    className="rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-text-primary focus:outline-none"
                    value={config.backend}
                    onChange={(e) => handleBackendChange(config.id, e.target.value as Backend)}
                    disabled={disabled}
                  >
                    {BACKEND_OPTIONS.filter((b) => b !== 'webgpu' || webgpuSupported).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {/* Trash icon per D-04 - replaces text "x" */}
                  <button
                    type="button"
                    className="ml-1 text-text-tertiary hover:text-error"
                    onClick={() => handleRemoveConfig(config.id)}
                    disabled={disabled}
                    aria-label={`Remove ${config.displayName}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
                {/* Row 2: Status Info */}
                <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                  <span>{formatSize(config.estimatedSize ?? 0)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    config.cached
                      ? 'bg-wasm-bg text-wasm'
                      : 'bg-bg text-text-tertiary'
                  }`}>
                    {config.cached ? 'Cached' : 'Not cached'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cloud model chips -- outside accordion for visibility (per D-10) */}
      {cloudConfigs.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {cloudConfigs.map((config) => {
            const colorIndex = configs.indexOf(config)
            const color = CONFIG_COLORS[colorIndex % CONFIG_COLORS.length]
            return (
            <div
              key={config.id}
              className="flex items-center gap-2 rounded-lg border border-dashed border-cloud bg-surface px-3.5 py-2 text-xs"
              style={{ borderLeftWidth: '3px', borderLeftColor: color, borderLeftStyle: 'solid' }}
            >
              <span className="font-medium text-text-primary">{config.displayName}</span>
              <span className="rounded bg-cloud-bg px-1.5 py-0.5 text-[10px] font-semibold text-cloud">
                {config.provider}
              </span>
              <button
                type="button"
                className="ml-1 text-text-tertiary hover:text-error"
                onClick={() => handleRemoveConfig(config.id)}
                disabled={disabled}
                aria-label={`Remove ${config.displayName}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
            )
          })}
        </div>
      )}

      {configs.length === 0 && (
        <p className="text-xs text-text-tertiary">
          Search for a model above or add a cloud model to get started.
        </p>
      )}
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
