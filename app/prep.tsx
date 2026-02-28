import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/hooks/useAuth'
import { usePrepSession } from '../src/hooks/usePrepSession'
import { getSessionCount } from '../src/lib/storage'
import { colors } from '../src/lib/theme'

export default function PrepScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessionCount, setSessionCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // Load session count once
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    getSessionCount(user.id).then((c) => {
      if (!cancelled) {
        setSessionCount(c)
        setLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [user?.id])

  const {
    exchanges, keyMessages, phase, streaming, currentResponse, error,
    startPrep, submitMessage, generateKeyMessages, completePrep,
  } = usePrepSession({ userId: user?.id, sessionCount })

  const [situationType, setSituationType] = useState('')
  const [situationDescription, setSituationDescription] = useState('')
  const [input, setInput] = useState('')

  const situationTypes = [
    { id: 'meeting', label: 'Meeting or presentation' },
    { id: 'conversation', label: 'Difficult conversation' },
    { id: 'interview', label: 'Interview' },
    { id: 'negotiation', label: 'Negotiation' },
    { id: 'other', label: 'Something else' },
  ]

  const handleStartPrep = useCallback(() => {
    if (!situationType || !situationDescription.trim()) return
    startPrep(situationType, situationDescription.trim())
  }, [situationType, situationDescription, startPrep])

  const handleSend = useCallback(() => {
    if (!input.trim() || streaming) return
    submitMessage(input.trim())
    setInput('')
  }, [input, streaming, submitMessage])

  const handleDone = useCallback(() => {
    completePrep()
    router.back()
  }, [completePrep])

  // --- Setup phase ---
  if (phase === 'setup') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Home</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Prep Mode</Text>
          <Text style={styles.subtitle}>
            What are you preparing for?
          </Text>

          <View style={styles.typeList}>
            {situationTypes.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeOption, situationType === t.id && styles.typeOptionSelected]}
                onPress={() => setSituationType(t.id)}
              >
                <Text style={[styles.typeText, situationType === t.id && styles.typeTextSelected]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {situationType && (
            <>
              <Text style={styles.descLabel}>Describe the situation:</Text>
              <TextInput
                style={styles.textArea}
                value={situationDescription}
                onChangeText={setSituationDescription}
                placeholder="What's happening, who's involved, what's at stake..."
                placeholderTextColor={colors.inkGhost}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.button, !situationDescription.trim() && styles.buttonDisabled]}
                onPress={handleStartPrep}
                disabled={!situationDescription.trim()}
              >
                <Text style={styles.buttonText}>Begin prep</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // --- Conversation phase ---
  if (phase === 'conversation' || streaming) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {exchanges.map((ex: any, i: number) => (
              <View key={i} style={styles.exchange}>
                {ex.role === 'user' ? (
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{ex.content}</Text>
                  </View>
                ) : (
                  <Text style={styles.assistantText}>{ex.content}</Text>
                )}
              </View>
            ))}
            {streaming && currentResponse && (
              <Text style={styles.assistantText}>{currentResponse}</Text>
            )}
            {streaming && !currentResponse && (
              <ActivityIndicator color={colors.inkGhost} style={{ marginTop: 8 }} />
            )}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              style={styles.chatInput}
              value={input}
              onChangeText={setInput}
              placeholder="Type your message..."
              placeholderTextColor={colors.inkGhost}
              multiline
              editable={!streaming}
            />
            <View style={styles.inputActions}>
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim() || streaming}
              >
                <Text style={[styles.sendText, (!input.trim() || streaming) && { color: colors.inkGhost }]}>
                  Send
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={generateKeyMessages} disabled={streaming}>
                <Text style={styles.generateText}>Get key messages</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // --- Generating ---
  if (phase === 'generating') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.inkGhost} />
        <Text style={styles.generatingText}>Distilling your key messages...</Text>
      </View>
    )
  }

  // --- Key Messages ---
  if (phase === 'messages') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Your Key Messages</Text>
        <View style={styles.messagesList}>
          {(keyMessages || []).map((msg: any, i: number) => (
            <View key={i} style={styles.messageCard}>
              <Text style={styles.messageNumber}>{i + 1}</Text>
              <Text style={styles.messageText}>
                {typeof msg === 'string' ? msg : msg.text || JSON.stringify(msg)}
              </Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
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
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  typeList: {
    gap: 12,
    marginBottom: 24,
  },
  typeOption: {
    backgroundColor: colors.paperDim,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  typeOptionSelected: {
    backgroundColor: colors.ink,
  },
  typeText: {
    fontSize: 15,
    color: colors.ink,
  },
  typeTextSelected: {
    color: colors.paper,
  },
  descLabel: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 12,
  },
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 120,
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
  exchange: {
    marginBottom: 16,
  },
  userBubble: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 14,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  userBubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: colors.paperDeep,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.paper,
  },
  chatInput: {
    fontSize: 15,
    color: colors.ink,
    maxHeight: 100,
    marginBottom: 8,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sendText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
  },
  generateText: {
    fontSize: 14,
    color: colors.sky,
  },
  generatingText: {
    fontSize: 14,
    color: colors.inkGhost,
    marginTop: 12,
  },
  messagesList: {
    gap: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  messageCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 16,
  },
  messageNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkGhost,
  },
  messageText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
})
