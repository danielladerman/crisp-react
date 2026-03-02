// app/session.tsx — Rebuilt session screen (3-phase: responding → feedback → done)
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../src/hooks/useAuth'
import { useSession } from '../src/hooks/useSession'
import { useStreak } from '../src/hooks/useStreak'
import { usePatterns } from '../src/hooks/usePatterns'
import { useVoiceRecorder } from '../src/hooks/useVoiceRecorder'
import { useTranscription } from '../src/hooks/useTranscription'
import { ScreenContainer, Button, Card, ErrorBoundary } from '../src/components/ui'
import { getVoiceModel, upsertVoiceModel, updateStreak } from '../src/lib/storage'
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

  // Voice recording
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder()
  const { transcribe, transcribing } = useTranscription()

  // Session hook
  const {
    phase, session, interactions, feedbackText, feedbackLoading,
    suggestedDrills, error,
    startSession, submitResponse, diveDeeper, tryAgain, completeSession,
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

  // Auto-start session on mount
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !user?.id) return
    startedRef.current = true
    startSession(params.promptType || 'reveal', params.promptText || '')
  }, [user?.id])

  // Handle voice recording stop → transcription
  const handleStopRecording = useCallback(async () => {
    const uri = await stopRecording()
    if (!uri) return
    try {
      const text = await transcribe(uri)
      setInputText(prev => prev ? `${prev}\n\n${text}` : text)
    } catch (err) {
      if (__DEV__) console.error('Transcription failed:', err)
    }
  }, [stopRecording, transcribe])

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
      try { await updateStreak(user.id) } catch {}
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

  // Format recording duration
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Responding Phase ─────────────────────────

  if (phase === 'prompt' || phase === 'responding') {
    return (
      <ErrorBoundary fallbackMessage="Something went wrong.">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScreenContainer scroll>
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

                {/* Recording indicator */}
                {isRecording && (
                  <View style={styles.recordingBar}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording {formatDuration(duration)}</Text>
                    <TouchableOpacity onPress={cancelRecording}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {transcribing && (
                  <View style={styles.recordingBar}>
                    <ActivityIndicator size="small" color={colors.ink} />
                    <Text style={styles.recordingText}>Transcribing...</Text>
                  </View>
                )}

                {/* Action buttons */}
                <View style={styles.inputActions}>
                  {/* Mic button */}
                  <TouchableOpacity
                    style={styles.micButton}
                    onPress={isRecording ? handleStopRecording : startRecording}
                    disabled={transcribing}
                  >
                    <Ionicons
                      name={isRecording ? 'stop-circle' : 'mic-outline'}
                      size={24}
                      color={isRecording ? colors.recording : colors.ink}
                    />
                  </TouchableOpacity>

                  <View style={styles.inputButtonGroup}>
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
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D94A4A',
  },
  recordingText: {
    fontSize: 14,
    color: colors.inkMuted,
    flex: 1,
  },
  cancelText: {
    fontSize: 14,
    color: colors.inkMuted,
    textDecorationLine: 'underline',
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.inkGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputButtonGroup: {
    flex: 1,
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
