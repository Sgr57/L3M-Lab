import { ApiKeySettings } from '../components/ApiKeySettings'

export function SettingsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-text-primary">Settings</h1>
      <h2 className="mb-4 text-sm font-semibold text-text-secondary">
        API Keys for Cloud Model Comparison
      </h2>
      <ApiKeySettings />
    </div>
  )
}
