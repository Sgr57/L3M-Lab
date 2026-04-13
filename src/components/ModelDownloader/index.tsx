import { useState, useEffect, useRef } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { searchModels, fetchModelDetails } from '../../lib/hfSearch'
import type { ModelDetails } from '../../lib/hfSearch'
import { formatSize } from '../../lib/formatSize'
import { startDownload } from '../../lib/workerBridge'
import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import type { Quantization, TestConfig, HFModelResult } from '../../types'

// Module-level cache for model details to avoid redundant API calls
const modelDetailsCache = new Map<string, ModelDetails>()

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function ModelDownloader({ onDownloadComplete }: { onDownloadComplete?: () => void }): React.ReactElement {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HFModelResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<HFModelResult | null>(null)
  const [modelDetails, setModelDetails] = useState<ModelDetails | null>(null)
  const [selectedQuant, setSelectedQuant] = useState<Quantization | null>(null)

  const debouncedQuery = useDebouncedValue(query, 300)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const executionStatus = useCompareStore((s) => s.executionStatus)
  const downloadProgress = useCompareStore((s) => s.downloadProgress)
  const isDownloading = executionStatus === 'downloading'

  const webgpuSupported = useSettingsStore((s) => s.webgpuSupported)

  // Track previous execution status for download completion detection
  const prevStatusRef = useRef(executionStatus)

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
    function handleClickOutside(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Detect download completion and trigger refresh
  useEffect(() => {
    if (prevStatusRef.current === 'downloading' && executionStatus === 'idle') {
      onDownloadComplete?.()
      setSelectedModel(null)
      setModelDetails(null)
      setSelectedQuant(null)
    }
    prevStatusRef.current = executionStatus
  }, [executionStatus, onDownloadComplete])

  async function handleSelectModel(model: HFModelResult): Promise<void> {
    setSelectedModel(model)
    setIsOpen(false)
    setQuery('')
    setResults([])

    // Fetch model details (from cache or API)
    let details = modelDetailsCache.get(model.modelId)
    if (!details) {
      details = await fetchModelDetails(model.modelId)
      modelDetailsCache.set(model.modelId, details)
    }

    setModelDetails(details)
    // Default to q4 if available, else first quantization
    const defaultQuant = details.quantizations.includes('q4') ? 'q4' : details.quantizations[0]
    setSelectedQuant(defaultQuant)
  }

  function handleDownload(): void {
    if (!selectedModel || !selectedQuant || !modelDetails) return

    const config: TestConfig = {
      id: `download-${selectedModel.modelId}-${selectedQuant}-${crypto.randomUUID()}`,
      modelId: selectedModel.modelId,
      displayName: selectedModel.name,
      quantization: selectedQuant,
      backend: webgpuSupported ? 'webgpu' : 'wasm',
      estimatedSize: modelDetails.sizeByQuant[selectedQuant] ?? 0,
      cached: false,
    }

    startDownload([config])
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Download Models
      </div>

      {/* Search input with autocomplete */}
      <div ref={wrapperRef} className="relative">
        <input
          type="text"
          className="w-full rounded-lg border border-border bg-bg p-3 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none"
          placeholder="Search HuggingFace ONNX models..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          disabled={isDownloading}
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

      {/* Selected model card with quantization pills and download button */}
      {selectedModel && modelDetails && (
        <div className="mt-4">
          <div className="mb-3 text-sm font-semibold text-text-primary">
            {selectedModel.modelId}
          </div>

          {/* Quantization pills */}
          <div className="mb-3 flex flex-wrap gap-2">
            {modelDetails.quantizations.map((q) => (
              <button
                key={q}
                type="button"
                className={`rounded-lg border px-2 py-1 text-xs ${
                  selectedQuant === q
                    ? 'border-primary bg-webgpu-bg font-semibold text-primary'
                    : 'border-border'
                }`}
                onClick={() => setSelectedQuant(q)}
                disabled={isDownloading}
              >
                {q.toUpperCase()}
                {modelDetails.sizeByQuant[q] ? (
                  <span className="ml-1 text-text-secondary">{formatSize(modelDetails.sizeByQuant[q])}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Download button */}
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleDownload}
            disabled={isDownloading || !selectedQuant}
          >
            {isDownloading ? 'Downloading...' : 'Download Model'}
          </button>

          {/* Download progress */}
          {isDownloading && downloadProgress && (
            <div className="mt-3">
              {downloadProgress.models.map((model) => (
                <div key={model.configId} className="flex items-center gap-3 text-xs">
                  <span className="w-48 truncate text-text-primary">{model.modelName}</span>
                  <div className="flex-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-light">
                      <div
                        className={`h-full ${model.status === 'complete' ? 'bg-success' : 'bg-primary'}`}
                        style={{ width: `${model.status === 'complete' ? 100 : Math.min(model.progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-right text-[11px] text-text-secondary">
                    {model.status === 'downloading' && `${Math.round(model.progress)}%`}
                    {model.status === 'complete' && <span className="text-success">Done</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
