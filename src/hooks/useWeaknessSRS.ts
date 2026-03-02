import { useState, useEffect, useCallback, useRef } from 'react'
import { getActiveWeaknesses, upsertWeaknessSRS } from '../lib/storage'
import {
  getWeaknessDrillsDue,
  shouldResolveWeakness,
  getNextInterval,
} from '../lib/frameworks'

export function useWeaknessSRS(userId) {
  const [weaknesses, setWeaknesses] = useState([])
  const [loading, setLoading] = useState(true)
  // Ref keeps latest weaknesses available without destabilizing callbacks
  const weaknessesRef = useRef(weaknesses)
  weaknessesRef.current = weaknesses

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function load() {
      try {
        const data = await getActiveWeaknesses(userId)
        if (!cancelled) {
          setWeaknesses(data)
          setLoading(false)
        }
      } catch (err) {
        if (__DEV__) console.error('Failed to load weaknesses:', err)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  const recordDetection = useCallback(async (weaknessId) => {
    const existing = weaknessesRef.current.find(w => w.weakness_id === weaknessId)

    const updates = {
      sessions_active: (existing?.sessions_active || 0) + 1,
      sessions_clean: 0,
      last_appeared: new Date().toISOString(),
      status: 'active',
      interval_days: existing?.interval_days || 3,
    }

    try {
      await upsertWeaknessSRS(userId, weaknessId, updates)
      const refreshed = await getActiveWeaknesses(userId)
      setWeaknesses(refreshed)
    } catch (err) {
      if (__DEV__) console.error('Failed to record weakness detection:', err)
    }
  }, [userId])

  const recordClean = useCallback(async (weaknessId) => {
    const existing = weaknessesRef.current.find(w => w.weakness_id === weaknessId)
    if (!existing) return

    const newCleanCount = (existing.sessions_clean || 0) + 1
    const resolved = shouldResolveWeakness(newCleanCount, existing.interval_days || 3)

    const updates = {
      sessions_clean: newCleanCount,
      status: resolved ? 'resolved' : 'active',
    }

    try {
      await upsertWeaknessSRS(userId, weaknessId, updates)
      const refreshed = await getActiveWeaknesses(userId)
      setWeaknesses(refreshed)
    } catch (err) {
      if (__DEV__) console.error('Failed to record clean session:', err)
    }
  }, [userId])

  const getDrillsDue = useCallback(() => {
    return getWeaknessDrillsDue(weaknessesRef.current)
  }, [])

  const updateAfterDrill = useCallback(async (weaknessId, qualitySignal) => {
    const existing = weaknessesRef.current.find(w => w.weakness_id === weaknessId)
    const currentInterval = existing?.interval_days || 3
    const nextInterval = getNextInterval(currentInterval, qualitySignal)

    const updates = {
      last_drilled: new Date().toISOString(),
      interval_days: Math.max(nextInterval, 1),
    }

    try {
      await upsertWeaknessSRS(userId, weaknessId, updates)
      const refreshed = await getActiveWeaknesses(userId)
      setWeaknesses(refreshed)
    } catch (err) {
      if (__DEV__) console.error('Failed to update after drill:', err)
    }
  }, [userId])

  return {
    weaknesses,
    loading,
    recordDetection,
    recordClean,
    getDrillsDue,
    updateAfterDrill,
  }
}
