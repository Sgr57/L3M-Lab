import { useState, useEffect, useRef } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { searchModels, fetchModelDetails } from '../../lib/hfSearch'
import type { ModelDetails } from '../../lib/hfSearch'
import { isModelCached } from '../../lib/cacheCheck'
import { formatSize } from '../../lib/formatSize'
import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import type {
  Quantization,
  Backend,
  CloudProvider,
  TestConfig,
  HFModelResult,
} from '../../types'

const BACKEND_OPTIONS: Backend[] = ['webgpu', 'wasm']

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
                    <span title="Downloads">{formatCount(model.downloads)}</span>
                    <span title="Likes">{formatCount(model.likes)}</span>
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
            const quants = details?.quants ?? ['q4', 'q8', 'fp16', 'fp32'] as Quantization[]
            return (
              <div
                key={config.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs"
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
                {/* Row 2: Status Info (per D-04) */}
                <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                  <span>{formatSize(config.estimatedSize ?? 0)}</span>
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${config.cached ? 'bg-success' : 'bg-border'}`}
                    title={config.cached ? 'Cached' : 'Not cached'}
                  />
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    config.backend === 'webgpu'
                      ? 'bg-webgpu-bg text-primary'
                      : 'bg-wasm-bg text-wasm'
                  }`}>
                    {config.backend}
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
          {cloudConfigs.map((config) => (
            <div
              key={config.id}
              className="flex items-center gap-2 rounded-lg border border-dashed border-cloud bg-surface px-3.5 py-2 text-xs"
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
          ))}
        </div>
      )}

      {/* Cloud Models Accordion (per D-07) -- closed by default */}
      {(['openai', 'anthropic', 'google'] as CloudProvider[]).some((p) => apiKeys[p]) && (
        <div className="rounded-lg border border-border">
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
              {(['openai', 'anthropic', 'google'] as CloudProvider[]).filter((p) => apiKeys[p]).map((provider) => {
                const providerModels = CLOUD_MODELS.filter((cm) => cm.provider === provider)
                const customInput = customModelInputs[provider]
                return (
                  <div key={provider} className="mb-3 last:mb-0">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      {provider}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {providerModels.map((cm) => {
                        const alreadyAdded = configs.some(
                          (c) => c.provider === cm.provider && c.cloudModel === cm.cloudModel
                        )
                        return (
                          <button
                            key={cm.cloudModel}
                            type="button"
                            className={`rounded-lg border border-dashed border-border px-2.5 py-1 text-[11px] transition-colors ${
                              alreadyAdded
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-bg cursor-pointer'
                            }`}
                            onClick={() =>
                              !alreadyAdded &&
                              handleAddCloudModel(cm.provider, cm.displayName, cm.cloudModel)
                            }
                            disabled={disabled || alreadyAdded}
                          >
                            <span className="font-medium text-text-primary">{cm.displayName}</span>
                            {alreadyAdded ? (
                              <span className="ml-1 text-text-tertiary">added</span>
                            ) : (
                              <span className="ml-1 text-primary">+</span>
                            )}
                          </button>
                        )
                      })}
                      {/* [+] Custom model ID button (per D-09) */}
                      {!customInput.open && (
                        <button
                          type="button"
                          className="rounded-lg border border-dashed border-border px-2.5 py-1 text-[11px] text-text-tertiary hover:bg-bg"
                          onClick={() => setCustomModelInputs((prev) => ({
                            ...prev,
                            [provider]: { ...prev[provider], open: true },
                          }))}
                          disabled={disabled}
                        >
                          + Custom
                        </button>
                      )}
                    </div>
                    {/* Custom model ID input (per D-09) -- no validation, errors at execution */}
                    {customInput.open && (
                      <div className="mt-1.5 flex gap-1.5">
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
