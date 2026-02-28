// src/components/session/QualityPhase.tsx
import { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { SessionState, SessionAction } from '../../types/session'
import { ScreenContainer } from '../ui'
import { colors } from '../../lib/theme'

interface Props {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  sideEffects: { saveQuality: (signal: string, sessionNumber: number) => Promise<void> }
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
    await sideEffects.saveQuality(signal, sessionNumber)
    try { await recordPractice() } catch {}
  }, [dispatch, sideEffects, recordPractice, sessionNumber])

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
