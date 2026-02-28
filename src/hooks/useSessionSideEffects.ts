// src/hooks/useSessionSideEffects.ts
import { useEffect, useRef, useCallback, type Dispatch } from 'react'
import type { SessionState, SessionAction, Message } from '../types/session'
import { createSession, updateSession } from '../lib/storage'
import { streamClaude } from '../lib/claude'
import { COACHING_SYSTEM_PROMPT, DEEP_DIVE_SYSTEM_PROMPT } from '../lib/prompts'
import { detectWeaknessFromFeedback } from '../lib/frameworks'
import { saveCheckpoint, clearCheckpoint, SESSION_KEY } from '../lib/sessionCheckpoint'
import parseFeedback from '../lib/parseFeedback'

interface SideEffectsConfig {
  userId?: string
  sessionCount: number
  voiceModel?: any
  onWeaknessDetected?: ((id: string) => void) | null
}

export function useSessionSideEffects(
  state: SessionState,
  dispatch: Dispatch<SessionAction>,
  config: SideEffectsConfig,
) {
  const prevPhaseRef = useRef(state.phase)

  // --- Start session: create in DB ---
  const startSession = useCallback(async (promptType: string, promptText: string) => {
    try {
      const session = await createSession({
        userId: config.userId,
        promptType,
        promptText,
      })
      dispatch({ type: 'START', prompt: { promptType, promptText }, session })
      saveCheckpoint(SESSION_KEY, {
        sessionId: session.id,
        phase: 'responding',
        promptType,
        promptText,
      })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Failed to start session' })
    }
  }, [config.userId, dispatch])

  // --- Submit response: save + call Claude ---
  const submitResponse = useCallback(async (responseText: string, isDeepDive = false) => {
    if (!state.session) return
    dispatch({ type: 'SUBMIT_RESPONSE', text: responseText })

    try {
      if (!isDeepDive) {
        await updateSession(state.session.id, { responseText })
      }

      const voiceModelContext = config.voiceModel
        ? `\n\nVOICE MODEL:\n${JSON.stringify(config.voiceModel, null, 2)}`
        : ''

      const systemPrompt = isDeepDive
        ? `${DEEP_DIVE_SYSTEM_PROMPT}\n\nSession count: ${config.sessionCount}\nContext from previous exchange is in the conversation history.`
        : `${COACHING_SYSTEM_PROMPT}\n\nSession count for this user: ${config.sessionCount}${voiceModelContext}`

      const messages: Message[] = [
        ...state.conversationHistory,
        { role: 'user', content: responseText },
      ]

      await streamClaude({
        systemPrompt,
        messages,
        onChunk: (text) => dispatch({ type: 'FEEDBACK_CHUNK', text }),
        onDone: async (text) => {
          const parts = parseFeedback(text)
          const updatedHistory: Message[] = [...messages, { role: 'assistant', content: text }]

          dispatch({
            type: 'FEEDBACK_DONE',
            fullText: text,
            drillText: parts.drill || null,
            conversationHistory: updatedHistory,
          })

          // Save to DB
          await updateSession(state.session!.id, {
            feedbackEcho: parts.echo,
            feedbackName: parts.name,
            feedbackDrill: parts.drill,
            feedbackOpen: parts.open,
            deepDiveExchanges: updatedHistory,
          })

          // Checkpoint
          saveCheckpoint(SESSION_KEY, {
            sessionId: state.session!.id,
            phase: 'feedback',
            promptType: state.prompt?.promptType,
            promptText: state.prompt?.promptText,
            feedback: text,
            conversationHistory: updatedHistory,
            drillText: parts.drill,
            responseText,
          })

          // Weakness detection
          const detected = detectWeaknessFromFeedback(parts.name, parts.drill)
          if (detected && config.onWeaknessDetected) {
            config.onWeaknessDetected(detected)
          }
        },
        onError: (err) => {
          dispatch({ type: 'FEEDBACK_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
        },
      })
    } catch (err) {
      // Always dispatch — the reducer handles FEEDBACK_ERROR idempotently
      dispatch({ type: 'FEEDBACK_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [state.session, state.conversationHistory, state.prompt, config, dispatch])

  // --- Save mark to DB ---
  const saveMark = useCallback(async (markedText: string) => {
    if (!state.session) return
    const durationSeconds = state.startTime
      ? Math.round((Date.now() - state.startTime) / 1000)
      : null
    await updateSession(state.session.id, {
      markedMoment: markedText,
      durationSeconds,
      // NOTE: completed is NOT set here (fixes B8)
    })
  }, [state.session, state.startTime])

  // --- Save drill to DB ---
  const saveDrill = useCallback(async (response: string, skipped = false) => {
    if (!state.session) return
    if (skipped) {
      await updateSession(state.session.id, { drillSkipped: true })
    } else {
      await updateSession(state.session.id, { drillResponse: response })
    }
  }, [state.session])

  // --- Save explanation to DB ---
  const saveExplanation = useCallback(async (text: string) => {
    if (!state.session) return
    await updateSession(state.session.id, { markExplanation: text })
  }, [state.session])

  // --- Save quality and mark complete ---
  const saveQuality = useCallback(async (signal: string) => {
    if (!state.session) return
    await updateSession(state.session.id, {
      qualitySignal: signal,
      completed: true, // NOW we set completed (fixes B8)
    })
    clearCheckpoint(SESSION_KEY)
  }, [state.session])

  // --- Retry logic (fixes B6) ---
  useEffect(() => {
    if (state.phase === 'thinking' && state.lastResponseText && prevPhaseRef.current === 'feedback') {
      // This was a retry -- re-submit the last response
      const isDeepDive = state.deepDiveCount > 0
      submitResponse(state.lastResponseText, isDeepDive)
    }
    prevPhaseRef.current = state.phase
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally trigger only on phase transitions
  }, [state.phase])

  return {
    startSession,
    submitResponse,
    saveMark,
    saveDrill,
    saveExplanation,
    saveQuality,
  }
}
