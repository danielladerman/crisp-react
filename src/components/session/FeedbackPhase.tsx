// src/components/session/FeedbackPhase.tsx
import { useMemo } from 'react'
import { Text, ActivityIndicator, StyleSheet, View } from 'react-native'
import type { SessionState, SessionAction } from '../../types/session'
import { Button, Card, ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'
import parseFeedback from '../../lib/parseFeedback'

interface Props {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
}

export function FeedbackPhase({ state, dispatch }: Props) {
  // Only parse when streaming is done — avoids re-parsing on every chunk
  const feedbackParts = useMemo(
    () => (!state.feedbackStreaming && state.feedback) ? parseFeedback(state.feedback) : null,
    [state.feedbackStreaming, state.feedback],
  )

  return (
    <ScreenContainer scroll>
      <Text style={styles.prompt}>{state.openQuestion || state.prompt?.promptText}</Text>
      <Card>
        <Text style={styles.feedbackText}>{state.feedback || ''}</Text>
        {state.feedbackStreaming && <ActivityIndicator style={{ marginTop: 8 }} color={colors.inkGhost} />}
      </Card>
      {!state.feedbackStreaming && (
        <View style={styles.actions}>
          {state.deepDiveCount < 10 && feedbackParts?.open && (
            <Button variant="secondary" onPress={() => dispatch({ type: 'GO_DEEPER', question: feedbackParts.open })}>
              Go deeper →
            </Button>
          )}
          {state.error && (
            <Button variant="secondary" onPress={() => dispatch({ type: 'RETRY' })}>
              Retry
            </Button>
          )}
          <Button onPress={() => dispatch({ type: 'DONE_FEEDBACK' })}>Done</Button>
        </View>
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
  feedbackText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  actions: {
    gap: 8,
  },
})
