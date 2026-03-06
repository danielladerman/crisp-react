// app/(tabs)/index.tsx — Home screen (rebuilt)
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { useStreak } from '../../src/hooks/useStreak'
// Dynamic import — expo-haptics is native-only
let Haptics: any = null
try { Haptics = require('expo-haptics') } catch {}
import { DEFAULT_PROMPTS, PROMPT_SELECTION_SYSTEM_PROMPT } from '../../src/lib/prompts'
import { getPersonalizedPrompts } from '../../src/lib/intakeMapping'
import { getDrillById } from '../../src/lib/drills'
import { callClaude } from '../../src/lib/claude'
import {
  getVoiceModel, getSessionCount, getTodaySession, getRecentSessions,
  getFocusMode, setFocusMode,
} from '../../src/lib/storage'
import type { FocusMode } from '../../src/lib/storage'
import { colors } from '../../src/lib/theme'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { streak } = useStreak(user?.id)

  const [sessionCount, setSessionCount] = useState(0)
  const [todaySession, setTodaySession] = useState<any>(null)
  const [voiceModel, setVoiceModel] = useState<any>(null)
  const [suggestedDrills, setSuggestedDrills] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [focusMode, setFocusModeState] = useState<FocusMode>('mixed')

  const loadHomeData = useCallback(async () => {
    if (!user?.id) return
    try {
      const count = await getSessionCount(user.id)
      setSessionCount(count)

      const today = await getTodaySession(user.id)
      setTodaySession(today)

      if (count >= 5) {
        const vm = await getVoiceModel(user.id)
        setVoiceModel(vm)
      }

      const recent = await getRecentSessions(user.id, 1)
      if (recent[0]?.suggested_drills) {
        setSuggestedDrills(recent[0].suggested_drills)
      }

      const fm = await getFocusMode()
      setFocusModeState(fm)
    } catch (err) {
      if (__DEV__) console.error('Home data load:', err)
    }
  }, [user?.id])

  useEffect(() => {
    loadHomeData().then(() => setPageLoading(false))
  }, [loadHomeData])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadHomeData()
    setRefreshing(false)
  }, [loadHomeData])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || ''

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const handleStartSession = useCallback(async () => {
    setLoading(true)
    try {
      let prompt: { promptType: string; promptText: string } | null = null

      // Early sessions: use personalized prompts from intake
      if (sessionCount < 5) {
        const intakeData = user?.user_metadata?.intake_answers
        if (intakeData) {
          const sequence = getPersonalizedPrompts(intakeData)
          const idx = Math.min(sessionCount, sequence.length - 1)
          prompt = sequence[idx]
        } else {
          const types = ['reveal', 'pressure', 'reveal', 'story'] as const
          const typeIndex = Math.min(sessionCount, types.length - 1)
          const type = types[typeIndex]
          const pool = DEFAULT_PROMPTS[type] || DEFAULT_PROMPTS.reveal
          prompt = { promptType: type, promptText: pool[Math.floor(Math.random() * pool.length)] }
        }
      } else {
        // Session 5+: use AI-driven prompt selection
        try {
          const result = await callClaude({
            systemPrompt: PROMPT_SELECTION_SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: `Voice model:\n${JSON.stringify(voiceModel, null, 2)}\n\nSession count: ${sessionCount}\nFocus mode: ${focusMode}`,
            }],
            maxTokens: 500,
          })
          const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
          prompt = JSON.parse(cleaned)
        } catch (err) {
          if (__DEV__) console.error('AI prompt selection failed, using fallback:', err)
        }
      }

      // Fallback
      if (!prompt) {
        const pool = DEFAULT_PROMPTS.reveal
        prompt = { promptType: 'reveal', promptText: pool[Math.floor(Math.random() * pool.length)] }
      }

      router.push({
        pathname: '/session',
        params: {
          promptType: prompt.promptType,
          promptText: prompt.promptText,
          sessionCount: String(sessionCount),
          focusMode,
        },
      })
    } catch (err) {
      if (__DEV__) console.error('Failed to start session:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionCount, user, voiceModel, focusMode])

  const handleFocusMode = useCallback(async (mode: FocusMode) => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const prev = focusMode
    setFocusModeState(mode)
    try { await setFocusMode(mode) } catch (err) { if (__DEV__) console.error('Focus mode save failed:', err); setFocusModeState(prev) }
  }, [focusMode])

  if (pageLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.inkGhost} />
      </View>
    )
  }

  // Already practiced today
  if (todaySession?.status === 'completed') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.inkGhost} />}>
          <View style={styles.header}>
            <Text style={styles.logo}>CRISP</Text>
            {streak && <Text style={styles.streakBadge}>{streak.current_streak}d</Text>}
          </View>

          <View style={styles.centerContent}>
            <Text style={styles.doneText}>You practiced today.</Text>

            <TouchableOpacity onPress={handleStartSession} disabled={loading}>
              <Text style={[styles.practiceAgain, loading && { opacity: 0.5 }]}>
                {loading ? 'Preparing...' : 'Or practice again →'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.prepButton}
              onPress={() => router.push('/prep')}
            >
              <Text style={styles.prepButtonText}>Prep for something →</Text>
            </TouchableOpacity>

            <Text style={styles.comeBack}>Come back tomorrow.</Text>
          </View>

          {/* Suggested drills from last session */}
          {suggestedDrills.length > 0 && (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedTitle}>SUGGESTED WORKOUTS</Text>
              {suggestedDrills.map(drillId => {
                const drill = getDrillById(drillId)
                if (!drill) return null
                return (
                  <TouchableOpacity
                    key={drill.id}
                    style={styles.suggestedCard}
                    onPress={() => router.push('/(tabs)/workouts')}
                  >
                    <Text style={styles.suggestedName}>{drill.name}</Text>
                    <Text style={styles.suggestedMeta}>{drill.category}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    )
  }

  // Ready to practice
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.inkGhost} />}>
        <View style={styles.header}>
          <Text style={styles.logo}>CRISP</Text>
          {streak && <Text style={styles.streakBadge}>{streak.current_streak}d</Text>}
        </View>

        <View style={styles.centerContent}>
          <Text style={styles.greeting}>
            {greeting}{firstName ? `, ${firstName}` : ''}.
          </Text>
          <Text style={styles.readyText}>Ready to practice?</Text>

          {/* Focus mode selector */}
          <View style={styles.focusRow}>
            {(['professional', 'relational', 'mixed'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.focusChip, focusMode === mode && styles.focusChipActive]}
                onPress={() => handleFocusMode(mode)}
              >
                <Text style={[styles.focusChipText, focusMode === mode && styles.focusChipTextActive]}>
                  {mode === 'professional' ? 'Pro' : mode === 'relational' ? 'Personal' : 'Mixed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.startButton, loading && styles.startButtonDisabled]}
            onPress={handleStartSession}
            disabled={loading}
          >
            <Text style={styles.startButtonText}>
              {loading ? 'Preparing...' : "Begin today's session"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.prepButton}
            onPress={() => router.push('/prep')}
          >
            <Text style={styles.prepButtonText}>Prep for something →</Text>
          </TouchableOpacity>
        </View>

        {/* Suggested drills from last session */}
        {suggestedDrills.length > 0 && (
          <View style={styles.suggestedSection}>
            <Text style={styles.suggestedTitle}>SUGGESTED WORKOUTS</Text>
            {suggestedDrills.map(drillId => {
              const drill = getDrillById(drillId)
              if (!drill) return null
              return (
                <TouchableOpacity
                  key={drill.id}
                  style={styles.suggestedCard}
                  onPress={() => router.push('/(tabs)/workouts')}
                >
                  <Text style={styles.suggestedName}>{drill.name}</Text>
                  <Text style={styles.suggestedMeta}>{drill.category}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 80 },
  logo: { fontSize: 14, fontWeight: '500', letterSpacing: 3, color: colors.ink },
  streakBadge: { fontSize: 13, fontWeight: '500', color: colors.gold },
  centerContent: { alignItems: 'center' },
  greeting: { fontSize: 20, color: colors.ink, marginBottom: 8 },
  readyText: { fontSize: 20, color: colors.ink, marginBottom: 48 },
  focusRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  focusChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.paperDeep },
  focusChipActive: { backgroundColor: colors.ink },
  focusChipText: { fontSize: 13, color: colors.inkGhost },
  focusChipTextActive: { color: colors.paper },
  startButton: { backgroundColor: colors.ink, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  startButtonDisabled: { backgroundColor: colors.paperDeep },
  startButtonText: { color: colors.paper, fontSize: 15, fontWeight: '500' },
  prepButton: { marginTop: 16, paddingVertical: 10, alignItems: 'center' as const },
  prepButtonText: { fontSize: 14, color: colors.inkGhost },
  doneText: { fontSize: 16, color: colors.ink, marginBottom: 12 },
  practiceAgain: { fontSize: 14, color: colors.inkGhost, marginBottom: 32 },
  comeBack: { fontSize: 16, color: colors.inkMuted },
  suggestedSection: { marginTop: 40 },
  suggestedTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, color: colors.inkGhost, marginBottom: 12 },
  suggestedCard: { backgroundColor: colors.paperDim, padding: 16, borderRadius: 12, marginBottom: 8 },
  suggestedName: { fontSize: 15, fontWeight: '500', color: colors.ink },
  suggestedMeta: { fontSize: 13, color: colors.inkMuted, marginTop: 4 },
})
