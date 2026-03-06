// app/session.tsx — Rebuilt session screen (3-phase: responding → feedback → done)
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../src/hooks/useAuth'
import { useSession } from '../src/hooks/useSession'
import { useStreak } from '../src/hooks/useStreak'
import { usePatterns } from '../src/hooks/usePatterns'
import { ScreenContainer, Button, Card, ErrorBoundary } from '../src/components/ui'
import { getVoiceModel, upsertVoiceModel, updateStreak, getSession as fetchSession, getSessionInteractions } from '../src/lib/storage'
import { loadCheckpoint, clearCheckpoint, SESSION_KEY } from '../src/lib/sessionCheckpoint'
import { mapAnswersToVoiceModel } from '../src/lib/intakeMapping'
import { getDrillById } from '../src/lib/drills'
import { colors, spacing } from '../src/lib/theme'

export default function SessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    promptType: string
    promptText: string
    sessionCount: string
    focusMode?: string
  }>()

  const sessionCount = parseInt(params.sessionCount || '0', 10)
  const focusMode = params.focusMode || 'mixed'
  const { streak, recordPractice } = useStreak(user?.id)
  const { patterns } = usePatterns(user?.id)
  const [voiceModel, setVoiceModel] = useState<unknown>(null)

  // Session hook
  const {
    phase, session, interactions, feedbackText, feedbackLoading,
    suggestedDrills, error,
    startSession, submitResponse, diveDeeper, tryAgain, completeSession,
    setPhase, setSession, setInteractions, setFeedbackText,
  } = useSession({ userId: user?.id || '', sessionCount, voiceModel, patterns, focusMode })

  // Local state for text input
  const [inputText, setInputText] = useState('')
  const [showDrillsModal, setShowDrillsModal] = useState(false)

  // Load voice model
  useEffect(() => {
    if (!user?.id || sessionCount < 5) return
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

  // Auto-start session on mount (or restore from checkpoint)
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !user?.id) return
    startedRef.current = true

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

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!inputText.trim()) return
    submitResponse(inputText.trim())
    setInputText('')
  }, [inputText, submitResponse])

  // Handle dive deeper
  const handleDiveDeeper = useCallback(() => {
    if (!inputText.trim()) return
    diveDeeper(inputText.trim())
    setInputText('')
  }, [inputText, diveDeeper])

  // Handle done → update streak, show drills popup
  const handleDone = useCallback(async () => {
    if (user?.id) {
      try { await updateStreak(user.id) } catch (err) { if (__DEV__) console.error('Streak update failed:', err) }
    }
    await completeSession()
    if (suggestedDrills && suggestedDrills.length > 0) {
      setShowDrillsModal(true)
    } else {
      router.back()
    }
  }, [user?.id, completeSession, suggestedDrills])

  const handleDrillModalClose = useCallback(() => {
    setShowDrillsModal(false)
    router.back()
  }, [])

  const handleExit = useCallback(() => {
    if (phase === 'done') { router.back(); return }
    Alert.alert(
      'Leave session?',
      'Your responses are saved. You can start a new session anytime.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
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
                  {interactions.length > 0 && (
                    <Button
                      variant="secondary"
                      onPress={handleDiveDeeper}
                      disabled={!inputText.trim()}
                    >
                      Dive Deeper
                    </Button>
                  )}
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
                Try Again
              </Button>
              <Button onPress={handleDone}>
                Done
              </Button>
            </View>
          )}
        </ScreenContainer>
      </ErrorBoundary>
    )
  }

  // ── Done Phase (brief, then navigate home) ───

  if (phase === 'done') {
    return (
      <ErrorBoundary fallbackMessage="Something went wrong.">
        <ScreenContainer>
          <View style={styles.doneContainer}>
            <Text style={styles.doneTitle}>Session complete</Text>
            {streak && (
              <Text style={styles.streakText}>{streak.current_streak} day streak</Text>
            )}
            <Button onPress={() => router.back()} style={{ marginTop: 24 }}>
              Home
            </Button>
          </View>
        </ScreenContainer>

        {/* Suggested Drills Modal */}
        <Modal
          visible={showDrillsModal}
          transparent
          animationType="slide"
          onRequestClose={handleDrillModalClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Suggested Workouts</Text>
              <Text style={styles.modalSubtitle}>Based on this session</Text>

              {suggestedDrills?.map(drillId => {
                const drill = getDrillById(drillId)
                if (!drill) return null
                return (
                  <TouchableOpacity
                    key={drill.id}
                    style={styles.drillCard}
                    onPress={() => {
                      setShowDrillsModal(false)
                      router.replace('/(tabs)/workouts')
                    }}
                  >
                    <Text style={styles.drillName}>{drill.name}</Text>
                    <Text style={styles.drillMeta}>{drill.category} · {drill.difficulty}</Text>
                  </TouchableOpacity>
                )
              })}

              <Button variant="secondary" onPress={handleDrillModalClose} style={{ marginTop: 16 }}>
                Skip
              </Button>
            </View>
          </View>
        </Modal>
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
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  drillCard: {
    backgroundColor: colors.paperDim,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  drillName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
  },
  drillMeta: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 4,
  },
})
