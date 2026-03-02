import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { useSession } from '../../src/hooks/useSession'
import { getPersonalizedPrompts, mapAnswersToVoiceModel } from '../../src/lib/intakeMapping'
import { FOUNDING_PROMPT, VOICE_MODEL_UPDATE_PROMPT } from '../../src/lib/prompts'
import { updateStreak, getVoiceModel, upsertVoiceModel } from '../../src/lib/storage'
import { callClaude } from '../../src/lib/claude'
import { colors } from '../../src/lib/theme'

export default function FoundingSessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { answers: answersJson } = useLocalSearchParams<{ answers: string }>()
  const intakeAnswers = answersJson ? JSON.parse(answersJson) : null

  const [inputText, setInputText] = useState('')
  const startedRef = useRef(false)

  const foundingPrompt = useMemo(() => {
    if (intakeAnswers) {
      const personalized = getPersonalizedPrompts(intakeAnswers)
      if (personalized?.[0]) return personalized[0]
    }
    return { promptType: 'founding', promptText: FOUNDING_PROMPT }
  }, [intakeAnswers])

  const {
    phase, session, interactions, feedbackText, feedbackLoading, error,
    startSession, submitResponse, diveDeeper, tryAgain, completeSession,
  } = useSession({
    userId: user?.id || '',
    sessionCount: 0,
    voiceModel: null,
    patterns: [],
    focusMode: 'mixed',
  })

  useEffect(() => {
    if (startedRef.current || !user) return
    startedRef.current = true
    startSession(foundingPrompt.promptType, foundingPrompt.promptText)
  }, [user])

  const handleSubmit = useCallback(() => {
    if (!inputText.trim()) return
    submitResponse(inputText.trim())
    setInputText('')
  }, [inputText, submitResponse])

  const handleDiveDeeper = useCallback(() => {
    if (!inputText.trim()) return
    diveDeeper(inputText.trim())
    setInputText('')
  }, [inputText, diveDeeper])

  const handleDone = useCallback(async () => {
    try { await updateStreak(user?.id) } catch {}

    // Seed voice model from intake answers
    try {
      const intakeFields = intakeAnswers ? mapAnswersToVoiceModel(intakeAnswers) : {}
      const currentModel = { ...intakeFields, ...(await getVoiceModel(user?.id) || {}) }
      const lastInteraction = interactions.filter(i => i.role === 'user').pop()
      const result = await callClaude({
        model: 'claude-sonnet-4-6',
        maxTokens: 3000,
        systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
        messages: [{
          role: 'user',
          content: `CURRENT VOICE MODEL:\n${JSON.stringify(currentModel, null, 2)}\n\nSESSION DATA:\nMode: daily\nSession Number: 1\nPrompt Type: ${foundingPrompt.promptType}\nPrompt: ${foundingPrompt.promptText}\nUser Response: ${lastInteraction?.content || ''}\nAI Feedback: ${feedbackText || ''}\n\nUpdate the voice model. Return only updated JSON.`,
        }],
      })
      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const updatedModel = JSON.parse(cleaned)
      await upsertVoiceModel(user?.id, updatedModel, 1)
    } catch (err) {
      if (__DEV__) console.error('Voice model update:', err)
    }

    await completeSession()
    router.replace('/(onboarding)/paywall')
  }, [completeSession, interactions, feedbackText, user, intakeAnswers, foundingPrompt])

  // --- Responding phase ---
  if (phase === 'prompt' || phase === 'responding') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.prompt}>{foundingPrompt.promptText}</Text>

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

          {!feedbackLoading && (
            <>
              <TextInput
                style={styles.textArea}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Start anywhere..."
                placeholderTextColor={colors.inkGhost}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.buttonRow}>
                {interactions.length > 0 && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleDiveDeeper}
                    disabled={!inputText.trim()}
                  >
                    <Text style={[styles.secondaryButtonText, !inputText.trim() && { opacity: 0.4 }]}>
                      Dive Deeper
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.button, !inputText.trim() && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={!inputText.trim()}
                >
                  <Text style={styles.buttonText}>
                    {interactions.length > 0 ? 'Next →' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // --- Feedback phase ---
  if (phase === 'feedback') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.prompt}>{foundingPrompt.promptText}</Text>
        <View style={styles.feedbackCard}>
          {feedbackLoading ? (
            <ActivityIndicator color={colors.inkGhost} />
          ) : (
            <Text style={styles.feedbackText}>{feedbackText}</Text>
          )}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {!feedbackLoading && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={tryAgain}>
              <Text style={styles.secondaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleDone}>
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    )
  }

  // --- Done phase ---
  if (phase === 'done') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.closedTitle}>Session 1 complete.</Text>
        <Text style={styles.closedSubtitle}>Welcome to CRISP.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(onboarding)/paywall')}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Loading fallback
  return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator color={colors.inkGhost} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  prompt: {
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 28,
    color: colors.ink,
    marginBottom: 32,
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
    alignSelf: 'flex-end' as const,
    maxWidth: '85%',
  },
  aiBubble: {
    backgroundColor: colors.paperDeep,
    alignSelf: 'flex-start' as const,
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
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 160,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.inkMuted,
    fontSize: 14,
  },
  feedbackCard: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  actions: {
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D94A4A',
    marginTop: 8,
  },
  closedTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  closedSubtitle: {
    fontSize: 16,
    color: colors.inkMuted,
    marginBottom: 40,
  },
})
