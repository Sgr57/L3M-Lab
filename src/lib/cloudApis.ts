import type { GenerationParameters, TestMetrics, ErrorCategory } from '../types'

interface CloudResponse {
  output: string
  metrics: Pick<TestMetrics, 'ttft' | 'tokensPerSecond' | 'totalTime' | 'tokenCount'>
}

export class CloudApiError extends Error {
  readonly provider: string
  readonly status: number
  readonly rawBody: string

  constructor(provider: string, status: number, rawBody: string, message: string) {
    super(message)
    this.name = 'CloudApiError'
    this.provider = provider
    this.status = status
    this.rawBody = rawBody
  }
}

export interface ClassifiedError {
  category: ErrorCategory
  hint: string
  rawError: string
  provider: string
}

export function classifyCloudError(err: unknown, provider: string, status?: number): ClassifiedError {
  const rawError = err instanceof Error ? err.message : String(err)
  // For CloudApiError, also check the response body for keyword matching
  const bodyText = err instanceof CloudApiError ? err.rawBody : ''

  // TypeError: Failed to fetch = network/CORS (fetch spec: CORS failures produce TypeError with no status)
  if (err instanceof TypeError) {
    return {
      category: 'cors',
      hint: provider === 'anthropic'
        ? 'Anthropic API has CORS restrictions. A browser proxy may be needed.'
        : `Network error reaching ${provider} API. Check your connection or CORS settings.`,
      rawError,
      provider,
    }
  }

  // HTTP status-based classification
  if (status) {
    if (status === 401 || status === 403) {
      return {
        category: 'auth',
        hint: `Check your ${provider} API key in Settings.`,
        rawError,
        provider,
      }
    }
    // Google returns 400 for invalid API keys; check response body for auth keywords
    if (status === 400) {
      const lower = (rawError + ' ' + bodyText).toLowerCase()
      if (lower.includes('api key') || lower.includes('api_key') || lower.includes('authentication') || lower.includes('credential')) {
        return {
          category: 'auth',
          hint: `Check your ${provider} API key in Settings.`,
          rawError,
          provider,
        }
      }
    }
    if (status === 429) {
      return {
        category: 'rate-limit',
        hint: `${provider} rate limit exceeded. Wait a moment and try again.`,
        rawError,
        provider,
      }
    }
    if (status === 408 || status === 504) {
      return {
        category: 'timeout',
        hint: `${provider} request timed out. Try a shorter prompt or try again.`,
        rawError,
        provider,
      }
    }
    if (status >= 500) {
      return {
        category: 'server',
        hint: `${provider} server error. Try again later.`,
        rawError,
        provider,
      }
    }
  }

  return { category: 'unknown', hint: 'An unexpected error occurred.', rawError, provider }
}

export async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  params: GenerationParameters
): Promise<CloudResponse> {
  const startTime = performance.now()
  let ttft = 0

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      top_p: params.topP,
      frequency_penalty: params.repeatPenalty - 1,
    }),
  })

  ttft = performance.now() - startTime

  if (!res.ok) {
    const err = await res.text()
    throw new CloudApiError('openai', res.status, err, `OpenAI API error: ${res.status}`)
  }

  const data = await res.json()
  const totalTime = performance.now() - startTime
  const output = data.choices?.[0]?.message?.content ?? ''
  const tokenCount = data.usage?.completion_tokens ?? 0
  const tokensPerSecond = tokenCount > 0 ? (tokenCount / (totalTime / 1000)) : 0

  return {
    output,
    metrics: { ttft, tokensPerSecond, totalTime, tokenCount },
  }
}

export async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  params: GenerationParameters
): Promise<CloudResponse> {
  const startTime = performance.now()

  // Note: Anthropic API has CORS restrictions in the browser.
  // A server-side proxy may be needed for production use.
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens,
      messages: [{ role: 'user', content: prompt }],
      temperature: params.temperature,
      top_p: params.topP,
    }),
  })

  const ttft = performance.now() - startTime

  if (!res.ok) {
    const err = await res.text()
    throw new CloudApiError('anthropic', res.status, err, `Anthropic API error: ${res.status}`)
  }

  const data = await res.json()
  const totalTime = performance.now() - startTime
  const output = data.content?.[0]?.text ?? ''
  const tokenCount = data.usage?.output_tokens ?? 0
  const tokensPerSecond = tokenCount > 0 ? (tokenCount / (totalTime / 1000)) : 0

  return {
    output,
    metrics: { ttft, tokensPerSecond, totalTime, tokenCount },
  }
}

export async function callGoogle(
  apiKey: string,
  model: string,
  prompt: string,
  params: GenerationParameters
): Promise<CloudResponse> {
  const startTime = performance.now()

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
          topP: params.topP,
        },
      }),
    }
  )

  const ttft = performance.now() - startTime

  if (!res.ok) {
    const err = await res.text()
    throw new CloudApiError('google', res.status, err, `Google AI API error: ${res.status}`)
  }

  const data = await res.json()
  const totalTime = performance.now() - startTime
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const tokenCount = data.usageMetadata?.candidatesTokenCount ?? 0
  const tokensPerSecond = tokenCount > 0 ? (tokenCount / (totalTime / 1000)) : 0

  return {
    output,
    metrics: { ttft, tokensPerSecond, totalTime, tokenCount },
  }
}
