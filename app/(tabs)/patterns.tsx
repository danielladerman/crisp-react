// app/(tabs)/patterns.tsx — Patterns screen (rebuilt to use patterns table)
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { usePatterns } from '../../src/hooks/usePatterns'
import { getSessionCount } from '../../src/lib/storage'
import { colors } from '../../src/lib/theme'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function PatternsScreen() {
  const { user } = useAuth()
  const { strengths, weaknesses, loading: patternsLoading, refresh } = usePatterns(user?.id)
  const [sessionCount, setSessionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    if (__DEV__) console.log('[PatternsScreen] Loading for userId:', user.id)
    getSessionCount(user.id)
      .then((count) => {
        if (__DEV__) console.log('[PatternsScreen] sessionCount:', count)
        setSessionCount(count)
      })
      .catch(err => { if (__DEV__) console.error('[PatternsScreen] sessionCount error:', err) })
      .finally(() => setLoading(false))
  }, [user?.id])

  // Refetch patterns when tab is focused (not just on mount)
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return
      if (__DEV__) console.log('[PatternsScreen] Tab focused — refreshing patterns')
      refresh()
      getSessionCount(user.id)
        .then(setSessionCount)
        .catch(err => { if (__DEV__) console.error('[PatternsScreen] refresh sessionCount error:', err) })
    }, [user?.id, refresh])
  )

  if (loading || patternsLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.inkGhost} />
      </View>
    )
  }

  if (sessionCount < 3) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Your Patterns</Text>
          <Text style={styles.emptyText}>
            Complete a few more sessions and your patterns will start forming here.
          </Text>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const hasAny = strengths.length > 0 || weaknesses.length > 0

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Your Patterns</Text>
        <Text style={styles.subtitle}>
          Based on {sessionCount} sessions.
        </Text>

        {!hasAny && (
          <Text style={styles.emptyText}>
            No patterns detected yet. Keep practicing — patterns emerge after a few sessions.
          </Text>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>STRENGTHS</Text>
            {strengths.map(p => (
              <View key={p.id} style={styles.patternCard}>
                <Text style={styles.patternName}>
                  {p.pattern_id.replace(/-/g, ' ')}
                </Text>
                <Text style={styles.patternDesc}>{p.description}</Text>
                {p.evidence.slice(0, 2).map((e, i) => (
                  <Text key={i} style={styles.evidence}>"{e.excerpt}"</Text>
                ))}
                <Text style={styles.meta}>
                  First seen {formatDate(p.first_detected_at)}
                  {p.last_seen_at !== p.first_detected_at &&
                    ` · Last seen ${formatDate(p.last_seen_at)}`}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>AREAS TO WORK ON</Text>
            {weaknesses.map(p => (
              <View key={p.id} style={styles.patternCard}>
                <Text style={styles.patternName}>
                  {p.pattern_id.replace(/-/g, ' ')}
                </Text>
                <Text style={styles.patternDesc}>{p.description}</Text>
                {p.evidence.slice(0, 2).map((e, i) => (
                  <Text key={i} style={styles.evidence}>"{e.excerpt}"</Text>
                ))}
                <Text style={styles.meta}>
                  First seen {formatDate(p.first_detected_at)}
                  {p.last_seen_at !== p.first_detected_at &&
                    ` · Last seen ${formatDate(p.last_seen_at)}`}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  title: { fontSize: 20, fontWeight: '500', color: colors.ink, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.inkMuted, marginBottom: 32 },
  emptyText: { fontSize: 15, lineHeight: 24, color: colors.inkMuted, marginTop: 16 },
  sectionHeader: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5, color: colors.inkGhost,
    marginBottom: 12, marginTop: 8,
  },
  patternCard: {
    backgroundColor: colors.paperDim, borderRadius: 12, padding: 16, marginBottom: 12,
  },
  patternName: {
    fontSize: 15, fontWeight: '500', color: colors.ink, textTransform: 'capitalize', marginBottom: 6,
  },
  patternDesc: { fontSize: 14, lineHeight: 20, color: colors.ink, marginBottom: 8 },
  evidence: {
    fontSize: 13, lineHeight: 18, color: colors.inkMuted, fontStyle: 'italic',
    marginBottom: 4, paddingLeft: 8,
  },
  meta: { fontSize: 12, color: colors.inkGhost, marginTop: 6 },
})
