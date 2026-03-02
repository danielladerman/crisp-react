// src/hooks/usePatterns.ts — Fetches and filters user patterns (strengths + weaknesses)
import { useState, useEffect, useCallback, useMemo } from 'react'
import { getPatterns } from '../lib/storage'
import type { Pattern } from '../types/session'

export function usePatterns(userId: string | undefined) {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    getPatterns(userId)
      .then(setPatterns)
      .catch(err => { if (__DEV__) console.error('Failed to load patterns:', err) })
      .finally(() => setLoading(false))
  }, [userId])

  const strengths = useMemo(
    () => patterns.filter(p => p.pattern_type === 'strength' && p.status === 'active'),
    [patterns],
  )

  const weaknesses = useMemo(
    () => patterns.filter(p => p.pattern_type === 'weakness' && p.status === 'active'),
    [patterns],
  )

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const data = await getPatterns(userId)
      setPatterns(data)
    } catch (err) {
      if (__DEV__) console.error('Failed to refresh patterns:', err)
    }
  }, [userId])

  return { patterns, strengths, weaknesses, loading, refresh }
}
