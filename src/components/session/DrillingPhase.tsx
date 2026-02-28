// src/components/session/DrillingPhase.tsx
import { useState, useCallback } from 'react'
import type { SessionState, SessionAction } from '../../types/session'
import { Text, StyleSheet } from 'react-native'
import { Button, TextArea, ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'

interface Props {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  sideEffects: { saveDrill: (response: string, skipped?: boolean) => Promise<void> }
}

export function DrillingPhase({ state, dispatch, sideEffects }: Props) {
  const [response, setResponse] = useState('')

  const handleSubmit = useCallback(async () => {
    await sideEffects.saveDrill(response.trim())
    dispatch({ type: 'SUBMIT_DRILL', response: response.trim() })
  }, [response, sideEffects, dispatch])

  const handleSkip = useCallback(async () => {
    await sideEffects.saveDrill('', true)
    dispatch({ type: 'SKIP_DRILL' })
  }, [sideEffects, dispatch])

  return (
    <ScreenContainer keyboard scroll>
      <Text style={styles.title}>Micro Drill</Text>
      <Text style={styles.drillPrompt}>{state.drillText}</Text>
      <TextArea
        value={response}
        onChangeText={setResponse}
        placeholder="Your response..."
      />
      <Button onPress={handleSubmit} disabled={!response.trim()}>Done</Button>
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
  drillPrompt: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
    color: colors.ink,
    marginBottom: 24,
  },
})
