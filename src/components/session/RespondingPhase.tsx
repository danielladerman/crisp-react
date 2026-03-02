// src/components/session/RespondingPhase.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Text, Alert, StyleSheet } from 'react-native'
import type { SessionState, SessionAction } from '../../types/session'
import { Button, TextArea, ScreenContainer, BackButton } from '../ui'
import { colors } from '../../lib/theme'

const TIMER_SECONDS = 90

interface Props {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  sideEffects: { submitResponse: (text: string, isDeepDive?: boolean) => Promise<void> }
  onClose: () => void
}

export function RespondingPhase({ state, dispatch, sideEffects, onClose }: Props) {
  const [text, setText] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isDeepDive = !!state.openQuestion

  // Advisory countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timerExpired = secondsLeft === 0

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return
    await sideEffects.submitResponse(text.trim(), isDeepDive)
    setText('')
  }, [text, isDeepDive, sideEffects])

  const handleExit = useCallback(() => {
    if (text.length > 0) {
      Alert.alert('Leave this session?', 'Your response so far has been saved.', [
        { text: 'Continue session', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onClose },
      ])
    } else {
      onClose()
    }
  }, [text, onClose])

  return (
    <ScreenContainer keyboard scroll>
      {!isDeepDive && <BackButton onPress={handleExit} />}
      {isDeepDive && (
        <Text style={styles.exchangeCount}>Exchange {state.deepDiveCount + 1} of 10</Text>
      )}
      <Text style={styles.prompt}>{state.openQuestion || state.prompt?.promptText}</Text>
      <Text style={[styles.timer, timerExpired && styles.timerExpired]}>
        {timerExpired ? 'Submit when ready' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
      </Text>
      <TextArea value={text} onChangeText={setText} />
      <Button onPress={handleSubmit} disabled={!text.trim()}>Submit</Button>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
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
    marginBottom: 16,
  },
  timer: {
    fontSize: 13,
    color: colors.inkGhost,
    textAlign: 'right',
    marginBottom: 16,
  },
  timerExpired: {
    color: colors.gold,
  },
})
