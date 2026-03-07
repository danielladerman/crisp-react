// app/(tabs)/index.tsx — Home screen (rebuilt)
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { useStreak } from '../../src/hooks/useStreak'
// Dynamic import — expo-haptics is native-only
let Haptics: any = null
try { Haptics = require('expo-haptics') } catch {}
import { DEFAULT_PROMPTS, PROMPT_SELECTION_SYSTEM_PROMPT, CONTINUATION_PROMPT_SYSTEM_PROMPT } from '../../src/lib/prompts'
import { getPersonalizedPrompts } from '../../src/lib/intakeMapping'
import { getDrillById, WEAKNESS_TO_DRILL } from '../../src/lib/drills'
import { callClaude } from '../../src/lib/claude'
import {
  getVoiceModel, getSessionCount, getTodaySession, getRecentSessions,
  getFocusMode, setFocusMode, getAllWorkoutProgress, getPatterns,
  getSessionInteractions,
} from '../../src/lib/storage'
import type { FocusMode } from '../../src/lib/storage'
import { colors } from '../../src/lib/theme'

function formatSessionSummary(session: any, lastUserContent: string): string {
  const date = new Date(session.created_at)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  let dateLabel: string
  if (diffDays === 0) dateLabel = 'Today'
  else if (diffDays === 1) dateLabel = 'Yesterday'
  else if (diffDays < 7) dateLabel = date.toLocaleDateString('en-US', { weekday: 'long' })
  else dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const content = lastUserContent.length > 60
    ? lastUserContent.substring(0, 57) + '...'
    : lastUserContent

  return `${dateLabel}: ${content}`
}

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { streak } = useStreak(user?.id)

  const [sessionCount, setSessionCount] = useState(0)
  const [todaySession, setTodaySession] = useState<any>(null)
  const [todayActiveSession, setTodayActiveSession] = useState<any>(null)
  const [lastSession, setLastSession] = useState<any>(null)
  const [lastSessionSummary, setLastSessionSummary] = useState('')
  const [voiceModel, setVoiceModel] = useState<any>(null)
  const [suggestedDrills, setSuggestedDrills] = useState<string[]>([])
  const [drillRationales, setDrillRationales] = useState<Record<string, string>>({})
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
      setTodayActiveSession(today?.status === 'active' ? today : null)

      if (count >= 1) {
        const vm = await getVoiceModel(user.id)
        setVoiceModel(vm)
      }

      // Fetch last completed session for "pick up where you left off"
      const recent = await getRecentSessions(user.id, 10)
      const lastCompleted = recent.find((s: any) => s.status === 'completed')
      setLastSession(lastCompleted || null)
      if (lastCompleted) {
        try {
          const ints = await getSessionInteractions(lastCompleted.id)
          const lastUserMsg = [...ints].reverse().find((i: any) => i.role === 'user')
          const summary = formatSessionSummary(lastCompleted, lastUserMsg?.content || lastCompleted.prompt_text)
          setLastSessionSummary(summary)
        } catch {
          setLastSessionSummary('')
        }
      } else {
        setLastSessionSummary('')
      }

      // Aggregate suggested drills across recent sessions, ranked by frequency
      const drillCounts: Record<string, number> = {}
      for (const sess of recent) {
        if (sess.suggested_drills) {
          for (const id of sess.suggested_drills) {
            drillCounts[id] = (drillCounts[id] || 0) + 1
          }
        }
      }
      const sorted = Object.entries(drillCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
      if (sorted.length > 0) {
        const progress = await getAllWorkoutProgress(user.id)
        const completedIds = new Set(progress.map((p: any) => p.drill_id))
        const filtered = sorted.filter(id => !completedIds.has(id)).slice(0, 3)
        setSuggestedDrills(filtered)

        // Build rationale map: drill_id → "Targets your X pattern"
        if (filtered.length > 0) {
          try {
            const userPatterns = await getPatterns(user.id)
            const weaknesses = userPatterns.filter(p => p.pattern_type === 'weakness' && p.status === 'active')
            // Reverse map: drill_id → weakness pattern_id
            const drillToWeakness: Record<string, string> = {}
            for (const [weaknessId, drillId] of Object.entries(WEAKNESS_TO_DRILL)) {
              drillToWeakness[drillId] = weaknessId
            }
            const rationales: Record<string, string> = {}
            for (const drillId of filtered) {
              const weaknessId = drillToWeakness[drillId]
              if (weaknessId) {
                const match = weaknesses.find(w => w.pattern_id === weaknessId)
                if (match) {
                  const evidenceCount = match.evidence?.length || 0
                  rationales[drillId] = `Targets your ${weaknessId.replace(/-/g, ' ')} pattern${evidenceCount > 1 ? ` (seen ${evidenceCount} times)` : ''}`
                }
              }
            }
            setDrillRationales(rationales)
          } catch (err) {
            if (__DEV__) console.error('Failed to build drill rationales:', err)
          }
        }
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

  // Re-fetch when tab gains focus (e.g. after completing a session)
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return
      loadHomeData()
    }, [loadHomeData, user?.id])
  )

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

  // "Pick up where you left off" — generate a continuation prompt from last session
  const handleContinueThread = useCallback(async () => {
    if (!lastSession) return
    setLoading(true)
    try {
      let prompt: { promptType: string; promptText: string } | null = null

      // Get the last user message from the previous session for context
      const ints = await getSessionInteractions(lastSession.id)
      const lastUserMsg = [...ints].reverse().find((i: any) => i.role === 'user')
      const previousContext = `Previous session prompt: ${lastSession.prompt_text}\n\nUser's last response: ${lastUserMsg?.content || '(no response)'}`

      try {
        const result = await callClaude({
          systemPrompt: CONTINUATION_PROMPT_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: voiceModel
              ? `${previousContext}\n\nVoice model:\n${JSON.stringify(voiceModel, null, 2)}`
              : previousContext,
          }],
          maxTokens: 300,
        })
        const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        prompt = JSON.parse(cleaned)
      } catch (err) {
        if (__DEV__) console.error('Continuation prompt generation failed:', err)
      }

      // Fallback: simple continuation
      if (!prompt) {
        const topic = lastSession.prompt_text.length > 60
          ? lastSession.prompt_text.substring(0, 60) + '...'
          : lastSession.prompt_text
        prompt = {
          promptType: 'continuation',
          promptText: `Last time you explored: "${topic}" — what's still unresolved for you?`,
        }
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
      if (__DEV__) console.error('Failed to continue thread:', err)
    } finally {
      setLoading(false)
    }
  }, [lastSession, voiceModel, sessionCount, focusMode])

  // Resume today's in-progress session
  const handleResumeSession = useCallback(() => {
    if (!todayActiveSession) return
    router.push({
      pathname: '/session',
      params: {
        resumeSessionId: todayActiveSession.id,
        promptType: todayActiveSession.prompt_type,
        promptText: todayActiveSession.prompt_text,
        sessionCount: String(sessionCount),
        focusMode,
      },
    })
  }, [todayActiveSession, sessionCount, focusMode])

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

  // ── Shared UI fragments ────────────────────────

  const headerBlock = (
    <View style={styles.header}>
      <Text style={styles.logo}>CRISP</Text>
      {streak && <Text style={styles.streakBadge}>{streak.current_streak}d</Text>}
    </View>
  )

  const suggestedDrillsBlock = suggestedDrills.length > 0 ? (
    <View style={styles.suggestedSection}>
      <Text style={styles.suggestedTitle}>SUGGESTED WORKOUTS</Text>
      {suggestedDrills.map(drillId => {
        const drill = getDrillById(drillId)
        if (!drill) return null
        return (
          <TouchableOpacity
            key={drill.id}
            style={styles.suggestedCard}
            onPress={() => router.push({ pathname: '/(tabs)/workouts', params: { drillId: drill.id } })}
          >
            <Text style={styles.suggestedName}>{drill.name}</Text>
            {drillRationales[drill.id] && (
              <Text style={styles.suggestedRationale}>{drillRationales[drill.id]}</Text>
            )}
            <Text style={styles.suggestedMeta}>{drill.category}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  ) : null

  const prepLink = (
    <TouchableOpacity style={styles.prepButton} onPress={() => router.push('/prep')}>
      <Text style={styles.prepButtonText}>Prep for something →</Text>
    </TouchableOpacity>
  )

  const continueThreadButton = lastSession && sessionCount > 0 ? (
    <View style={styles.continueSection}>
      <TouchableOpacity
        style={[styles.continueButton, loading && styles.startButtonDisabled]}
        onPress={handleContinueThread}
        disabled={loading}
      >
        <Text style={styles.continueButtonText}>
          {loading ? 'Preparing...' : 'Pick up where you left off'}
        </Text>
      </TouchableOpacity>
      {lastSessionSummary ? (
        <Text style={styles.continueSummary}>{lastSessionSummary}</Text>
      ) : null}
    </View>
  ) : null

  // ── Branch A: Today's session in progress ─────

  if (todayActiveSession) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.inkGhost} />}>
          {headerBlock}

          <View style={styles.centerContent}>
            <Text style={styles.greeting}>You started a session earlier.</Text>

            <TouchableOpacity
              style={[styles.startButton, { marginTop: 32 }]}
              onPress={handleResumeSession}
            >
              <Text style={styles.startButtonText}>Continue where you left off</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleStartSession}
              disabled={loading}
            >
              <Text style={[styles.secondaryActionText, loading && { opacity: 0.5 }]}>
                {loading ? 'Preparing...' : 'Start a new session'}
              </Text>
            </TouchableOpacity>

            {prepLink}
          </View>

          {suggestedDrillsBlock}
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Branch B: Already completed today ─────────

  if (todaySession?.status === 'completed') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.inkGhost} />}>
          {headerBlock}

          <View style={styles.centerContent}>
            <Text style={styles.doneText}>You practiced today.</Text>
            <Text style={styles.comeBack}>Come back tomorrow.</Text>

            {continueThreadButton}

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleStartSession}
              disabled={loading}
            >
              <Text style={[styles.secondaryActionText, loading && { opacity: 0.5 }]}>
                {loading ? 'Preparing...' : 'Start fresh →'}
              </Text>
            </TouchableOpacity>

            {prepLink}
          </View>

          {suggestedDrillsBlock}
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Branch C/D: No session today ──────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.inkGhost} />}>
        {headerBlock}

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
                  {mode === 'professional' ? 'Professional' : mode === 'relational' ? 'Personal' : 'Mixed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {continueThreadButton}

          <TouchableOpacity
            style={[styles.startButton, loading && styles.startButtonDisabled]}
            onPress={handleStartSession}
            disabled={loading}
          >
            <Text style={styles.startButtonText}>
              {loading ? 'Preparing...' : sessionCount === 0 ? 'Begin session' : "Begin today's session"}
            </Text>
          </TouchableOpacity>

          {prepLink}
        </View>

        {suggestedDrillsBlock}
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
  comeBack: { fontSize: 16, color: colors.inkMuted, marginTop: 4, marginBottom: 24 },
  secondaryAction: { marginTop: 12, paddingVertical: 10, alignItems: 'center' as const },
  secondaryActionText: { fontSize: 14, color: colors.inkMuted },
  continueSection: { marginBottom: 16, alignItems: 'center' as const },
  continueButton: { backgroundColor: colors.paperDim, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' as const },
  continueButtonText: { color: colors.ink, fontSize: 15, fontWeight: '500' as const },
  continueSummary: { fontSize: 13, color: colors.inkGhost, marginTop: 8, fontStyle: 'italic' as const, textAlign: 'center' as const, paddingHorizontal: 16 },
  suggestedSection: { marginTop: 40 },
  suggestedTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, color: colors.inkGhost, marginBottom: 12 },
  suggestedCard: { backgroundColor: colors.paperDim, padding: 16, borderRadius: 12, marginBottom: 8 },
  suggestedName: { fontSize: 15, fontWeight: '500', color: colors.ink },
  suggestedRationale: { fontSize: 13, color: colors.gold, marginTop: 2, fontStyle: 'italic' as const },
  suggestedMeta: { fontSize: 13, color: colors.inkMuted, marginTop: 4 },
})
