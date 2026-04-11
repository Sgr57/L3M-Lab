import type { ComparisonRun, TestResult } from '../types'

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—'
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`
}

function stars(rating: number | null): string {
  if (rating === null) return 'Not rated'
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

export function formatAsMarkdown(run: ComparisonRun): string {
  const lines: string[] = [
    `# LLM Comparison Results`,
    '',
    `**Prompt:** ${run.prompt}`,
    `**Parameters:** temp=${run.parameters.temperature}, max_tokens=${run.parameters.maxTokens}, top_p=${run.parameters.topP}, repeat_penalty=${run.parameters.repeatPenalty}`,
    `**Date:** ${new Date(run.startedAt).toISOString()}`,
    `**Duration:** ${formatMs(run.completedAt - run.startedAt)}`,
    '',
    '## Metrics',
    '',
    '| Model | Type | Quant | Backend | Size | Load | TTFT | Tok/s | Total | Tokens | Rating |',
    '|-------|------|-------|---------|------|------|------|-------|-------|--------|--------|',
  ]

  for (const r of run.results) {
    const c = r.config
    const m = r.metrics
    lines.push(
      `| ${c.displayName} | ${c.backend === 'api' ? 'cloud' : 'local'} | ${c.backend === 'api' ? '—' : c.quantization} | ${c.backend} | ${formatSize(m.modelSize)} | ${formatMs(m.loadTime)} | ${formatMs(m.ttft)} | ${m.tokensPerSecond.toFixed(1)} | ${formatMs(m.totalTime)} | ${m.tokenCount} | ${stars(r.rating)} |`
    )
  }

  lines.push('', '## Outputs', '')

  for (const r of run.results) {
    lines.push(`### ${r.config.displayName}`, '')
    if (r.error) {
      lines.push(`**Error:** ${r.error}`, '')
    } else {
      lines.push(r.output, '')
    }
  }

  const errorsOrFallbacks = run.results.filter((r) => r.error || r.fallbackBackend)
  if (errorsOrFallbacks.length > 0) {
    lines.push('', '## Errors & Fallbacks', '', '| Model | Error Category | Hint | Fallback |', '|-------|---------------|------|----------|')
    for (const r of errorsOrFallbacks) {
      lines.push(
        `| ${r.config.displayName} | ${r.errorCategory ?? '--'} | ${r.errorHint ?? '--'} | ${r.fallbackBackend ?? '--'} |`
      )
    }
  }

  return lines.join('\n')
}

export function formatAsCSV(run: ComparisonRun): string {
  const header = 'Model,Type,Quantization,Backend,Size (bytes),Load Time (ms),Init Time (ms),TTFT (ms),Tokens/sec,Total Time (ms),Token Count,Rating,Output,Fallback Backend,Error Category,Error Hint,Raw Error'
  const rows = run.results.map((r) => {
    const c = r.config
    const m = r.metrics
    const output = r.error ? `ERROR: ${r.error}` : r.output
    return [
      c.displayName,
      c.backend === 'api' ? 'cloud' : 'local',
      c.backend === 'api' ? '' : c.quantization,
      c.backend,
      m.modelSize ?? '',
      m.loadTime?.toFixed(0) ?? '',
      m.initTime?.toFixed(0) ?? '',
      m.ttft.toFixed(0),
      m.tokensPerSecond.toFixed(1),
      m.totalTime.toFixed(0),
      m.tokenCount,
      r.rating ?? '',
      `"${output.replace(/"/g, '""')}"`,
      r.fallbackBackend ?? '',
      r.errorCategory ?? '',
      `"${(r.errorHint ?? '').replace(/"/g, '""')}"`,
      `"${(r.rawError ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

export function formatAsJSON(run: ComparisonRun): string {
  return JSON.stringify(run, null, 2)
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function buildComparisonRun(
  prompt: string,
  parameters: ComparisonRun['parameters'],
  configs: ComparisonRun['configs'],
  results: TestResult[],
  startedAt: number
): ComparisonRun {
  return {
    id: crypto.randomUUID(),
    prompt,
    parameters,
    configs,
    results,
    startedAt,
    completedAt: Date.now(),
  }
}
