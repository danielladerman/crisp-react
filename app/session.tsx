// app/session.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../src/hooks/useAuth'
import { useSessionReducer } from '../src/hooks/useSessionReducer'
import { useSessionSideEffects } from '../src/hooks/useSessionSideEffects'
import { useStreak } from '../src/hooks/useStreak'
import { useWeaknessSRS } from '../src/hooks/useWeaknessSRS'
import { PHASE_COMPONENTS } from '../src/components/session'
import { LoadingScreen, ErrorBoundary } from '../src/components/ui'
import { loadCheckpoint, SESSION_KEY } from '../src/lib/sessionCheckpoint'
import { getSession, getVoiceModel, upsertVoiceModel } from '../src/lib/storage'
import { mapAnswersToVoiceModel } from '../src/lib/intakeMapping'

export default function SessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    promptType: string
    promptText: string
    sessionCount: string
    checkpointId?: string
    focusMode?: string
  }>()

  const sessionCount = parseInt(params.sessionCount || '0', 10)
  const { streak, recordPractice } = useStreak(user?.id)
  const { recordDetection } = useWeaknessSRS(user?.id)
  const [voiceModel, setVoiceModel] = useState<any>(null)

  // Fetch voice model for coaching personalization (session 5+)
  // If missing, seed from intake answers so coaching is never generic
  useEffect(() => {
    if (!user?.id || sessionCount < 5) return
    let cancelled = false
    getVoiceModel(user.id).then(async (vm) => {
      if (cancelled) return
      if (vm) {
        setVoiceModel(vm)
        return
      }
      // Seed from intake answers if voice model was never created
      const intake = user.user_metadata?.intake_answers
      if (intake) {
        try {
          const seeded = mapAnswersToVoiceModel(intake)
          await upsertVoiceModel(user.id!, seeded, sessionCount)
          if (!cancelled) setVoiceModel(seeded)
        } catch (err) {
          if (__DEV__) console.error('Failed to seed voice model from intake:', err)
        }
      }
    }).catch((err) => {
      if (__DEV__) console.error('Failed to load voice model:', err)
    })
    return () => { cancelled = true }
  }, [user?.id, sessionCount])

  const focusMode = (params.focusMode as 'professional' | 'relational' | 'mixed') || 'mixed'

  const [state, dispatch] = useSessionReducer()
  const config = useMemo(() => ({
    userId: user?.id,
    sessionCount,
    voiceModel,
    focusMode,
    onWeaknessDetected: recordDetection,
  }), [user?.id, sessionCount, voiceModel, focusMode, recordDetection])

  const sideEffects = useSessionSideEffects(state, dispatch, config)

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
