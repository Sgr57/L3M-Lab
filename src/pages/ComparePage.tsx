import { useCompareStore } from '../stores/useCompareStore'
import { PromptInput } from '../components/PromptInput'
import { ModelSelector } from '../components/ModelSelector'
import { TestControls } from '../components/TestControls'
import { TestProgress } from '../components/TestProgress'
import { ResultsSummary } from '../components/ResultsSummary'
import { PerformanceCharts } from '../components/PerformanceCharts'
import { ComparisonTable } from '../components/ComparisonTable'
import { OutputComparison } from '../components/OutputComparison'
import { ExportBar } from '../components/ExportBar'

export function ComparePage() {
  const status = useCompareStore((s) => s.executionStatus)
  const results = useCompareStore((s) => s.results)

  const isRunning = status === 'running' || status === 'downloading'
  const hasResults = results.length > 0

  return (
    <div className="flex flex-col gap-4">
      <PromptInput />
      <ModelSelector />
      <TestControls />
      {isRunning && <TestProgress />}
      {hasResults && (
        <>
          <ResultsSummary />
          <PerformanceCharts />
          <ComparisonTable />
          <OutputComparison />
          <ExportBar />
        </>
      )}
    </div>
  )
}
