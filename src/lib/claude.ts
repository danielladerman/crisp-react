import { supabase } from './supabase'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`

async function getJwt() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return session.access_token
}

const REQUEST_TIMEOUT_MS = 45_000 // 45 second timeout for API calls

async function proxyFetch(body: Record<string, unknown>, retried = false, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const token = await getJwt()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.')
    throw err
  }
  clearTimeout(timeout)

  if (response.status === 401 && !retried) {
    await supabase.auth.refreshSession()
    return proxyFetch(body, true, timeoutMs)
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
  timeoutMs?: number
}

export async function callClaude({ systemPrompt, messages, model = 'claude-sonnet-4-6', maxTokens = 2000, timeoutMs }: CallOptions) {
  const response = await proxyFetch({ systemPrompt, messages, model, maxTokens, stream: false }, false, timeoutMs)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(error.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}

// Non-streaming variant with the same callback interface as streamClaude.
// React Native's fetch does not support ReadableStream, so we use a normal
// JSON response and deliver the full text via onDone in one shot.
export async function callClaudeWithCallbacks({ systemPrompt, messages, onChunk: _onChunk, onDone, onError, model = 'claude-sonnet-4-6', maxTokens = 2000 }: StreamOptions) {
  try {
    const response = await proxyFetch({ systemPrompt, messages, model, maxTokens, stream: false })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      throw new Error(error.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    const fullText = data.content[0].text
    onDone(fullText)
    return fullText
  } catch (err) {
    onError(err as Error)
    throw err
  }
}
