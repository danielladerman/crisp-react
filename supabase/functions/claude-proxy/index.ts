import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Service-role client for auth verification — created once, reused across requests
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: { message: 'Method not allowed' } }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Verify JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    console.log('AUTH: No Authorization header present')
    return new Response(
      JSON.stringify({ error: { message: 'Missing authorization token' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const token = authHeader.replace('Bearer ', '')
  console.log('AUTH: Verifying token, length:', token.length)

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  console.log('AUTH: Result —', user ? `user=${user.id}` : 'no user', authError ? `error=${authError.message}` : 'no error')

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: { message: authError?.message || 'Invalid or expired token' } }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Parse client request
  const { systemPrompt, messages, model = 'claude-sonnet-4-6', maxTokens = 2000, stream = false } = await req.json()

  if (!systemPrompt || !messages) {
    return new Response(
      JSON.stringify({ error: { message: 'Missing systemPrompt or messages' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
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
      return new Response(
        JSON.stringify({ error: { message: `Anthropic API error: ${errBody}` } }),
        { status: anthropicRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (stream) {
      // Pipe SSE stream directly to client
      return new Response(anthropicRes.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Non-streaming: return JSON directly
      const data = await anthropicRes.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: { message: err.message || 'Internal server error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
