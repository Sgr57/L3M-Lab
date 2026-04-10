import { useCompareStore } from '../../stores/useCompareStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import {
  formatAsMarkdown,
  formatAsCSV,
  formatAsJSON,
  downloadFile,
  copyToClipboard,
  buildComparisonRun,
} from '../../lib/exportUtils'

export function ExportBar() {
  const { prompt, configs, results } = useCompareStore()
  const parameters = useSettingsStore((s) => s.parameters)

  function getRun() {
    const startedAt = results.length > 0 ? results[0].timestamp : Date.now()
    return buildComparisonRun(prompt, parameters, configs, results, startedAt)
  }

  function handleCopyMarkdown() {
    const md = formatAsMarkdown(getRun())
    copyToClipboard(md)
  }

  function handleExportCSV() {
    const csv = formatAsCSV(getRun())
    downloadFile(csv, 'comparison-results.csv', 'text/csv')
  }

  function handleExportJSON() {
    const json = formatAsJSON(getRun())
    downloadFile(json, 'comparison-results.json', 'application/json')
  }

  return (
    <div className="flex justify-end gap-2 border-t border-border-light pt-4">
      <button
        onClick={handleCopyMarkdown}
        className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg hover:text-text-primary"
      >
        Copy as Markdown
      </button>
      <button
        onClick={handleExportCSV}
        className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg hover:text-text-primary"
      >
        Export CSV
      </button>
      <button
        onClick={handleExportJSON}
        className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg hover:text-text-primary"
      >
        Export JSON
      </button>
    </div>
  )
}
