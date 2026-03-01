// app/session.tsx
import { useEffect, useRef, useCallback } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../src/hooks/useAuth'
import { useSessionReducer } from '../src/hooks/useSessionReducer'
import { useSessionSideEffects } from '../src/hooks/useSessionSideEffects'
import { useStreak } from '../src/hooks/useStreak'
import { useWeaknessSRS } from '../src/hooks/useWeaknessSRS'
import { PHASE_COMPONENTS } from '../src/components/session'
import { LoadingScreen, ErrorBoundary } from '../src/components/ui'
import { loadCheckpoint, SESSION_KEY } from '../src/lib/sessionCheckpoint'
import { getSession } from '../src/lib/storage'

export default function SessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    promptType: string
    promptText: string
    sessionCount: string
    checkpointId?: string
  }>()

  const sessionCount = parseInt(params.sessionCount || '0', 10)
  const { streak, recordPractice } = useStreak(user?.id)
  const { recordDetection } = useWeaknessSRS(user?.id)

  const [state, dispatch] = useSessionReducer()
  const sideEffects = useSessionSideEffects(state, dispatch, {
    userId: user?.id,
    sessionCount,
    onWeaknessDetected: recordDetection,
  })

  // Start or restore session
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !user) return
    startedRef.current = true

    if (params.checkpointId) {
      loadCheckpoint(SESSION_KEY).then(async (cp) => {
        if (cp) {
          dispatch({ type: 'RESTORE_CHECKPOINT', checkpoint: cp })
          try {
            const session = await getSession(cp.sessionId)
            dispatch({ type: 'SET_SESSION', session })
          } catch (err) {
            if (__DEV__) console.error('Failed to restore session:', err)
            dispatch({ type: 'SET_ERROR', error: 'Could not restore session' })
          }
        }
      })
    } else {
      sideEffects.startSession(params.promptType || 'reveal', params.promptText || '')
    }
  }, [user])

  const handleClose = useCallback(() => router.back(), [])

  const PhaseComponent = PHASE_COMPONENTS[state.phase]

  return (
    <ErrorBoundary fallbackMessage="Something went wrong during your session.">
      {PhaseComponent ? (
        <PhaseComponent
          state={state}
          dispatch={dispatch}
          sideEffects={sideEffects}
          streak={streak}
          recordPractice={recordPractice}
          sessionNumber={sessionCount + 1}
          onClose={handleClose}
        />
      ) : (
        <LoadingScreen />
      )}
    </ErrorBoundary>
  )
}
