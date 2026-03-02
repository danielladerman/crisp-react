// src/hooks/useTranscription.ts — Whisper API transcription via Vercel proxy
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_URL!

export function useTranscription() {
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const transcribe = useCallback(async (audioUri: string): Promise<string> => {
    setTranscribing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as unknown as Blob)

      const response = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Transcription failed (${response.status}): ${body}`)
      }

      const data = await response.json()
      return data.text
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed'
      setError(msg)
      throw err
    } finally {
      setTranscribing(false)
    }
  }, [])

  return { transcribe, transcribing, error }
}
