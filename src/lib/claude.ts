import { supabase } from './supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL!

async function getJwt() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return session.access_token
}

async function proxyFetch(body: Record<string, unknown>, retried = false): Promise<Response> {
  const token = await getJwt()
  const response = await fetch(`${API_BASE}/api/claude`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (response.status === 401 && !retried) {
    await supabase.auth.refreshSession()
    return proxyFetch(body, true)
  }

  return response
}

interface StreamOptions {
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
  onChunk: (text: string) => void
  onDone: (text: string) => void
  onError: (err: Error) => void
  model?: string
  maxTokens?: number
}

export async function streamClaude({ systemPrompt, messages, onChunk, onDone, onError, model = 'claude-sonnet-4-6', maxTokens = 1024 }: StreamOptions) {
  try {
    const response = await proxyFetch({ systemPrompt, messages, model, maxTokens, stream: true })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      throw new Error(error.error?.message || `API error: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('No response body — streaming not supported in this environment')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text
              onChunk(fullText)
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
    }

    onDone(fullText)
    return fullText
  } catch (err) {
    onError(err as Error)
    throw err
  }
}

interface CallOptions {
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
  model?: string
  maxTokens?: number
}

export async function callClaude({ systemPrompt, messages, model = 'claude-sonnet-4-6', maxTokens = 2000 }: CallOptions) {
  const response = await proxyFetch({ systemPrompt, messages, model, maxTokens, stream: false })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(error.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}
