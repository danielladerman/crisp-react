// src/components/session/MarkingPhase.tsx
import { useState, useCallback } from 'react'
import type { SessionState, SessionAction } from '../../types/session'
import { Text, StyleSheet } from 'react-native'
import { Button, TextArea, ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'

interface Props {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  sideEffects: { saveMark: (text: string) => Promise<void> }
}

export function MarkingPhase({ state, dispatch, sideEffects }: Props) {
  const [markText, setMarkText] = useState('')

  const handleMark = useCallback(async () => {
    await sideEffects.saveMark(markText.trim())
    dispatch({ type: 'COMPLETE_MARK', text: markText.trim() })
  }, [markText, sideEffects, dispatch])

  const handleSkip = useCallback(async () => {
    await sideEffects.saveMark('')
    dispatch({ type: 'SKIP_MARK' })
  }, [sideEffects, dispatch])

  return (
    <ScreenContainer keyboard scroll>
      <Text style={styles.title}>Mark a moment</Text>
      <Text style={styles.subtitle}>
        Was there a sentence or phrase from your response that felt especially true?
      </Text>
      <TextArea
        value={markText}
        onChangeText={setMarkText}
        placeholder="Paste or type the moment..."
      />
      <Button onPress={handleMark} disabled={!markText.trim()}>Mark it</Button>
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
  },
})
