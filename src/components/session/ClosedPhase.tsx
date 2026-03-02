// src/components/session/ClosedPhase.tsx
import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Button, ScreenContainer } from '../ui'
import { colors, spacing } from '../../lib/theme'
import { getSuggestedDrill } from '../../lib/drills'
import { loadTodayWorkout, saveTodayWorkout, createWorkoutSession, upsertWorkoutProgress } from '../../lib/storage'

interface Props {
  state: { session: { user_id: string } | null }
  streak: { current_streak: number; longest_streak: number } | null
  sessionNumber: number
  onClose: () => void
}

export function ClosedPhase({ state, streak, sessionNumber, onClose }: Props) {
  const [todayWorkout, setTodayWorkout] = useState<any>(null)
  const [repDrill, setRepDrill] = useState<any>(null)
  const [repPhase, setRepPhase] = useState<'cta' | 'active' | 'done'>('cta')
  const [repText, setRepText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTodayWorkout().then(setTodayWorkout)
    const { drill } = getSuggestedDrill({
      weaknesses: null,
      intakeAnswers: null,
      voiceModel: null,
      sessionCount: sessionNumber,
    })
    setRepDrill(drill)
  }, [sessionNumber])

  const handleStartRep = useCallback(() => {
    setRepPhase('active')
  }, [])

  const handleCompleteRep = useCallback(async () => {
    if (!state.session?.user_id || !repDrill) return
    setSaving(true)
    try {
      await createWorkoutSession({
        userId: state.session.user_id,
        drillId: repDrill.id,
        drillName: repDrill.name,
        category: repDrill.category,
        difficulty: repDrill.difficulty,
        durationSeconds: repDrill.duration,
        notes: repText || null,
      })
      await upsertWorkoutProgress(state.session.user_id, repDrill.id)
      await saveTodayWorkout(repDrill.name)
      setRepPhase('done')
    } catch (err) {
      if (__DEV__) console.error('Rep save failed:', err)
      Alert.alert('Error', 'Could not save your rep. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [state.session, repDrill, repText])

  // Active rep phase — drill execution
  if (repPhase === 'active' && repDrill) {
    return (
      <ScreenContainer keyboard scroll>
        <Text style={styles.repTitle}>{repDrill.name}</Text>
        <Text style={styles.repInstructions}>{repDrill.theDrill}</Text>
        <TextInput
          style={styles.repInput}
          value={repText}
          onChangeText={setRepText}
          placeholder="Your response..."
          placeholderTextColor={colors.inkGhost}
          multiline
          textAlignVertical="top"
        />
        <Button onPress={handleCompleteRep} disabled={saving}>
          {saving ? 'Saving...' : 'Done'}
        </Button>
      </ScreenContainer>
    )
  }

  // Done phase — rep completed
  if (repPhase === 'done') {
    return (
      <ScreenContainer center>
        <Text style={styles.title}>Session + rep complete.</Text>
        <Text style={styles.streak}>
          {streak?.current_streak ? `${streak.current_streak} day streak` : ''}
        </Text>
        <Button onPress={onClose}>Home</Button>
      </ScreenContainer>
    )
  }

  // CTA phase — session complete, offer daily rep
  const alreadyDid = !!todayWorkout
  return (
    <ScreenContainer center>
      <Text style={styles.title}>Session {sessionNumber} complete.</Text>
      <Text style={styles.streak}>
        {streak?.current_streak ? `${streak.current_streak} day streak` : ''}
      </Text>

      {/* Prescription CTA */}
      {!alreadyDid && repDrill && (
        <View style={styles.repCard}>
          <Text style={styles.repCardTitle}>Daily rep</Text>
          <Text style={styles.repCardDrill}>{repDrill.name}</Text>
          <Text style={styles.repCardTime}>~{Math.ceil(repDrill.duration / 60)} min</Text>
          <TouchableOpacity style={styles.repButton} onPress={handleStartRep}>
            <Text style={styles.repButtonText}>Do it now</Text>
          </TouchableOpacity>
        </View>
      )}

      {alreadyDid && (
        <Text style={styles.alreadyDone}>Daily rep done.</Text>
      )}

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
    marginBottom: 24,
  },
  // Prescription CTA card
  repCard: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  repCardTitle: {
    fontSize: 12,
    color: colors.inkGhost,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  repCardDrill: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 4,
  },
  repCardTime: {
    fontSize: 13,
    color: colors.inkMuted,
    marginBottom: 16,
  },
  repButton: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  repButtonText: {
    color: colors.paper,
    fontSize: 14,
    fontWeight: '500',
  },
  alreadyDone: {
    fontSize: 14,
    color: colors.inkGhost,
    marginBottom: 24,
  },
  // Active rep styles
  repTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 16,
  },
  repInstructions: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  repInput: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
})
