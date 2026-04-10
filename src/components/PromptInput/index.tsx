import { useCompareStore } from '../../stores/useCompareStore'

export function PromptInput() {
  const prompt = useCompareStore((s) => s.prompt)
  const setPrompt = useCompareStore((s) => s.setPrompt)
  const parameters = useCompareStore((s) => s.parameters)
  const setParameter = useCompareStore((s) => s.setParameter)
  const status = useCompareStore((s) => s.executionStatus)
  const disabled = status === 'running' || status === 'downloading'

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Prompt
      </div>
      <textarea
        className="w-full resize-y rounded-lg border border-border bg-bg p-3 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none"
        rows={3}
        placeholder="Enter your prompt here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={disabled}
      />
      <div className="mt-2.5 flex gap-5 text-xs text-text-secondary">
        <ParamInput
          label="Temperature"
          value={parameters.temperature}
          onChange={(v) => setParameter('temperature', v)}
          step={0.1}
          min={0}
          max={2}
          disabled={disabled}
        />
        <ParamInput
          label="Max tokens"
          value={parameters.maxTokens}
          onChange={(v) => setParameter('maxTokens', v)}
          step={64}
          min={1}
          max={4096}
          disabled={disabled}
        />
        <ParamInput
          label="Top-p"
          value={parameters.topP}
          onChange={(v) => setParameter('topP', v)}
          step={0.05}
          min={0}
          max={1}
          disabled={disabled}
        />
        <ParamInput
          label="Repeat penalty"
          value={parameters.repeatPenalty}
          onChange={(v) => setParameter('repeatPenalty', v)}
          step={0.1}
          min={1}
          max={2}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

function ParamInput({
  label,
  value,
  onChange,
  step,
  min,
  max,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step: number
  min: number
  max: number
  disabled: boolean
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-text-secondary">{label}:</span>
      <input
        type="number"
        className="w-16 rounded border border-border bg-bg px-1.5 py-0.5 text-xs font-semibold text-primary focus:border-primary focus:outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
      />
    </label>
  )
}
