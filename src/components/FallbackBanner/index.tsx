import { useCompareStore } from '../../stores/useCompareStore'

export function FallbackBanner(): React.ReactNode {
  const fallbackWarning = useCompareStore((s) => s.fallbackWarning)
  const status = useCompareStore((s) => s.executionStatus)

  // Show when fallbackWarning is set and execution is still active
  // Per D-05: persists until run completes, then cleared by next reset()
  if (!fallbackWarning) return null
  if (status !== 'running' && status !== 'complete') return null

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-3">
        {/* Warning triangle SVG icon, 16x16 */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0 text-warning"
        >
          <path
            d="M8.22 1.754a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368L8.22 1.754Zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-.25-5.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5Z"
            fill="currentColor"
          />
        </svg>
        <span className="text-[13px] text-text-primary">
          {fallbackWarning}
        </span>
      </div>
    </div>
  )
}
