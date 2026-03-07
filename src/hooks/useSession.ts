// src/hooks/useSession.ts — Core session hook (simplified 3-phase flow)
// Replaces: useSessionReducer + useSessionSideEffects + usePromptEngine

import { useState, useCallback, useRef } from 'react'
import type { SessionPhase, Session, Interaction, Pattern } from '../types/session'
import {
  createSession, updateSession, addInteraction,
  getRecentInteractions, upsertPattern, getVoiceModel, upsertVoiceModel,
  addToLibrary, getPatterns,
} from '../lib/storage'
import { callClaudeWithCallbacks, callClaude } from '../lib/claude'
import {
  COACHING_PROMPT, DIVE_DEEPER_PROMPT, PATTERN_ANALYSIS_PROMPT,
  WORKOUT_SUGGESTION_PROMPT, VOICE_MODEL_UPDATE_PROMPT,
} from '../lib/prompts'
import { DRILLS } from '../lib/drills'
import { saveCheckpoint, clearCheckpoint, SESSION_KEY } from '../lib/sessionCheckpoint'

const BACKGROUND_TASK_TIMEOUT_MS = 90_000 // 90 seconds for background AI calls

interface SessionConfig {
  userId: string
  sessionCount: number
  voiceModel?: unknown
  patterns?: Pattern[]
  focusMode?: string
}

