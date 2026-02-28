// src/components/session/ClosedPhase.tsx
import { Text, StyleSheet } from 'react-native'
import { Button, ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'

interface Props {
  streak: { current_streak: number; longest_streak: number } | null
  sessionNumber: number
  onClose: () => void
}

export function ClosedPhase({ streak, sessionNumber, onClose }: Props) {
  return (
    <ScreenContainer center>
      <Text style={styles.title}>Session {sessionNumber} complete.</Text>
      <Text style={styles.streak}>
        {streak?.current_streak ? `${streak.current_streak} day streak` : ''}
      </Text>
      <Button onPress={onClose}>Home</Button>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  streak: {
    fontSize: 14,
    color: colors.gold,
    marginBottom: 40,
  },
})
