// src/components/session/ExplainingPhase.tsx
import { useState, useCallback } from 'react'
import type { SessionState, SessionAction } from '../../types/session'
import { Text, StyleSheet } from 'react-native'
import { Button, TextArea, ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'

interface Props {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  sideEffects: { saveExplanation: (text: string) => Promise<void> }
}

export function ExplainingPhase({ state, dispatch, sideEffects }: Props) {
  const [explanation, setExplanation] = useState('')

  const handleSave = useCallback(async () => {
    await sideEffects.saveExplanation(explanation.trim())
    dispatch({ type: 'SUBMIT_EXPLANATION', text: explanation.trim() })
  }, [explanation, sideEffects, dispatch])

  const handleSkip = useCallback(() => {
    dispatch({ type: 'SKIP_EXPLANATION' })
  }, [dispatch])

  return (
    <ScreenContainer keyboard scroll>
      <Text style={styles.title}>Why did this resonate?</Text>
      <Text style={styles.subtitle}>
        You marked: "{state.markedMoment}"
      </Text>
      <TextArea
        value={explanation}
        onChangeText={setExplanation}
        placeholder="What made this moment feel true..."
        minHeight={120}
      />
      <Button onPress={handleSave} disabled={!explanation.trim()}>Save</Button>
      <Button variant="secondary" onPress={handleSkip}>Skip</Button>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.inkMuted,
    marginBottom: 24,
    fontStyle: 'italic',
  },
})
