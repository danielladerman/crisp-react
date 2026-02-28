// src/components/session/ThinkingPhase.tsx
import { Text, ActivityIndicator, StyleSheet } from 'react-native'
import type { SessionState } from '../../types/session'
import { ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'

interface Props {
  state: SessionState
}

export function ThinkingPhase({ state }: Props) {
  return (
    <ScreenContainer center>
      <Text style={styles.prompt}>{state.openQuestion || state.prompt?.promptText}</Text>
      {state.feedbackStreaming && state.feedback ? (
        <Text style={styles.streamingText}>{state.feedback}</Text>
      ) : (
        <>
          <ActivityIndicator color={colors.inkGhost} style={{ marginTop: 32 }} />
          <Text style={styles.thinkingText}>Thinking...</Text>
        </>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  prompt: {
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 28,
    color: colors.ink,
    marginBottom: 32,
  },
  streamingText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
    marginTop: 16,
  },
  thinkingText: {
    fontSize: 14,
    color: colors.inkGhost,
    marginTop: 12,
  },
})
