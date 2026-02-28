// src/components/session/QualityPhase.tsx
import { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { SessionState, SessionAction } from '../../types/session'
import { ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'
import { getVoiceModel, upsertVoiceModel } from '../../lib/storage'
import { callClaude } from '../../lib/claude'
import { VOICE_MODEL_UPDATE_PROMPT } from '../../lib/prompts'
import parseFeedback from '../../lib/parseFeedback'

interface Props {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  sideEffects: { saveQuality: (signal: string) => Promise<void> }
  recordPractice: () => Promise<void>
  sessionNumber: number
}

const QUALITY_SIGNALS = [
  { id: 'breakthrough', label: 'Breakthrough — I said something new' },
  { id: 'solid', label: 'Solid — good practice' },
  { id: 'struggled', label: 'Struggled — felt stuck' },
  { id: 'off', label: "Off — wasn't feeling it" },
]

export function QualityPhase({ state, dispatch, sideEffects, recordPractice, sessionNumber }: Props) {
  const handleSelect = useCallback(async (signal: string) => {
    dispatch({ type: 'SUBMIT_QUALITY', signal })
    await sideEffects.saveQuality(signal)

    try { await recordPractice() } catch {}

    // Voice model update (every session for first 20, then every 3rd)
    const shouldUpdate = sessionNumber <= 20 || sessionNumber % 3 === 0
    if (shouldUpdate && state.session?.user_id) {
      try {
        const currentModel = await getVoiceModel(state.session.user_id) || {}
        const parts = parseFeedback(state.feedback)
        const result = await callClaude({
          model: 'claude-sonnet-4-6',
          maxTokens: 3000,
          systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
          messages: [{
            role: 'user',
            content: `CURRENT VOICE MODEL:\n${JSON.stringify(currentModel, null, 2)}\n\nSESSION DATA:\nMode: ${state.sessionMode}\nSession Number: ${sessionNumber}\nPrompt Type: ${state.prompt?.promptType}\nPrompt: ${state.prompt?.promptText}\nUser Response: ${state.responseText}\nAI Echo: ${parts.echo}\nAI Name: ${parts.name}\nDrill Prompt: ${parts.drill || 'none'}\nDrill Response: ${state.drillResponse || 'skipped'}\nAI Open: ${parts.open}\nQuality Signal: ${signal}\n\nUpdate the voice model. Return only updated JSON.`,
          }],
        })
        const updatedModel = JSON.parse(result)
        await upsertVoiceModel(state.session.user_id, updatedModel, sessionNumber)
      } catch {}
    }
  }, [state, dispatch, sideEffects, recordPractice, sessionNumber])

  return (
    <ScreenContainer center>
      <Text style={styles.title}>How was that?</Text>
      <View style={styles.options}>
        {QUALITY_SIGNALS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.option}
            onPress={() => handleSelect(s.id)}
          >
            <Text style={styles.optionText}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 32,
  },
  options: {
    width: '100%',
    gap: 12,
  },
  option: {
    backgroundColor: colors.paperDim,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  optionText: {
    fontSize: 15,
    color: colors.ink,
  },
})
