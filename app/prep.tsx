// app/prep.tsx — Prep session: conversational practice partner
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../src/hooks/useAuth'
import { useStreak } from '../src/hooks/useStreak'
import { usePatterns } from '../src/hooks/usePatterns'
import { useVoiceRecorder } from '../src/hooks/useVoiceRecorder'
import { useTranscription } from '../src/hooks/useTranscription'
import {
  createSession, updateSession, addInteraction, getVoiceModel, upsertVoiceModel,
  getSessionCount, updateStreak,
} from '../src/lib/storage'
import { callClaudeWithCallbacks, callClaude } from '../src/lib/claude'
import {
  PREP_COACHING_PROMPT, PREP_SCENARIO_CATEGORIES,
  VOICE_MODEL_UPDATE_PROMPT, PATTERN_ANALYSIS_PROMPT,
} from '../src/lib/prompts'
import { getRecentInteractions, upsertPattern } from '../src/lib/storage'
import { colors, spacing } from '../src/lib/theme'
import type { Session, Interaction } from '../src/types/session'

type PrepPhase = 'select' | 'detail' | 'conversation' | 'done'

export default function PrepScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { patterns } = usePatterns(user?.id)
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder()
  const { transcribe, transcribing } = useTranscription()

  const [phase, setPhase] = useState<PrepPhase>('select')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [detailText, setDetailText] = useState('')
  const [inputText, setInputText] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  // Auto-scroll when interactions change
  useEffect(() => {
    if (interactions.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [interactions.length])

  // Build system prompt with voice model + patterns
  const buildPrepPrompt = useCallback(async () => {
    let prompt = PREP_COACHING_PROMPT

    if (user?.id) {
      try {
        const vm = await getVoiceModel(user.id)
        if (vm) prompt += `\n\nVOICE MODEL:\n${JSON.stringify(vm, null, 2)}`
      } catch {}
    }

    if (patterns && patterns.length > 0) {
      const patternSummary = patterns.map(p => `${p.pattern_type}: ${p.pattern_id} — ${p.description}`).join('\n')
      prompt += `\n\nKNOWN PATTERNS:\n${patternSummary}`
    }

    return prompt
  }, [user?.id, patterns])

  // Handle scenario selection
  const handleSelectCategory = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId)
    if (categoryId === 'custom') {
      setPhase('detail')
    } else {
      setPhase('detail')
    }
  }, [])

  // Start the prep session
  const handleStartPrep = useCallback(async () => {
    if (!user?.id) return
    const category = PREP_SCENARIO_CATEGORIES.find(c => c.id === selectedCategory)
    const scenarioDesc = detailText.trim() || category?.description || 'General practice'
    const promptText = `Prep: ${category?.label || 'Practice'} — ${scenarioDesc}`

    try {
      const count = await getSessionCount(user.id)
      const newSession = await createSession({
        userId: user.id,
        promptType: `prep:${selectedCategory}`,
        promptText,
      })
      setSession(newSession)
      setPhase('conversation')

      // AI opens the conversation based on the scenario
      setAiLoading(true)
      const systemPrompt = await buildPrepPrompt()

      await callClaudeWithCallbacks({
        systemPrompt,
        messages: [{
          role: 'user',
          content: `I'm preparing for: ${category?.label || 'something'}. ${scenarioDesc}\n\nStart the practice session. Ask me to begin or set the scene.`,
        }],
        onChunk: () => {},
        onDone: async (fullText) => {
          // Save the setup message as system context (not shown to user) and AI opener
          const aiInteraction = await addInteraction({
            sessionId: newSession.id,
            userId: user.id,
            role: 'assistant',
            content: fullText,
            interactionType: 'follow_up',
          })
          setInteractions([aiInteraction])
          setAiLoading(false)
        },
        onError: (err) => {
          setAiLoading(false)
          setError(err instanceof Error ? err.message : 'Failed to start prep')
        },
        maxTokens: 500,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    }
  }, [user?.id, selectedCategory, detailText, buildPrepPrompt])

  // Send a message in the conversation
  const handleSend = useCallback(async () => {
    if (!session || !user?.id || !inputText.trim()) return
    const text = inputText.trim()
    setInputText('')
    setError(null)

    try {
      const userInteraction = await addInteraction({
        sessionId: session.id,
        userId: user.id,
        role: 'user',
        content: text,
        interactionType: 'response',
      })

      const updatedInteractions = [...interactions, userInteraction]
      setInteractions(updatedInteractions)
      setAiLoading(true)

      const systemPrompt = await buildPrepPrompt()
      const messages = updatedInteractions.map(i => ({ role: i.role, content: i.content }))

      await callClaudeWithCallbacks({
        systemPrompt,
        messages,
        onChunk: () => {},
        onDone: async (fullText) => {
          const aiInteraction = await addInteraction({
            sessionId: session.id,
            userId: user.id,
            role: 'assistant',
            content: fullText,
            interactionType: 'follow_up',
          })
          setInteractions(prev => [...prev, aiInteraction])
          setAiLoading(false)
        },
        onError: (err) => {
          setAiLoading(false)
          setError(err instanceof Error ? err.message : 'AI response failed')
        },
        maxTokens: 1000,
      })
    } catch (err) {
      setAiLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to send message')
    }
  }, [session, user?.id, inputText, interactions, buildPrepPrompt])

  // Voice recording
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

  // End prep session
  const handleDone = useCallback(async () => {
    if (!session || !user?.id) {
      router.back()
      return
    }

    try {
      await updateSession(session.id, { status: 'completed' })
      try { await updateStreak(user.id) } catch {}
    } catch (err) {
      if (__DEV__) console.error('Failed to complete prep session:', err)
    }

    // Background: voice model + pattern analysis
    runBackgroundTasks(session, interactions)

    setPhase('done')
    setTimeout(() => router.back(), 1500)
  }, [session, user?.id, interactions])

  // Background tasks (non-blocking)
  async function runBackgroundTasks(sess: Session, ints: Interaction[]) {
    if (!user?.id) return

    // Pattern analysis
    try {
      const recentInts = await getRecentInteractions(user.id, 100)
      const context = recentInts.filter(i => i.role === 'user').map(i => i.content).join('\n---\n')
      const result = await callClaude({
        systemPrompt: PATTERN_ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: `Recent user responses across sessions:\n\n${context}` }],
        maxTokens: 1000,
      })
      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      if (parsed.patterns && Array.isArray(parsed.patterns)) {
        for (const p of parsed.patterns) {
          await upsertPattern(user.id, p, sess.id)
        }
      }
    } catch (err) {
      if (__DEV__) console.error('Pattern analysis failed:', err)
    }

    // Voice model update
    try {
      const currentModel = await getVoiceModel(user.id) || {}
      const count = await getSessionCount(user.id)
      const result = await callClaude({
        systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
        messages: [{
          role: 'user',
          content: `CURRENT VOICE MODEL:\n${JSON.stringify(currentModel, null, 2)}\n\nSESSION DATA:\nMode: prep\nPrompt: ${sess.prompt_text}\nSession Number: ${count}\n\nINTERACTIONS:\n${ints.map(i => `[${i.role}] ${i.content}`).join('\n\n')}\n\nUpdate the voice model. Return only updated JSON.`,
        }],
        maxTokens: 3000,
      })
      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const updatedModel = JSON.parse(cleaned)
      await upsertVoiceModel(user.id, updatedModel, count)
    } catch (err) {
      if (__DEV__) console.error('Voice model update failed:', err)
    }
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Scenario Selection ─────────────────────────

  if (phase === 'select') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Prep Session</Text>
          <Text style={styles.subtitle}>What are you preparing for?</Text>

          <View style={styles.scenarioList}>
            {PREP_SCENARIO_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={styles.scenarioCard}
                onPress={() => handleSelectCategory(cat.id)}
              >
                <Text style={styles.scenarioLabel}>{cat.label}</Text>
                <Text style={styles.scenarioDesc}>{cat.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    )
  }

  // ── Detail Input ───────────────────────────────

  if (phase === 'detail') {
    const category = PREP_SCENARIO_CATEGORIES.find(c => c.id === selectedCategory)
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setPhase('select')}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{category?.label}</Text>
          <Text style={styles.subtitle}>Tell me more about the situation.</Text>

          <TextInput
            style={styles.detailInput}
            value={detailText}
            onChangeText={setDetailText}
            placeholder={selectedCategory === 'interview'
              ? 'What role? What company? What are you worried about?'
              : selectedCategory === 'presentation'
              ? 'What topic? Who is the audience? How long?'
              : selectedCategory === 'difficult'
              ? 'Who is it with? What do you need to say?'
              : selectedCategory === 'meeting'
              ? "What's the meeting about? What's at stake?"
              : 'Describe the situation...'}
            placeholderTextColor={colors.inkGhost}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.startButton, !detailText.trim() && styles.startButtonDisabled]}
            onPress={handleStartPrep}
            disabled={!detailText.trim()}
          >
            <Text style={styles.startButtonText}>Start Practice</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // ── Conversation ───────────────────────────────

  if (phase === 'conversation') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.conversationHeader}>
          <TouchableOpacity onPress={handleDone}>
            <Text style={styles.endText}>End Session</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardShouldPersistTaps="handled"
        >
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
          {aiLoading && (
            <View style={styles.aiBubble}>
              <ActivityIndicator size="small" color={colors.inkGhost} />
            </View>
          )}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputBar}>
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

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.micButton}
              onPress={isRecording ? handleStopRecording : startRecording}
              disabled={transcribing}
            >
              <Ionicons
                name={isRecording ? 'stop-circle' : 'mic-outline'}
                size={22}
                color={isRecording ? colors.recording : colors.ink}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.chatInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Say something..."
              placeholderTextColor={colors.inkGhost}
              multiline
              maxLength={5000}
            />

            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || aiLoading}
            >
              <Ionicons name="arrow-up" size={20} color={inputText.trim() ? colors.paper : colors.inkGhost} />
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Done ───────────────────────────────────────

  if (phase === 'done') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.doneTitle}>Prep complete.</Text>
        <Text style={styles.doneSubtitle}>Good work. Go get it.</Text>
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 32,
  },
  scenarioList: {
    gap: 12,
  },
  scenarioCard: {
    backgroundColor: colors.paperDim,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  scenarioLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 4,
  },
  scenarioDesc: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  detailInput: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  startButtonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
  // Conversation styles
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.paperDeep,
  },
  endText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.inkMuted,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: colors.paperDim,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.paperDeep,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    minHeight: 40,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  aiMessageText: {
    fontStyle: 'italic',
  },
  inputBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.paperDeep,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.inkGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.paperDim,
    borderRadius: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
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
  errorText: {
    fontSize: 13,
    color: '#D94A4A',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  doneSubtitle: {
    fontSize: 16,
    color: colors.inkMuted,
  },
})
