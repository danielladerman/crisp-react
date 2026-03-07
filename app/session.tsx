// app/session.tsx — Rebuilt session screen (3-phase: responding → feedback → done)
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../src/hooks/useAuth'
import { useSession } from '../src/hooks/useSession'
import { useStreak } from '../src/hooks/useStreak'
import { usePatterns } from '../src/hooks/usePatterns'
import { ScreenContainer, Button, Card, ErrorBoundary } from '../src/components/ui'
import { getVoiceModel, upsertVoiceModel, updateStreak, getSession as fetchSession, getSessionInteractions, getPatterns } from '../src/lib/storage'
import { loadCheckpoint, clearCheckpoint, SESSION_KEY } from '../src/lib/sessionCheckpoint'
import { mapAnswersToVoiceModel } from '../src/lib/intakeMapping'
import { getDrillById, WEAKNESS_TO_DRILL } from '../src/lib/drills'
import { callClaude } from '../src/lib/claude'
import { colors, spacing } from '../src/lib/theme'

export default function SessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    promptType: string
    promptText: string
    sessionCount: string
    focusMode?: string
    resumeSessionId?: string
  }>()

  const sessionCount = parseInt(params.sessionCount || '0', 10)
  const focusMode = params.focusMode || 'mixed'
  const { streak, recordPractice } = useStreak(user?.id)
  const { patterns } = usePatterns(user?.id)
  const [voiceModel, setVoiceModel] = useState<unknown>(null)

  // Session hook
  const {
    phase, session, interactions, feedbackText, feedbackLoading,
    suggestedDrills, markedText, error,
    startSession, submitResponse, tryAgain,
    markMoments, completeSession,
    setPhase, setSession, setInteractions, setFeedbackText,
  } = useSession({ userId: user?.id || '', sessionCount, voiceModel, patterns, focusMode })

  // Local state for text input
  const [inputText, setInputText] = useState('')
  // Marking phase state
  const [chunks, setChunks] = useState<string[]>([])
  const [selectedChunks, setSelectedChunks] = useState<Set<number>>(new Set())
  const [aiPicks, setAiPicks] = useState<Set<number>>(new Set())
  const [drillRationales, setDrillRationales] = useState<Record<string, string>>({})

  // Load voice model (available from session 2 onward — founding session seeds it)
  useEffect(() => {
    if (!user?.id || sessionCount < 1) return
    let cancelled = false
    getVoiceModel(user.id).then(async (vm) => {
      if (cancelled) return
      if (vm) { setVoiceModel(vm); return }
      const intake = user.user_metadata?.intake_answers
      if (intake) {
        try {
          const seeded = mapAnswersToVoiceModel(intake)
          await upsertVoiceModel(user.id!, seeded, sessionCount)
          if (!cancelled) setVoiceModel(seeded)
        } catch (err) {
          if (__DEV__) console.error('Failed to seed voice model:', err)
        }
      }
    }).catch(err => { if (__DEV__) console.error('Voice model load failed:', err) })
    return () => { cancelled = true }
  }, [user?.id, sessionCount])

  // Auto-start session on mount (or restore from checkpoint / resumeSessionId)
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !user?.id) return
    startedRef.current = true

    // Direct resume: home screen passed a specific session ID to continue
    if (params.resumeSessionId) {
      restoreSession(params.resumeSessionId)
      return
    }

    // Checkpoint restore or new session
    loadCheckpoint(SESSION_KEY).then(async (cp) => {
      if (cp?.sessionId) {
        try {
          const [restored, ints] = await Promise.all([
            fetchSession(cp.sessionId),
            getSessionInteractions(cp.sessionId),
          ])
          if (restored && restored.status !== 'completed') {
            setSession(restored)
            setInteractions(ints)
            if (cp.feedbackText) setFeedbackText(cp.feedbackText)
            setPhase(cp.phase || 'responding')
            return
          }
        } catch (err) {
          if (__DEV__) console.error('Checkpoint restore failed:', err)
          clearCheckpoint(SESSION_KEY)
        }
      }
      startSession(params.promptType || 'reveal', params.promptText || '')
    })
  }, [user?.id])

  // Restore a session directly from DB (used by "Continue where you left off")
  async function restoreSession(sessionId: string) {
    try {
      const [restored, ints] = await Promise.all([
        fetchSession(sessionId),
        getSessionInteractions(sessionId),
      ])
      if (restored && restored.status !== 'completed') {
        setSession(restored)
        setInteractions(ints)
        // Determine phase from interactions: if there's a feedback interaction, show feedback
        const hasFeedback = ints.some((i: any) => i.interaction_type === 'feedback')
        const lastInteraction = ints[ints.length - 1]
        if (hasFeedback && lastInteraction?.role === 'assistant') {
          setFeedbackText(lastInteraction.content)
          setPhase('feedback')
        } else {
          setPhase('responding')
        }
        return
      }
      // Session was already completed — start a fresh one
      startSession(params.promptType || 'reveal', params.promptText || '')
    } catch (err) {
      if (__DEV__) console.error('Session resume failed:', err)
      startSession(params.promptType || 'reveal', params.promptText || '')
    }
  }

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!inputText.trim()) return
    submitResponse(inputText.trim())
    setInputText('')
  }, [inputText, submitResponse])

  // Handle marking → done → update streak, show drills popup

  // Split user messages into sentence chunks for marking
  function splitIntoChunks(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 10) // skip very short fragments
  }

  const handleGoToMarking = useCallback(async () => {
    // Extract user messages only, split into chunks
    const userMessages = interactions.filter(i => i.role === 'user')
    if (__DEV__) console.log('[handleGoToMarking] interactions:', interactions.length, 'userMessages:', userMessages.length)
    const allChunks = userMessages.flatMap(i => splitIntoChunks(i.content))
    if (__DEV__) console.log('[handleGoToMarking] chunks:', allChunks.length, allChunks.map(c => c.substring(0, 40)))
    setChunks(allChunks)
    setSelectedChunks(new Set())
    setAiPicks(new Set())
    setPhase('marking')

    // AI pre-suggest 1-2 strongest moments
    if (allChunks.length > 1) {
      try {
        const numbered = allChunks.map((c, i) => `${i}: ${c}`).join('\n')
        const result = await callClaude({
          systemPrompt: 'You are selecting the most expressive or insightful moments from a user\'s session. Return ONLY a JSON array of indices (e.g. [0, 3]). Pick 1-2 moments that show the strongest self-expression, insight, or vulnerability. No explanation.',
          messages: [{ role: 'user', content: numbered }],
          maxTokens: 50,
        })
        const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        const indices: number[] = JSON.parse(cleaned)
        const validIndices = indices.filter(i => i >= 0 && i < allChunks.length)
        setAiPicks(new Set(validIndices))
        setSelectedChunks(new Set(validIndices)) // pre-select AI picks
      } catch (err) {
        if (__DEV__) console.error('AI pick suggestion failed:', err)
      }
    }

    // Build drill rationales for the post-session modal
    if (suggestedDrills && suggestedDrills.length > 0 && user?.id) {
      try {
        const userPatterns = await getPatterns(user.id)
        const weaknesses = userPatterns.filter(p => p.pattern_type === 'weakness' && p.status === 'active')
        const drillToWeakness: Record<string, string> = {}
        for (const [weaknessId, drillId] of Object.entries(WEAKNESS_TO_DRILL)) {
          drillToWeakness[drillId as string] = weaknessId
        }
        const rationales: Record<string, string> = {}
        for (const drillId of suggestedDrills) {
          const weaknessId = drillToWeakness[drillId]
          if (weaknessId) {
            const match = weaknesses.find(w => w.pattern_id === weaknessId)
            if (match) {
              rationales[drillId] = `Targets your ${weaknessId.replace(/-/g, ' ')} pattern`
            }
          }
        }
        setDrillRationales(rationales)
      } catch (err) {
        if (__DEV__) console.error('Failed to build drill rationales:', err)
      }
    }
  }, [interactions, suggestedDrills, user?.id])

  const toggleChunk = useCallback((index: number) => {
    setSelectedChunks(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const handleSaveAndDone = useCallback(async () => {
    const selected = Array.from(selectedChunks).map(i => chunks[i]).filter(Boolean)
    if (__DEV__) console.log('[handleSaveAndDone] selectedChunks:', Array.from(selectedChunks), 'resolved texts:', selected.length)
    if (selected.length > 0) {
      await markMoments(selected)
    }
    if (user?.id) {
      try { await updateStreak(user.id) } catch (err) { if (__DEV__) console.error('Streak update failed:', err) }
    }
    await completeSession()
  }, [user?.id, selectedChunks, chunks, markMoments, completeSession])

  const handleFinishNoMarking = useCallback(async () => {
    if (user?.id) {
      try { await updateStreak(user.id) } catch (err) { if (__DEV__) console.error('Streak update failed:', err) }
    }
    await completeSession()
  }, [user?.id, completeSession])

  const handleExit = useCallback(() => {
    if (phase === 'done') { router.back(); return }
    Alert.alert(
      'Leave session?',
      'Your responses are saved. You can start a new session anytime.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: () => router.back() },
      ],
    )
  }, [phase])

  // ── Responding Phase ─────────────────────────

  if (phase === 'prompt' || phase === 'responding') {
    return (
      <ErrorBoundary fallbackMessage="Something went wrong.">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScreenContainer scroll>
            <TouchableOpacity style={styles.closeButton} onPress={handleExit}>
              <Ionicons name="close" size={24} color={colors.inkMuted} />
            </TouchableOpacity>

            {/* Prompt */}
            <Text style={styles.prompt}>
              {session?.prompt_text || params.promptText}
            </Text>

            {/* Conversation history */}
            {interactions.length > 0 && (
              <View style={styles.conversationHistory}>
                {interactions.map((i) => (
                  <View key={i.id} style={[
                    styles.messageBubble,
                    i.role === 'user' ? styles.userBubble : styles.aiBubble,
                  ]}>
                    <Text style={[
                      styles.messageText,
                      i.role === 'assistant' && styles.aiMessageText,
                    ]}>
                      {i.content}
                    </Text>
                  </View>
                ))}
                {feedbackLoading && (
                  <ActivityIndicator style={{ marginTop: 12 }} color={colors.inkGhost} />
                )}
              </View>
            )}

            {/* Input area */}
            {!feedbackLoading && (
              <View style={styles.inputArea}>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Start speaking your mind..."
                  placeholderTextColor={colors.inkGhost}
                  multiline
                  textAlignVertical="top"
                />

                {/* Action buttons */}
                <View style={styles.inputActions}>
                  <Button
                    onPress={handleSubmit}
                    disabled={!inputText.trim()}
                  >
                    {interactions.length > 0 ? 'Next →' : 'Submit'}
                  </Button>
                </View>
              </View>
            )}

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </ScreenContainer>
        </KeyboardAvoidingView>
      </ErrorBoundary>
    )
  }

  // ── Feedback Phase ───────────────────────────

  if (phase === 'feedback') {
    return (
      <ErrorBoundary fallbackMessage="Something went wrong.">
        <ScreenContainer scroll>
          <TouchableOpacity style={styles.closeButton} onPress={handleExit}>
            <Ionicons name="close" size={24} color={colors.inkMuted} />
          </TouchableOpacity>

          <Text style={styles.prompt}>
            {session?.prompt_text || params.promptText}
          </Text>

          <Card>
            {feedbackLoading ? (
              <ActivityIndicator color={colors.inkGhost} />
            ) : (
              <Text style={styles.feedbackText}>{feedbackText}</Text>
            )}
          </Card>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {!feedbackLoading && (
            <View style={styles.actions}>
              <Button variant="secondary" onPress={tryAgain}>
                Refine my response
              </Button>
              <Button onPress={handleGoToMarking}>
                Continue
              </Button>
            </View>
          )}
        </ScreenContainer>
      </ErrorBoundary>
    )
  }

  // ── Marking Phase (select moments to save to library) ──

  if (phase === 'marking') {
    return (
      <ErrorBoundary fallbackMessage="Something went wrong.">
        <ScreenContainer scroll>
          <TouchableOpacity style={styles.closeButton} onPress={handleExit}>
            <Ionicons name="close" size={24} color={colors.inkMuted} />
          </TouchableOpacity>

          <Text style={styles.markingTitle}>Mark your moments</Text>
          <Text style={styles.markingSubtitle}>
            Tap any lines that resonated. These go to your library.
          </Text>

          {chunks.length === 0 && (
            <Text style={styles.markingSubtitle}>No moments to select.</Text>
          )}

          {chunks.map((chunk, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.chunkCard,
                selectedChunks.has(index) && styles.chunkCardSelected,
              ]}
              onPress={() => toggleChunk(index)}
              activeOpacity={0.7}
            >
              <View style={styles.chunkRow}>
                <Text style={[
                  styles.chunkText,
                  selectedChunks.has(index) && styles.chunkTextSelected,
                ]}>
                  {chunk}
                </Text>
                {aiPicks.has(index) && (
                  <Text style={styles.crispPick}>Crisp pick</Text>
                )}
              </View>
              {selectedChunks.has(index) && (
                <Ionicons name="checkmark-circle" size={18} color={colors.gold} style={{ marginTop: 4 }} />
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.actions}>
            <Button variant="secondary" onPress={handleFinishNoMarking}>
              Done
            </Button>
            {selectedChunks.size > 0 && (
              <Button onPress={handleSaveAndDone}>
                Save {selectedChunks.size} moment{selectedChunks.size > 1 ? 's' : ''}
              </Button>
            )}
          </View>
        </ScreenContainer>
      </ErrorBoundary>
    )
  }

  // ── Done Phase (single screen: complete + suggested drills + done) ───

  if (phase === 'done') {
    return (
      <ErrorBoundary fallbackMessage="Something went wrong.">
        <ScreenContainer scroll>
          <View style={styles.doneHeader}>
            <Text style={styles.doneTitle}>Session complete</Text>
            {streak && (
              <Text style={styles.streakText}>{streak.current_streak} day streak</Text>
            )}
          </View>

          {suggestedDrills && suggestedDrills.length > 0 && (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedTitle}>SUGGESTED WORKOUTS</Text>
              <Text style={styles.suggestedSubtitle}>Based on this session</Text>

              {suggestedDrills.map(drillId => {
                const drill = getDrillById(drillId)
                if (!drill) return null
                return (
                  <TouchableOpacity
                    key={drill.id}
                    style={styles.drillCard}
                    onPress={() => {
                      router.replace({ pathname: '/(tabs)/workouts', params: { drillId: drill.id } })
                    }}
                  >
                    <Text style={styles.drillName}>{drill.name}</Text>
                    {drillRationales[drill.id] && (
                      <Text style={styles.drillRationale}>{drillRationales[drill.id]}</Text>
                    )}
                    <Text style={styles.drillMeta}>{drill.category} · {drill.difficulty}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          <Button onPress={() => router.back()} style={{ marginTop: 32 }}>
            Done
          </Button>
        </ScreenContainer>
      </ErrorBoundary>
    )
  }

  // Fallback
  return (
    <ScreenContainer>
      <ActivityIndicator color={colors.inkGhost} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 8,
  },
  prompt: {
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 28,
    color: colors.ink,
    marginBottom: 24,
  },
  conversationHistory: {
    gap: 12,
    marginBottom: 24,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: colors.paperDim,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  aiBubble: {
    backgroundColor: colors.paperDeep,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  aiMessageText: {
    fontStyle: 'italic',
  },
  inputArea: {
    gap: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.inkGhost,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 120,
    maxHeight: 240,
  },
  inputActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  actions: {
    gap: 8,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#D94A4A',
    marginTop: 8,
  },
  doneHeader: {
    alignItems: 'center',
    paddingTop: 48,
    marginBottom: 32,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.ink,
  },
  streakText: {
    fontSize: 16,
    color: colors.inkMuted,
    marginTop: 8,
  },
  suggestedSection: {
    marginTop: 8,
  },
  suggestedTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.inkGhost,
    marginBottom: 4,
  },
  suggestedSubtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 16,
  },
  drillCard: {
    backgroundColor: colors.paperDim,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  markingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 8,
  },
  markingSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  drillName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
  },
  drillRationale: {
    fontSize: 13,
    color: colors.gold,
    fontStyle: 'italic' as const,
    marginTop: 2,
  },
  drillMeta: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 4,
  },
  chunkCard: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chunkCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.paperDeep,
  },
  chunkRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  chunkText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    flex: 1,
  },
  chunkTextSelected: {
    fontWeight: '500' as const,
  },
  crispPick: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.gold,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
})
