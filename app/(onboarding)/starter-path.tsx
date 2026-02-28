import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getIntakeLabel, getIntakeObservation, getStarterDrills } from '../../src/lib/intakeMapping'
import { getDrillById } from '../../src/lib/drills'
import { colors } from '../../src/lib/theme'

export default function StarterPathScreen() {
  const router = useRouter()
  const { answers: answersJson } = useLocalSearchParams<{ answers: string }>()
  const answers = answersJson ? JSON.parse(answersJson) : {}

  const label = getIntakeLabel(answers)
  const observation = getIntakeObservation(answers)
  const drillIds = getStarterDrills(answers)
  const drills = drillIds.map(getDrillById).filter(Boolean)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Your starting point</Text>
      <Text style={styles.focusTitle}>{label}</Text>
      <Text style={styles.observation}>{observation}</Text>

      {drills.length > 0 && (
        <>
          <Text style={styles.drillsLabel}>Your first three drills:</Text>
          <View style={styles.drillList}>
            {drills.map((drill, i) => (
              <View key={drill.id} style={styles.drillItem}>
                <Text style={styles.drillNumber}>{i + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drillName}>{drill.name}</Text>
                  <Text style={styles.drillMeta}>
                    {drill.category} · {Math.ceil(drill.duration / 60)} min
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.drillHint}>
            These are in the Workout Library when you're ready.
          </Text>
        </>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push({ pathname: '/(onboarding)/founding-session', params: { answers: answersJson } })}
      >
        <Text style={styles.buttonText}>Start your first session</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkGhost,
    marginBottom: 24,
  },
  focusTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 12,
  },
  observation: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 26,
    color: colors.inkMuted,
    marginBottom: 40,
  },
  drillsLabel: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 16,
  },
  drillList: {
    gap: 12,
    marginBottom: 16,
  },
  drillItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.paperDim,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  drillNumber: {
    fontSize: 12,
    color: colors.inkGhost,
    marginTop: 2,
  },
  drillName: {
    fontSize: 14,
    color: colors.ink,
  },
  drillMeta: {
    fontSize: 12,
    color: colors.inkGhost,
    marginTop: 2,
  },
  drillHint: {
    fontSize: 12,
    color: colors.inkGhost,
    marginBottom: 40,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
})
