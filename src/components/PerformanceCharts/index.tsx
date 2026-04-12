import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { useCompareStore } from '../../stores/useCompareStore'
import { getModelColor, hexToRgba } from '../../lib/modelColors'
import { getDisambiguatedLabels } from '../../lib/disambiguate'

const MAX_LABEL_CHARS = 20

function splitLabel(label: string): string[] {
  if (label.length <= MAX_LABEL_CHARS) return [label]
  const mid = Math.ceil(label.length / 2)
  let splitIdx = label.lastIndexOf(' ', mid)
  if (splitIdx <= 0) splitIdx = label.indexOf(' ', mid)
  if (splitIdx <= 0) splitIdx = mid
  return [label.slice(0, splitIdx).trim(), label.slice(splitIdx).trim()]
}

function CustomYAxisTick({ x, y, payload }: {
  x: number; y: number; payload: { value: string }
}): React.JSX.Element {
  const lines = splitLabel(payload.value)
  const isMultiLine = lines.length > 1

  return (
    <g transform={`translate(${x},${y})`}>
      {isMultiLine ? (
        <>
          <text x={-8} y={0} dy={-3} textAnchor="end" fontSize={12} fill="#1f2328">
            {lines[0]}
          </text>
          <text x={-8} y={0} dy={11} textAnchor="end" fontSize={12} fill="#1f2328">
            {lines[1]}
          </text>
        </>
      ) : (
        <text x={-8} y={0} dy={4} textAnchor="end" fontSize={12} fill="#1f2328">
          {lines[0]}
        </text>
      )}
    </g>
  )
}

export function PerformanceCharts(): React.JSX.Element | null {
  const results = useCompareStore((s) => s.results)
  const configs = useCompareStore((s) => s.configs)

  const labels = useMemo(() => getDisambiguatedLabels(configs), [configs])

  const successfulResults = useMemo(
    () => results.filter((r) => !r.error),
    [results]
  )

  const speedData = useMemo(
    () =>
      [...successfulResults]
        .sort((a, b) => b.metrics.tokensPerSecond - a.metrics.tokensPerSecond)
        .map((r) => ({
          name: labels.get(r.config.id) ?? r.config.displayName,
          tokensPerSecond: Number(r.metrics.tokensPerSecond.toFixed(1)),
          configId: r.config.id,
        })),
    [successfulResults, labels]
  )

  const timeData = useMemo(
    () =>
      [...successfulResults]
        .sort((a, b) => a.metrics.totalTime - b.metrics.totalTime)
        .map((r) => ({
          name: labels.get(r.config.id) ?? r.config.displayName,
          loadTime: r.metrics.loadTime ?? 0,
          initTime: r.metrics.initTime ?? 0,
          generationTime: Math.max(
            0,
            r.metrics.totalTime - (r.metrics.loadTime ?? 0) - (r.metrics.initTime ?? 0)
          ),
          configId: r.config.id,
          totalTimeFormatted: r.metrics.totalTime < 1000
            ? `${Math.round(r.metrics.totalTime)}ms`
            : `${(r.metrics.totalTime / 1000).toFixed(1)}s`,
        })),
    [successfulResults, labels]
  )

  if (successfulResults.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Tokens/sec Chart */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Tokens / sec
        </div>
        <ResponsiveContainer width="100%" height={successfulResults.length * 52 + 40}>
          <BarChart layout="vertical" data={speedData} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              tick={(props: Record<string, unknown>) => <CustomYAxisTick {...(props as { x: number; y: number; payload: { value: string } })} />}
            />
            <Tooltip
              formatter={(value) => [`${value} tok/s`, 'Speed']}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="tokensPerSecond" name="Tokens/sec" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="tokensPerSecond" position="right" fontSize={12} fill="#1f2328" />
              {speedData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={getModelColor(configs, entry.configId)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Time Breakdown Chart */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Time Breakdown
        </div>
        <ResponsiveContainer width="100%" height={successfulResults.length * 52 + 40}>
          <BarChart layout="vertical" data={timeData} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} unit=" ms" />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              tick={(props: Record<string, unknown>) => <CustomYAxisTick {...(props as { x: number; y: number; payload: { value: string } })} />}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toFixed(0)} ms`,
                name,
              ]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="loadTime" name="Load" stackId="time" radius={[0, 0, 0, 0]}>
              {timeData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={getModelColor(configs, entry.configId)}
                />
              ))}
            </Bar>
            <Bar dataKey="initTime" name="Init" stackId="time">
              {timeData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={hexToRgba(getModelColor(configs, entry.configId), 0.65)}
                />
              ))}
            </Bar>
            <Bar
              dataKey="generationTime"
              name="Generation"
              stackId="time"
              radius={[0, 4, 4, 0]}
            >
              <LabelList dataKey="totalTimeFormatted" position="right" fontSize={12} fill="#1f2328" />
              {timeData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={hexToRgba(getModelColor(configs, entry.configId), 0.35)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-text-primary" /> Load</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-text-primary/65" /> Init</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-text-primary/35" /> Generate</span>
        </div>
      </div>
    </div>
  )
}
