import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useAuth } from '../../src/hooks/useAuth'
import { getVoiceModel, getSessionCount } from '../../src/lib/storage'
import { colors } from '../../src/lib/theme'

export default function PatternsScreen() {
  const { user } = useAuth()
  const [voiceModel, setVoiceModel] = useState<any>(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    async function load() {
      const count = await getSessionCount(user!.id)
      setSessionCount(count)
      const vm = await getVoiceModel(user!.id)
      setVoiceModel(vm)
      setLoading(false)
    }
    load()
  }, [user?.id])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.inkGhost} />
      </View>
    )
  }

  if (sessionCount < 3) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Your Patterns</Text>
          <Text style={styles.emptyText}>
            Complete a few more sessions and your voice model will start forming here.
          </Text>
        </ScrollView>
      </View>
    )
  }

  if (!voiceModel) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Your Patterns</Text>
          <Text style={styles.emptyText}>No voice model data yet.</Text>
        </ScrollView>
      </View>
    )
  }

  const sections = [
    { key: 'thinkingStyle', label: 'Thinking Style' },
    { key: 'expressionStyle', label: 'Expression Style' },
    { key: 'thematicFingerprint', label: 'Thematic Fingerprint' },
    { key: 'growthEdge', label: 'Growth Edge' },
  ]

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Your Patterns</Text>
        <Text style={styles.subtitle}>
          This is what {sessionCount} sessions have revealed about your voice.
        </Text>

        {sections.map((section) => {
          const data = voiceModel[section.key]
          if (!data) return null
          return (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {typeof data === 'string' ? (
                <Text style={styles.sectionBody}>{data}</Text>
              ) : typeof data === 'object' ? (
                Object.entries(data).map(([k, v]) => (
                  <View key={k} style={styles.field}>
                    <Text style={styles.fieldLabel}>{k.replace(/([A-Z])/g, ' $1').trim()}</Text>
                    <Text style={styles.fieldValue}>
                      {typeof v === 'string' ? v : JSON.stringify(v)}
                    </Text>
                  </View>
                ))
              ) : null}
            </View>
          )
        })}

        {/* Pending probes */}
        {voiceModel.pendingProbes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Probes</Text>
            {voiceModel.pendingProbes.contradictions?.length > 0 && (
              <View style={styles.probeGroup}>
                <Text style={styles.probeLabel}>Contradictions</Text>
                {voiceModel.pendingProbes.contradictions.map((c: any, i: number) => (
                  <Text key={i} style={styles.probeItem}>• {c.description}</Text>
                ))}
              </View>
            )}
            {voiceModel.pendingProbes.reclaimOpportunities?.length > 0 && (
              <View style={styles.probeGroup}>
                <Text style={styles.probeLabel}>Reclaim Opportunities</Text>
                {voiceModel.pendingProbes.reclaimOpportunities.map((r: any, i: number) => (
                  <Text key={i} style={styles.probeItem}>• {r.description}</Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 120,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 32,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMuted,
    marginTop: 16,
  },
  section: {
    marginBottom: 28,
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkGhost,
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  field: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.inkGhost,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  fieldValue: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  probeGroup: {
    marginBottom: 12,
  },
  probeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inkMuted,
    marginBottom: 4,
  },
  probeItem: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    marginLeft: 4,
    marginBottom: 2,
  },
})
