import type { Backend } from '../../types'

const BADGE_LABELS: Record<Backend, string> = {
  api: 'API',
  webgpu: 'GPU',
  wasm: 'WASM',
}

export function BackendBadge({ backend }: { backend: Backend }): React.JSX.Element {
  const cls =
    backend === 'api'
      ? 'bg-cloud-bg text-cloud'
      : backend === 'wasm'
        ? 'bg-wasm-bg text-wasm'
        : 'bg-webgpu-bg text-primary'

  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {BADGE_LABELS[backend]}
    </span>
  )
}
