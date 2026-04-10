import { useCompareStore } from '../../stores/useCompareStore'
import type { TestResult } from '../../types'

function findFastest(results: TestResult[], filter?: (r: TestResult) => boolean) {
  const filtered = filter ? results.filter(filter) : results
  if (filtered.length === 0) return null
  return filtered.reduce((best, r) =>
    r.metrics.tokensPerSecond > best.metrics.tokensPerSecond ? r : best
  )
}

function formatTotalTime(results: TestResult[]) {
  const totalMs = results.reduce((sum, r) => sum + r.metrics.totalTime, 0)
  if (totalMs < 1000) return `${Math.round(totalMs)} ms`
  return `${(totalMs / 1000).toFixed(1)} s`
}

export function ResultsSummary() {
  const results = useCompareStore((s) => s.results)

  if (results.length === 0) return null

  const modelsCount = results.length
  const totalTime = formatTotalTime(results)

  const fastestOverall = findFastest(results)
  const fastestLocal = findFastest(results, (r) => r.config.backend !== 'api')

  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard value={String(modelsCount)} label="Models tested" />
      <StatCard value={totalTime} label="Total time" />
      <StatCard
        value={
          fastestOverall
            ? `${fastestOverall.metrics.tokensPerSecond.toFixed(1)} tok/s`
            : '--'
        }
        label={
          fastestOverall
            ? `Fastest overall \u00b7 ${fastestOverall.config.displayName}`
            : 'Fastest overall'
        }
      />
      <StatCard
        value={
          fastestLocal
            ? `${fastestLocal.metrics.tokensPerSecond.toFixed(1)} tok/s`
            : '--'
        }
        label={
          fastestLocal
            ? `Fastest local \u00b7 ${fastestLocal.config.displayName}`
            : 'Fastest local'
        }
      />
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 text-center">
      <div className="text-[28px] font-bold text-primary">{value}</div>
      <div className="text-[11px] text-text-secondary mt-0.5">{label}</div>
    </div>
  )
}