export function useSession(config: SessionConfig) {
  const [phase, setPhase] = useState<SessionPhase>('prompt')
  const [session, setSession] = useState<Session | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [suggestedDrills, setSuggestedDrills] = useState<string[] | null>(null)
  const [markedText, setMarkedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  // ── Start Session ────────────────────────────

  const startSession = useCallback(async (promptType: string, promptText: string, responseMode: 'text' | 'voice' = 'text') => {
    try {
      const userId = configRef.current.userId
      if (!userId) throw new Error('No authenticated user')
      const newSession = await createSession({
        userId,
        promptType,
        promptText,
        responseMode,
      })
      setSession(newSession)
      setPhase('responding')
      setInteractions([])
      setFeedbackText('')
      setSuggestedDrills(null)
      setError(null)

      saveCheckpoint(SESSION_KEY, {
        sessionId: newSession.id,
        phase: 'responding',
        promptType,
        promptText,
      })

      return newSession
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
      throw err
    }
  }, [])

  // ── Build messages array from interactions ───

  function buildMessages(ints: Interaction[]): Array<{ role: string; content: string }> {
    return ints.map(i => ({ role: i.role, content: i.content }))
  }

  // ── Build coaching system prompt ─────────────

  function buildCoachingPrompt(): string {
    const cfg = configRef.current
    let prompt = COACHING_PROMPT

    if (cfg.voiceModel) {
      prompt += `\n\nVOICE MODEL:\n${JSON.stringify(cfg.voiceModel, null, 2)}`
    }

    if (cfg.focusMode && cfg.focusMode !== 'mixed') {
      prompt += `\nFOCUS MODE: ${cfg.focusMode} — bias observations toward ${cfg.focusMode === 'professional' ? 'professional contexts' : 'relational contexts'}.`
    }

    if (cfg.patterns && cfg.patterns.length > 0) {
      const patternSummary = cfg.patterns.map(p => `${p.pattern_type}: ${p.pattern_id} — ${p.description}`).join('\n')
      prompt += `\n\nKNOWN PATTERNS:\n${patternSummary}`
    }

    prompt += `\n\nSession count: ${cfg.sessionCount}`
    return prompt
  }

  // ── Submit Response (triggers AI feedback) ───

  const submitResponse = useCallback(async (text: string, audioUrl?: string | null) => {
    if (!session) return
    setError(null)
    setFeedbackLoading(true)

    try {
      // Save user interaction
      const userId = configRef.current.userId
      const userInteraction = await addInteraction({
        sessionId: session.id,
        userId,
        role: 'user',
        content: text,
        interactionType: 'response',
        audioUrl: audioUrl || null,
      })

      const updatedInteractions = [...interactions, userInteraction]
      setInteractions(updatedInteractions)

      // Call Claude for coaching feedback
      const messages = buildMessages(updatedInteractions)
      const systemPrompt = buildCoachingPrompt()

      await callClaudeWithCallbacks({
        systemPrompt,
        messages,
        onChunk: () => {}, // non-streaming, unused
        onDone: async (fullText) => {
          // Save AI feedback interaction
          const aiInteraction = await addInteraction({
            sessionId: session.id,
            userId,
            role: 'assistant',
            content: fullText,
            interactionType: 'feedback',
          })

          const finalInteractions = [...updatedInteractions, aiInteraction]
          setInteractions(finalInteractions)
          setFeedbackText(fullText)
          setFeedbackLoading(false)
          setPhase('feedback')

          // Checkpoint
          saveCheckpoint(SESSION_KEY, {
            sessionId: session.id,
            phase: 'feedback',
            promptType: session.prompt_type,
            promptText: session.prompt_text,
            feedbackText: fullText,
          })

          // Fire background tasks (non-blocking)
          runPostSessionTasks(session, finalInteractions, fullText)
        },
        onError: (err) => {
          setFeedbackLoading(false)
          setError(err instanceof Error ? err.message : 'Failed to get feedback')
          setPhase('feedback') // show error in feedback phase
        },
        maxTokens: 2000,
      })
    } catch (err) {
      setFeedbackLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to submit response')
    }
  }, [session, interactions])

  // ── Dive Deeper (stay in responding phase) ───

  const diveDeeper = useCallback(async (text: string) => {
    if (!session) return
    setError(null)

    try {
      // Save user's dive-deeper message
      const userId = configRef.current.userId
      const userInteraction = await addInteraction({
        sessionId: session.id,
        userId,
        role: 'user',
        content: text,
        interactionType: 'dive_deeper',
      })

      const updatedInteractions = [...interactions, userInteraction]
      setInteractions(updatedInteractions)
      setFeedbackLoading(true)

      // Get AI follow-up with voice model + patterns context
      const messages = buildMessages(updatedInteractions)
      const cfg = configRef.current
      let deeperPrompt = DIVE_DEEPER_PROMPT
      if (cfg.voiceModel) {
        deeperPrompt += `\n\nVOICE MODEL:\n${JSON.stringify(cfg.voiceModel, null, 2)}`
      }
      if (cfg.patterns && cfg.patterns.length > 0) {
        const patternSummary = cfg.patterns.map(p => `${p.pattern_type}: ${p.pattern_id} — ${p.description}`).join('\n')
        deeperPrompt += `\n\nKNOWN PATTERNS:\n${patternSummary}`
      }

      await callClaudeWithCallbacks({
        systemPrompt: deeperPrompt,
        messages,
        onChunk: () => {},
        onDone: async (fullText) => {
          const aiInteraction = await addInteraction({
            sessionId: session.id,
            userId,
            role: 'assistant',
            content: fullText,
            interactionType: 'follow_up',
          })

          setInteractions(prev => [...prev, aiInteraction])
          setFeedbackLoading(false)
          // Stay in responding phase — this is the key behavior
        },
        onError: (err) => {
          setFeedbackLoading(false)
          setError(err instanceof Error ? err.message : 'Failed to dive deeper')
        },
        maxTokens: 500,
      })
    } catch (err) {
      setFeedbackLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to dive deeper')
    }
  }, [session, interactions])

  // ── Try Again (back to responding) ───────────

  const tryAgain = useCallback(() => {
    setPhase('responding')
    setFeedbackText('')
    setError(null)
  }, [])

  // ── Mark Moments (save multiple chunks to library, transition to done) ──

  const markMoments = useCallback(async (texts: string[]) => {
    if (__DEV__) console.log('[markMoments] called with', texts.length, 'texts, session:', session?.id, 'userId:', configRef.current.userId)
    if (!session) {
      if (__DEV__) console.warn('[markMoments] No session — aborting')
      return
    }
    const userId = configRef.current.userId
    if (!userId) {
      if (__DEV__) console.warn('[markMoments] No userId — aborting')
      return
    }
    const validTexts = texts.filter(t => t.trim())
    if (__DEV__) console.log('[markMoments] validTexts:', validTexts.length)
    if (validTexts.length > 0) {
      setMarkedText(validTexts.join(' | '))
      for (const text of validTexts) {
        try {
          if (__DEV__) console.log('[markMoments] Saving to library:', text.substring(0, 50) + '...')
          await addToLibrary({
            userId,
            sessionId: session.id,
            markedText: text.trim(),
            promptText: session.prompt_text,
            aiObservation: '',
            promptType: session.prompt_type,
            source: 'session',
          })
          if (__DEV__) console.log('[markMoments] Saved successfully')
        } catch (err) {
          if (__DEV__) console.error('[markMoments] Failed to save marked moment:', err)
        }
      }
    }
  }, [session])

  const skipMarking = useCallback(() => {
    setPhase('done')
  }, [])

  // ── Complete Session ─────────────────────────

  const completeSession = useCallback(async () => {
    if (!session) return
    try {
      await updateSession(session.id, { status: 'completed' })
      clearCheckpoint(SESSION_KEY)
      setPhase('done')
    } catch (err) {
      if (__DEV__) console.error('Failed to complete session:', err)
      // Still mark done locally even if DB update fails
      setPhase('done')
    }
  }, [session])

  // ── Post-Session Background Tasks ────────────

  async function runPostSessionTasks(sess: Session, ints: Interaction[], feedback: string) {
    const cfg = configRef.current
    if (__DEV__) console.log('[runPostSessionTasks] userId:', cfg.userId, '| session:', sess.id)
    if (!cfg.userId) {
      if (__DEV__) console.warn('[runPostSessionTasks] No userId — skipping all background tasks')
      return
    }

    // 1. Pattern analysis
    try {
      const [recentInts, existingPatterns] = await Promise.all([
        getRecentInteractions(cfg.userId, 100),
        getPatterns(cfg.userId),
      ])
      const context = recentInts
        .filter(i => i.role === 'user')
        .map(i => i.content)
        .join('\n---\n')

      // Include existing patterns so Claude can reference them instead of creating duplicates
      const existingList = existingPatterns.length > 0
        ? `\n\nALREADY DETECTED PATTERNS (reuse these pattern_ids if the same pattern is observed, do not create duplicates):\n${existingPatterns.map(p => `- ${p.pattern_type}: ${p.pattern_id} — ${p.description}`).join('\n')}`
        : ''

      const result = await callClaude({
        systemPrompt: PATTERN_ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: `Recent user responses across sessions:\n\n${context}${existingList}` }],
        maxTokens: 1000,
        timeoutMs: BACKGROUND_TASK_TIMEOUT_MS,
      })

      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)

      if (parsed.patterns && Array.isArray(parsed.patterns)) {
        for (const p of parsed.patterns) {
          await upsertPattern(cfg.userId, p, sess.id)
        }
      }
    } catch (err) {
      if (__DEV__) console.error('Pattern analysis failed:', err)
    }

    // 2. Voice model update (trimmed context to reduce timeout risk)
    try {
      const fullModel: any = await getVoiceModel(cfg.userId) || {}
      // Send only the fields Claude needs to update, not the entire model
      const trimmedModel = {
        voicePatterns: fullModel.voicePatterns,
        recentBreakthroughs: fullModel.recentBreakthroughs,
        pendingProbes: fullModel.pendingProbes,
        sessionCount: fullModel.sessionCount,
        growthEdge: fullModel.growthEdge,
        detectedWeaknesses: fullModel.detectedWeaknesses,
      }
      const result = await callClaude({
        systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
        messages: [{
          role: 'user',
          content: `CURRENT VOICE MODEL:\n${JSON.stringify(trimmedModel, null, 2)}\n\nSESSION DATA:\nPrompt: ${sess.prompt_text}\nSession Number: ${cfg.sessionCount + 1}\n\nINTERACTIONS:\n${ints.map(i => `[${i.role}] ${i.content}`).join('\n\n')}\n\nUpdate the voice model. Return only updated JSON.`,
        }],
        maxTokens: 3000,
        timeoutMs: BACKGROUND_TASK_TIMEOUT_MS,
      })

      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const updatedModel = JSON.parse(cleaned)
      if (__DEV__) console.log('[runPostSessionTasks] upsertVoiceModel userId:', cfg.userId)
      if (!cfg.userId) { console.warn('[runPostSessionTasks] Skipping voice model upsert — no userId'); return }
      await upsertVoiceModel(cfg.userId, updatedModel, cfg.sessionCount + 1)
    } catch (err) {
      if (__DEV__) console.error('Voice model update failed:', err)
    }

    // 3. Workout suggestions
    try {
      const drillList = DRILLS.map(d => `${d.id}: ${d.name} (${d.category})`).join('\n')
      const patternList = (cfg.patterns || []).map(p => `${p.pattern_type}: ${p.description}`).join('\n')

      const prompt = WORKOUT_SUGGESTION_PROMPT
        .replace('{drills}', drillList)
        .replace('{feedback}', feedback)
        .replace('{patterns}', patternList || 'None detected yet')

      const result = await callClaude({
        systemPrompt: prompt,
        messages: [{ role: 'user', content: 'Suggest drills based on the above context.' }],
        maxTokens: 500,
        timeoutMs: BACKGROUND_TASK_TIMEOUT_MS,
      })

      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const { drill_ids } = JSON.parse(cleaned)

      if (Array.isArray(drill_ids) && drill_ids.length > 0) {
        await updateSession(sess.id, { suggested_drills: drill_ids })
        setSuggestedDrills(drill_ids)
      }
    } catch (err) {
      if (__DEV__) console.error('Workout suggestion failed:', err)
    }
  }

  return {
    phase,
    session,
    interactions,
    feedbackText,
    feedbackLoading,
    suggestedDrills,
    markedText,
    error,
    startSession,
    submitResponse,
    diveDeeper,
    tryAgain,
    markMoments,
    skipMarking,
    completeSession,
    // Expose for checkpoint restoration
    setPhase,
    setSession,
    setInteractions,
    setFeedbackText,
    setSuggestedDrills,
  }
}
