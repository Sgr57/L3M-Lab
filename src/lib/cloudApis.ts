import type { GenerationParameters, TestMetrics } from '../types'

interface CloudResponse {
  output: string
  metrics: Pick<TestMetrics, 'ttft' | 'tokensPerSecond' | 'totalTime' | 'tokenCount'>
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
    throw new Error(`OpenAI API error: ${res.status} ${err}`)
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
    throw new Error(`Anthropic API error: ${res.status} ${err}`)
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
    throw new Error(`Google AI API error: ${res.status} ${err}`)
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
