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
import parseFeedback from '../../src/lib/parseFeedback'
import { colors } from '../../src/lib/theme'

export default function FoundingSessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { answers: answersJson } = useLocalSearchParams<{ answers: string }>()
  const intakeAnswers = answersJson ? JSON.parse(answersJson) : null

  const [responseText, setResponseText] = useState('')
  const [deepDiveText, setDeepDiveText] = useState('')
  const [openQuestion, setOpenQuestion] = useState('')
  const startedRef = useRef(false)

  const foundingPrompt = useMemo(() => {
    if (intakeAnswers) {
      const personalized = getPersonalizedPrompts(intakeAnswers)
      if (personalized?.[0]) return personalized[0]
    }
    return { promptType: 'founding', promptText: FOUNDING_PROMPT }
  }, [intakeAnswers])

  const {
    session, phase, feedback, feedbackStreaming, error,
    deepDiveCount, submitResponse, goDeeper, submitDeepDive,
    startMarking, completeMark, submitQuality, startSession,
  } = useSession({
    userId: user?.id,
    sessionCount: 0,
    onWeaknessDetected: null,
  })

  useEffect(() => {
    if (startedRef.current || !user) return
    startedRef.current = true
    startSession({ promptType: foundingPrompt.promptType, promptText: foundingPrompt.promptText })
  }, [user])

  const handleSubmit = useCallback(async () => {
    if (!responseText.trim()) return
    await submitResponse(responseText)
  }, [responseText, submitResponse])

  const handleDeepDiveSubmit = useCallback(async () => {
    if (!deepDiveText.trim()) return
    await submitDeepDive(deepDiveText)
    setDeepDiveText('')
  }, [deepDiveText, submitDeepDive])

  const handleGoDeeper = useCallback((question: string) => {
    setOpenQuestion(question)
    goDeeper(question)
  }, [goDeeper])

  const handleQualityAndClose = useCallback(async (signal: string) => {
    await submitQuality(signal)

    try { await updateStreak(user?.id) } catch (err) {
      if (__DEV__) console.error('updateStreak:', err)
    }

    // Voice model update with intake seeding
    try {
      const intakeFields = intakeAnswers ? mapAnswersToVoiceModel(intakeAnswers) : {}
      const currentModel = { ...intakeFields, ...(await getVoiceModel(user?.id) || {}) }
      const parts = parseFeedback(feedback)
      const result = await callClaude({
        model: 'claude-sonnet-4-6',
        maxTokens: 3000,
        systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
        messages: [{
          role: 'user',
          content: `CURRENT VOICE MODEL:\n${JSON.stringify(currentModel, null, 2)}\n\nSESSION DATA:\nMode: daily\nSession Number: 1\nPrompt Type: ${foundingPrompt.promptType}\nPrompt: ${foundingPrompt.promptText}\nUser Response: ${responseText}\nAI Echo: ${parts.echo}\nAI Name: ${parts.name}\nDrill Prompt: none\nDrill Response: skipped\nAI Open: ${parts.open}\nQuality Signal: ${signal}\n\nUpdate the voice model. Return only updated JSON.`,
        }],
      })
      const updatedModel = JSON.parse(result)
      await upsertVoiceModel(user?.id, updatedModel, 1)
    } catch (err) {
      if (__DEV__) console.error('Voice model update:', err)
    }

    // Route to paywall after founding session
    router.replace('/(onboarding)/paywall')
  }, [submitQuality, feedback, user, intakeAnswers, foundingPrompt, responseText])

  const feedbackParts = feedback ? parseFeedback(feedback) : null

  // --- Phase: Responding (initial) ---
  if (phase === 'responding' && !openQuestion) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.prompt}>{foundingPrompt.promptText}</Text>
          <TextInput
            style={styles.textArea}
            value={responseText}
            onChangeText={setResponseText}
            placeholder="Start anywhere..."
            placeholderTextColor={colors.inkGhost}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, !responseText.trim() && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!responseText.trim()}
          >
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // --- Phase: Responding (deep dive) ---
  if (phase === 'responding' && openQuestion) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.prompt}>{openQuestion}</Text>
          <TextInput
            style={styles.textArea}
            value={deepDiveText}
            onChangeText={setDeepDiveText}
            placeholder="Start anywhere..."
            placeholderTextColor={colors.inkGhost}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, !deepDiveText.trim() && styles.buttonDisabled]}
            onPress={handleDeepDiveSubmit}
            disabled={!deepDiveText.trim()}
          >
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // --- Phase: Thinking ---
  if (phase === 'thinking') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.inkGhost} />
        <Text style={styles.thinkingText}>Thinking...</Text>
      </View>
    )
  }

  // --- Phase: Feedback ---
  if (phase === 'feedback') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.prompt}>{openQuestion || foundingPrompt.promptText}</Text>
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackText}>
            {feedback || ''}
          </Text>
          {feedbackStreaming && <ActivityIndicator style={{ marginTop: 8 }} color={colors.inkGhost} />}
        </View>
        {!feedbackStreaming && (
          <View style={styles.actions}>
            {deepDiveCount < 10 && feedbackParts?.open && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => handleGoDeeper(feedbackParts.open)}
              >
                <Text style={styles.secondaryButtonText}>Go deeper →</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.button} onPress={startMarking}>
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    )
  }

  // --- Phase: Marking (skip for founding — go straight to quality) ---
  if (phase === 'marking') {
    // For founding session, auto-advance through marking
    completeMark('')
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.inkGhost} />
      </View>
    )
  }

  // --- Phase: Quality ---
  if (phase === 'quality') {
    const signals = [
      { id: 'breakthrough', label: 'Breakthrough — I said something new' },
      { id: 'solid', label: 'Solid — good practice' },
      { id: 'struggled', label: 'Struggled — felt stuck' },
      { id: 'off', label: "Off — wasn't feeling it" },
    ]
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.qualityTitle}>How was that?</Text>
        <View style={styles.qualityOptions}>
          {signals.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.qualityOption}
              onPress={() => handleQualityAndClose(s.id)}
            >
              <Text style={styles.qualityText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  // --- Phase: Closed ---
  if (phase === 'closed') {
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

  // Loading / fallback
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
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 160,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
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
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: colors.inkMuted,
    fontSize: 14,
  },
  thinkingText: {
    fontSize: 14,
    color: colors.inkGhost,
    marginTop: 12,
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
  qualityTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 32,
  },
  qualityOptions: {
    width: '100%',
    gap: 12,
  },
  qualityOption: {
    backgroundColor: colors.paperDim,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  qualityText: {
    fontSize: 15,
    color: colors.ink,
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
