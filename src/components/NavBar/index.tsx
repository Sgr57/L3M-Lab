import { NavLink } from 'react-router-dom'
import { useSettingsStore } from '../../stores/useSettingsStore'
import logoIcon from '../../assets/logo-icon.png'

export function NavBar() {
  const webgpuSupported = useSettingsStore((s) => s.webgpuSupported)

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-surface px-8 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <img src={logoIcon} alt="" className="h-6 w-6 rounded" />
          <span className="text-[17px] font-bold tracking-tight text-primary">
            L3M Lab
          </span>
        </div>
        <div className="flex gap-1">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `rounded-lg px-3.5 py-1.5 text-[13px] font-medium ${
                isActive
                  ? 'bg-webgpu-bg text-primary'
                  : 'text-text-secondary hover:bg-bg'
              }`
            }
          >
            Compare
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `rounded-lg px-3.5 py-1.5 text-[13px] font-medium ${
                isActive
                  ? 'bg-webgpu-bg text-primary'
                  : 'text-text-secondary hover:bg-bg'
              }`
            }
          >
            Settings
          </NavLink>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {webgpuSupported !== null && (
          <span
            className={`rounded-xl px-2.5 py-0.5 text-[11px] font-semibold ${
              webgpuSupported
                ? 'bg-wasm-bg text-success'
                : 'bg-bg text-text-tertiary'
            }`}
          >
            {webgpuSupported ? 'WebGPU supported' : 'WebGPU not available'}
          </span>
        )}
      </div>
    </nav>
  )
}
