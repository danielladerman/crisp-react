import { useState, useEffect, useCallback } from 'react'
import { getStreak, updateStreak } from '../lib/storage'

export function useStreak(userId) {
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getStreak(userId)
      .then(setStreak)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  const recordPractice = useCallback(async () => {
    if (!userId) return
    const updated = await updateStreak(userId)
    setStreak(updated)
    return updated
  }, [userId])

  return { streak, loading, recordPractice }
}
