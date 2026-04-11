import type { Backend } from '../../types'

export function TypeBadge({ type, backend }: { type: string; backend: Backend }): React.JSX.Element {
  const cls =
    type === 'cloud'
      ? 'bg-cloud-bg text-cloud'
      : backend === 'wasm'
        ? 'bg-wasm-bg text-wasm'
        : 'bg-webgpu-bg text-primary'

  return (
    <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {type === 'cloud' ? 'cloud' : backend === 'wasm' ? 'local-wasm' : 'local'}
    </span>
  )
}
