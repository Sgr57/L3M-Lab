import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useCompareStore } from '../../stores/useCompareStore'
import type { Backend } from '../../types'

const BACKEND_COLORS: Record<Backend, string> = {
  api: '#8250df',
  webgpu: '#0969da',
  wasm: '#1a7f37',
}

const BACKEND_COLORS_DARK: Record<Backend, string> = {
  api: '#8250df',
  webgpu: '#0969da',
  wasm: '#1a7f37',
}

const BACKEND_COLORS_MID: Record<Backend, string> = {
  api: '#c297dc',
  webgpu: '#79c0ff',
  wasm: '#7ee787',
}

const BACKEND_COLORS_LIGHT: Record<Backend, string> = {
  api: '#e8d5f5',
  webgpu: '#b6dcfe',
  wasm: '#aff5b4',
}

export function PerformanceCharts() {
  const results = useCompareStore((s) => s.results)

  if (results.length === 0) return null

  const speedData = [...results]
    .sort((a, b) => b.metrics.tokensPerSecond - a.metrics.tokensPerSecond)
    .map((r) => ({
      name: r.config.displayName,
      tokensPerSecond: Number(r.metrics.tokensPerSecond.toFixed(1)),
      backend: r.config.backend,
    }))

  const timeData = [...results]
    .sort((a, b) => a.metrics.totalTime - b.metrics.totalTime)
    .map((r) => ({
      name: r.config.displayName,
      loadTime: r.metrics.loadTime ?? 0,
      initTime: r.metrics.initTime ?? 0,
      generationTime: Math.max(
        0,
        r.metrics.totalTime - (r.metrics.loadTime ?? 0) - (r.metrics.initTime ?? 0)
      ),
      backend: r.config.backend,
    }))

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Tokens/sec Chart */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Tokens / sec
        </div>
        <ResponsiveContainer width="100%" height={results.length * 44 + 40}>
          <BarChart layout="vertical" data={speedData} margin={{ left: 10, right: 20 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => [`${value} tok/s`, 'Speed']}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend
              formatter={(value: string) => (
                <span style={{ fontSize: 11 }}>{value}</span>
              )}
            />
            <Bar dataKey="tokensPerSecond" name="Tokens/sec" radius={[0, 4, 4, 0]}>
              {speedData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={BACKEND_COLORS[entry.backend as Backend]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <BackendLegend />
      </div>

      {/* Time Breakdown Chart */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Time Breakdown
        </div>
        <ResponsiveContainer width="100%" height={results.length * 44 + 40}>
          <BarChart layout="vertical" data={timeData} margin={{ left: 10, right: 20 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} unit=" ms" />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toFixed(0)} ms`,
                name,
              ]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend
              formatter={(value: string) => (
                <span style={{ fontSize: 11 }}>{value}</span>
              )}
            />
            <Bar dataKey="loadTime" name="Load" stackId="time" radius={[0, 0, 0, 0]}>
              {timeData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={BACKEND_COLORS_DARK[entry.backend as Backend]}
                />
              ))}
            </Bar>
            <Bar dataKey="initTime" name="Init" stackId="time">
              {timeData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={BACKEND_COLORS_MID[entry.backend as Backend]}
                />
              ))}
            </Bar>
            <Bar
              dataKey="generationTime"
              name="Generation"
              stackId="time"
              radius={[0, 4, 4, 0]}
            >
              {timeData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={BACKEND_COLORS_LIGHT[entry.backend as Backend]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <BackendLegend />
      </div>
    </div>
  )
}

function BackendLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-text-secondary">
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: BACKEND_COLORS.api }}
        />
        Cloud / API
      </span>
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: BACKEND_COLORS.webgpu }}
        />
        WebGPU
      </span>
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: BACKEND_COLORS.wasm }}
        />
        WASM
      </span>
    </div>
  )
}
