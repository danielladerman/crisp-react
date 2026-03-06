import type { VercelRequest, VercelResponse } from '@vercel/node'
import { jwtVerify } from 'jose'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET)
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  // Verify JWT
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing authorization token' } })
  }

  const token = authHeader.slice(7)
  const valid = await verifyToken(token)
  if (!valid) {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } })
  }

  // Parse client request
  const { systemPrompt, messages, model = 'claude-sonnet-4-6', maxTokens = 2000, stream = false } = req.body

  if (!systemPrompt || !messages) {
    return res.status(400).json({ error: { message: 'Missing systemPrompt or messages' } })
  }

  // Build Anthropic request
  const anthropicBody = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
    stream,
  }

  try {
    const anthropicRes = await fetch(ANTHROPIC_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(anthropicBody),
    })

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text()
      return res.status(anthropicRes.status).json({
        error: { message: `Anthropic API error: ${errBody}` },
      })
    }

    if (stream) {
      // Pipe SSE stream directly to client
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = anthropicRes.body?.getReader()
      if (!reader) {
        return res.status(500).json({ error: { message: 'No response stream from Anthropic' } })
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
      } catch (err) {
        // Client may have disconnected
      } finally {
        res.end()
      }
    } else {
      // Non-streaming: return JSON directly
      const data = await anthropicRes.json()
      return res.status(200).json(data)
    }
  } catch (err: any) {
    return res.status(500).json({
      error: { message: err.message || 'Internal server error' },
    })
  }
}
