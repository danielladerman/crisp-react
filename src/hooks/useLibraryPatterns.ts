import { useState, useCallback } from 'react'
import { callClaude } from '../lib/claude'
import { PATTERN_ANALYSIS_SYSTEM_PROMPT } from '../lib/prompts'

export function useLibraryPatterns({ entries }) {
  const [patterns, setPatterns] = useState(null)
  const [loading, setLoading] = useState(false)

  const analyzePatterns = useCallback(async () => {
    if (!entries || entries.length === 0) return null

    setLoading(true)
    try {
      const recent = entries.slice(-50)
      const result = await callClaude({
        systemPrompt: PATTERN_ANALYSIS_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Analyze these ${recent.length} library entries:\n\n${JSON.stringify(recent)}`,
        }],
      })

      const parsed = JSON.parse(result)
      setPatterns(parsed)
      return parsed
    } catch (err) {
      console.error('Failed to analyze library patterns:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [entries])

  return {
    patterns,
    loading,
    analyzePatterns,
  }
}
