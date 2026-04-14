import { useRef, useEffect } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmModalProps): React.ReactElement | null {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Auto-focus Cancel button on open
  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  // Focus trap: prevent Tab from leaving the dialog
  function handleDialogKeyDown(e: React.KeyboardEvent): void {
    if (e.key !== 'Tab') return

    const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[]
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="rounded-xl border border-border bg-surface p-6 shadow-lg max-w-sm w-full mx-4"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <div className="text-xs text-text-secondary mt-2">{message}</div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text-primary hover:bg-bg"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="rounded-lg bg-error px-4 py-2 text-xs font-semibold text-white hover:bg-error/90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
