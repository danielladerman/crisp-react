import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../src/hooks/useAuth'
import { useSession } from '../src/hooks/useSession'
import { useStreak } from '../src/hooks/useStreak'
import { useWeaknessSRS } from '../src/hooks/useWeaknessSRS'
import { updateSession, getVoiceModel, upsertVoiceModel } from '../src/lib/storage'
import { callClaude } from '../src/lib/claude'
import { VOICE_MODEL_UPDATE_PROMPT } from '../src/lib/prompts'
import { getDrillForWeakness } from '../src/lib/drills'
import parseFeedback from '../src/lib/parseFeedback'
import { colors } from '../src/lib/theme'

export default function SessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    promptType: string
    promptText: string
    sessionCount: string
    checkpointId?: string
  }>()

  const promptType = params.promptType || 'reveal'
  const promptText = params.promptText || ''
  const sessionCount = parseInt(params.sessionCount || '0', 10)
  const sessionNumber = sessionCount + 1

  const { streak, recordPractice } = useStreak(user?.id)
  const { weaknesses, recordDetection } = useWeaknessSRS(user?.id)
  const [detectedWeaknessId, setDetectedWeaknessId] = useState<string | null>(null)

  const handleWeaknessDetected = useCallback((weaknessId: string) => {
    setDetectedWeaknessId(weaknessId)
    recordDetection(weaknessId)
  }, [recordDetection])

  const {
    session, phase, feedback, feedbackStreaming, error,
    deepDiveCount, drillText,
    submitDrill, skipDrill,
    submitExplanation, skipExplanation, submitQuality,
    startSession, submitResponse, goDeeper, submitDeepDive,
    startMarking, completeMark,
    restoreFromCheckpoint, setSession,
  } = useSession({
    userId: user?.id,
    sessionCount,
    onWeaknessDetected: handleWeaknessDetected,
  })

  const [responseText, setResponseText] = useState('')
  const [deepDiveText, setDeepDiveText] = useState('')
  const [openQuestion, setOpenQuestion] = useState('')
  const [started, setStarted] = useState(false)
  const [drillResponse, setDrillResponse] = useState('')
  const [markText, setMarkText] = useState('')
  const [markExplanation, setMarkExplanation] = useState('')

  useEffect(() => {
    if (started || !user) return
    startSession({ promptType, promptText })
    setStarted(true)
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

    try { await recordPractice() } catch {}

    // Voice model update
    const shouldUpdate = sessionNumber <= 20 || sessionNumber % 3 === 0
    if (shouldUpdate) {
      try {
        const currentModel = await getVoiceModel(user?.id) || {}
        const parts = parseFeedback(feedback)
        const result = await callClaude({
          model: 'claude-sonnet-4-6',
          maxTokens: 3000,
          systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
          messages: [{
            role: 'user',
            content: `CURRENT VOICE MODEL:\n${JSON.stringify(currentModel, null, 2)}\n\nSESSION DATA:\nMode: daily\nSession Number: ${sessionNumber}\nPrompt Type: ${promptType}\nPrompt: ${promptText}\nUser Response: ${responseText}\nAI Echo: ${parts.echo}\nAI Name: ${parts.name}\nDrill Prompt: ${parts.drill || 'none'}\nDrill Response: ${drillResponse || 'skipped'}\nAI Open: ${parts.open}\nQuality Signal: ${signal}\n\nUpdate the voice model. Return only updated JSON.`,
          }],
        })
        const updatedModel = JSON.parse(result)
        await upsertVoiceModel(user?.id, updatedModel, sessionNumber)
      } catch {}
    }
  }, [submitQuality, feedback, user, promptType, promptText, sessionNumber, responseText, drillResponse, recordPractice])

  const handleClose = useCallback(() => {
    router.back()
  }, [])

  const handleExit = useCallback(() => {
    if (phase === 'responding' && responseText.length > 0) {
      Alert.alert('Leave this session?', 'Your response so far has been saved.', [
        { text: 'Continue session', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: handleClose },
      ])
    } else {
      handleClose()
    }
  }, [phase, responseText, handleClose])

  const feedbackParts = feedback ? parseFeedback(feedback) : null

  // --- Phase: Responding (initial) ---
  if (phase === 'responding' && !openQuestion) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={handleExit}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.prompt}>{promptText}</Text>
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.exchangeCount}>Exchange {deepDiveCount + 1} of 10</Text>
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
        <Text style={styles.prompt}>{openQuestion || promptText}</Text>
        <ActivityIndicator color={colors.inkGhost} style={{ marginTop: 32 }} />
        <Text style={styles.thinkingText}>Thinking...</Text>
      </View>
    )
  }

  // --- Phase: Feedback ---
  if (phase === 'feedback') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.prompt}>{openQuestion || promptText}</Text>
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackText}>{feedback || ''}</Text>
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

  // --- Phase: Marking ---
  if (phase === 'marking') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.markTitle}>Mark a moment</Text>
          <Text style={styles.markSubtitle}>
            Was there a sentence or phrase from your response that felt especially true?
          </Text>
          <TextInput
            style={styles.textArea}
            value={markText}
            onChangeText={setMarkText}
            placeholder="Paste or type the moment..."
            placeholderTextColor={colors.inkGhost}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, !markText.trim() && styles.buttonDisabled]}
              onPress={() => completeMark(markText)}
              disabled={!markText.trim()}
            >
              <Text style={styles.buttonText}>Mark it</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => completeMark('')}>
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // --- Phase: Drilling ---
  if (phase === 'drilling') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.markTitle}>Micro Drill</Text>
          <Text style={styles.drillPrompt}>{drillText}</Text>
          <TextInput
            style={styles.textArea}
            value={drillResponse}
            onChangeText={setDrillResponse}
            placeholder="Your response..."
            placeholderTextColor={colors.inkGhost}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, !drillResponse.trim() && styles.buttonDisabled]}
              onPress={() => submitDrill(drillResponse)}
              disabled={!drillResponse.trim()}
            >
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={skipDrill}>
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
        <Text style={styles.closedTitle}>Session {sessionNumber} complete.</Text>
        <Text style={styles.closedStreak}>
          {streak?.current_streak ? `${streak.current_streak} day streak` : ''}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleClose}>
          <Text style={styles.buttonText}>Home</Text>
        </TouchableOpacity>
      </View>
    )
  }

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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backText: {
    fontSize: 14,
    color: colors.inkGhost,
    marginBottom: 24,
  },
  exchangeCount: {
    fontSize: 14,
    color: colors.inkGhost,
    marginBottom: 16,
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
    paddingHorizontal: 32,
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
  markTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  markSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  drillPrompt: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
    color: colors.ink,
    marginBottom: 24,
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
  closedStreak: {
    fontSize: 14,
    color: colors.gold,
    marginBottom: 40,
  },
})
