import { useState, useCallback, useRef } from 'react'
import { createSession, updateSession } from '../lib/storage'
import { callClaudeWithCallbacks } from '../lib/claude'
import { COACHING_SYSTEM_PROMPT, DEEP_DIVE_SYSTEM_PROMPT } from '../lib/prompts'
import { detectWeaknessFromFeedback } from '../lib/frameworks'
import { saveCheckpoint, clearCheckpoint, SESSION_KEY } from '../lib/sessionCheckpoint'
// Note: saveCheckpoint/clearCheckpoint are async in RN (AsyncStorage) but fire-and-forget is fine
import parseFeedback from '../lib/parseFeedback'

export function useSession({ userId, sessionCount = 0, voiceModel = null, onWeaknessDetected = null }) {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState('prompt') // prompt | responding | thinking | feedback | drilling | marking | explaining | quality | closed
  const [feedback, setFeedback] = useState('')
  const [feedbackStreaming, setFeedbackStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [deepDiveCount, setDeepDiveCount] = useState(0)
  const [conversationHistory, setConversationHistory] = useState([])
  const [drillText, setDrillText] = useState(null)
  const [drillResponse, setDrillResponse] = useState('')
  const [markExplanation, setMarkExplanation] = useState('')
  const [qualitySignal, setQualitySignal] = useState(null)
  const [sessionMode, setSessionMode] = useState('daily')
  const startTimeRef = useRef(null)
  // Track prompt info for checkpointing
  const promptRef = useRef({ promptType: null, promptText: null })

  const checkpoint = useCallback((phaseOverride, extra = {}) => {
    if (!session) return
    saveCheckpoint(SESSION_KEY, {
      sessionId: session.id,
      phase: phaseOverride,
      promptType: promptRef.current.promptType,
      promptText: promptRef.current.promptText,
      feedback,
      conversationHistory,
      drillText,
      drillResponse,
      deepDiveCount,
      sessionMode,
      ...extra,
    })
  }, [session, feedback, conversationHistory, drillText, drillResponse, deepDiveCount, sessionMode])

  const restoreFromCheckpoint = useCallback((cp) => {
    setPhase(cp.phase)
    setFeedback(cp.feedback || '')
    setConversationHistory(cp.conversationHistory || [])
    setDrillText(cp.drillText || null)
    setDrillResponse(cp.drillResponse || '')
    setDeepDiveCount(cp.deepDiveCount || 0)
    setSessionMode(cp.sessionMode || 'daily')
    promptRef.current = { promptType: cp.promptType, promptText: cp.promptText }
  }, [])

  const startSession = useCallback(async ({ promptType, promptText }) => {
    try {
      promptRef.current = { promptType, promptText }
      const newSession = await createSession({
        userId,
        promptType,
        promptText,
      })
      setSession(newSession)
      setPhase('responding')
      startTimeRef.current = Date.now()
      saveCheckpoint(SESSION_KEY, {
        sessionId: newSession.id,
        phase: 'responding',
        promptType,
        promptText,
      })
      return newSession
    } catch (err) {
      setError((err instanceof Error ? err.message : 'Unknown error'))
      throw err
    }
  }, [userId])

  const submitResponse = useCallback(async (responseText) => {
    if (!session) return
    setPhase('thinking')
    setError(null)

    try {
      await updateSession(session.id, { responseText })

      const voiceModelContext = voiceModel
        ? `\n\nVOICE MODEL:\n${JSON.stringify(voiceModel, null, 2)}`
        : ''

      const systemPrompt = `${COACHING_SYSTEM_PROMPT}\n\nSession count for this user: ${sessionCount}${voiceModelContext}`

      const messages = [
        ...conversationHistory,
        { role: 'user', content: responseText },
      ]

      setFeedbackStreaming(true)
      setFeedback('')

      await callClaudeWithCallbacks({
        systemPrompt,
        messages,
        onChunk: (text) => setFeedback(text),
        onDone: async (fullText) => {
          setFeedbackStreaming(false)
          setPhase('feedback')
          setConversationHistory([
            ...messages,
            { role: 'assistant', content: fullText },
          ])

          const parts = parseFeedback(fullText)
          setDrillText(parts.drill)
          await updateSession(session.id, {
            feedbackEcho: parts.echo,
            feedbackName: parts.name,
            feedbackDrill: parts.drill,
            feedbackOpen: parts.open,
            deepDiveExchanges: [...messages, { role: 'assistant', content: fullText }],
          })

          checkpoint('feedback', {
            feedback: fullText,
            conversationHistory: [...messages, { role: 'assistant', content: fullText }],
            drillText: parts.drill,
            responseText,
          })

          // Detect weakness from feedback and notify caller
          const detectedWeakness = detectWeaknessFromFeedback(parts.name, parts.drill)
          if (detectedWeakness && onWeaknessDetected) {
            onWeaknessDetected(detectedWeakness)
          }
        },
        onError: (err) => {
          setFeedbackStreaming(false)
          setError((err instanceof Error ? err.message : 'Unknown error'))
          setPhase('feedback')
        },
      })
    } catch (err) {
      setError((err instanceof Error ? err.message : 'Unknown error'))
      setPhase('feedback')
    }
  }, [session, sessionCount, voiceModel, conversationHistory, onWeaknessDetected, checkpoint])

  const goDeeper = useCallback(async (openQuestion) => {
    if (deepDiveCount >= 10) return
    setDeepDiveCount(prev => prev + 1)
    setPhase('responding')
    // The Open question becomes the next prompt — user responds to it
  }, [deepDiveCount])

  const submitDeepDive = useCallback(async (responseText) => {
    setPhase('thinking')
    setError(null)

    try {
      const messages = [
        ...conversationHistory,
        { role: 'user', content: responseText },
      ]

      setFeedbackStreaming(true)
      setFeedback('')

      await callClaudeWithCallbacks({
        systemPrompt: `${DEEP_DIVE_SYSTEM_PROMPT}\n\nSession count: ${sessionCount}\nContext from previous exchange is in the conversation history.`,
        messages,
        onChunk: (text) => setFeedback(text),
        onDone: async (fullText) => {
          setFeedbackStreaming(false)
          setPhase('feedback')
          const updatedHistory = [...messages, { role: 'assistant', content: fullText }]
          setConversationHistory(updatedHistory)

          await updateSession(session.id, { deepDiveExchanges: updatedHistory })

          checkpoint('feedback', {
            feedback: fullText,
            conversationHistory: updatedHistory,
          })
        },
        onError: (err) => {
          setFeedbackStreaming(false)
          setError((err instanceof Error ? err.message : 'Unknown error'))
          setPhase('feedback')
        },
      })
    } catch (err) {
      setError((err instanceof Error ? err.message : 'Unknown error'))
      setPhase('feedback')
    }
  }, [session, sessionCount, conversationHistory, checkpoint])

  const startMarking = useCallback(() => {
    if (drillText && phase === 'feedback') {
      setPhase('drilling')
    } else {
      setPhase('quality')
    }
  }, [drillText, phase])

  const completeMark = useCallback(async (markedText) => {
    if (!session) return

    const durationSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : null

    await updateSession(session.id, {
      markedMoment: markedText,
      durationSeconds,
      completed: true,
    })

    setPhase('explaining')
    checkpoint('explaining', { markedText })
  }, [session, checkpoint])

  const submitDrill = useCallback(async (response) => {
    if (!session) return
    setDrillResponse(response)
    await updateSession(session.id, {
      drillResponse: response,
    })
    setPhase('quality')
    checkpoint('quality', { drillResponse: response })
  }, [session, checkpoint])

  const skipDrill = useCallback(async () => {
    if (!session) return
    await updateSession(session.id, {
      drillSkipped: true,
    })
    setPhase('quality')
  }, [session])

  const submitExplanation = useCallback(async (text) => {
    if (!session) return
    setMarkExplanation(text)
    await updateSession(session.id, {
      markExplanation: text,
    })
    setPhase('quality')
    checkpoint('quality', { markExplanation: text })
  }, [session, checkpoint])

  const skipExplanation = useCallback(() => {
    setPhase('quality')
  }, [])

  const submitQuality = useCallback(async (signal) => {
    if (!session) return
    setQualitySignal(signal)
    await updateSession(session.id, {
      qualitySignal: signal,
    })
    setPhase('closed')
    clearCheckpoint(SESSION_KEY)
  }, [session])

  const retryFeedback = useCallback(() => {
    setError(null)
    setPhase('thinking')
    // Re-trigger the last submission
  }, [])

  return {
    session,
    phase,
    feedback,
    feedbackStreaming,
    error,
    deepDiveCount,
    drillText,
    drillResponse,
    markExplanation,
    qualitySignal,
    sessionMode,
    startSession,
    submitResponse,
    goDeeper,
    submitDeepDive,
    startMarking,
    completeMark,
    submitDrill,
    skipDrill,
    submitExplanation,
    skipExplanation,
    submitQuality,
    retryFeedback,
    setPhase,
    setSession,
    restoreFromCheckpoint,
  }
}
