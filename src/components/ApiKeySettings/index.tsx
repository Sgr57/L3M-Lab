import { useState } from 'react'
import { useSettingsStore } from '../../stores/useSettingsStore'
import type { CloudProvider } from '../../types'

const providers: { key: CloudProvider; name: string; placeholder: string }[] = [
  { key: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { key: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { key: 'google', name: 'Google AI', placeholder: 'AIza...' },
]

export function ApiKeySettings() {
  return (
    <div className="flex flex-col gap-4">
      {providers.map((p) => (
        <ApiKeyCard key={p.key} provider={p.key} name={p.name} placeholder={p.placeholder} />
      ))}
      <p className="text-xs text-text-tertiary">
        API keys are stored in your browser's localStorage. They are never sent to any server other than the respective provider's API.
      </p>
      <p className="text-xs text-warning">
        Note: Anthropic API has CORS restrictions. Direct browser calls may fail — a server-side proxy may be needed.
      </p>
    </div>
  )
}

function ApiKeyCard({
  provider,
  name,
  placeholder,
}: {
  provider: CloudProvider
  name: string
  placeholder: string
}) {
  const apiKey = useSettingsStore((s) => s.apiKeys[provider])
  const setApiKey = useSettingsStore((s) => s.setApiKey)
  const [visible, setVisible] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  async function handleTest() {
    if (!apiKey) return
    setTesting(true)
    setTestResult(null)

    try {
      let ok = false
      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        ok = res.ok
      } else if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        })
        ok = res.ok
      } else if (provider === 'google') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        )
        ok = res.ok
      }
      setTestResult(ok ? 'success' : 'error')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">{name}</span>
        {apiKey && (
          <span
            className={`text-[11px] font-semibold ${
              testResult === 'success'
                ? 'text-success'
                : testResult === 'error'
                  ? 'text-error'
                  : 'text-text-tertiary'
            }`}
          >
            {testResult === 'success'
              ? 'Connected'
              : testResult === 'error'
                ? 'Connection failed'
                : ''}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type={visible ? 'text' : 'password'}
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:border-primary focus:outline-none"
          placeholder={placeholder}
          value={apiKey}
          onChange={(e) => {
            setApiKey(provider, e.target.value)
            setTestResult(null)
          }}
        />
        <button
          onClick={() => setVisible(!visible)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:bg-bg"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
        <button
          onClick={handleTest}
          disabled={!apiKey || testing}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:bg-bg disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
      </div>
    </div>
  )
}
