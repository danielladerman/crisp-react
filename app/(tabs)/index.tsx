import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { useStreak } from '../../src/hooks/useStreak'
import { usePromptEngine } from '../../src/hooks/usePromptEngine'
import { useWeaknessSRS } from '../../src/hooks/useWeaknessSRS'
import { DEFAULT_PROMPTS } from '../../src/lib/prompts'
import { getPersonalizedPrompts } from '../../src/lib/intakeMapping'
import { getVoiceModel, getSessionCount, getTodaySession, getFocusMode, setFocusMode } from '../../src/lib/storage'
import type { FocusMode } from '../../src/lib/storage'
import { loadCheckpoint, clearCheckpoint, SESSION_KEY } from '../../src/lib/sessionCheckpoint'
import { colors } from '../../src/lib/theme'

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { streak } = useStreak(user?.id)
  const { weaknesses } = useWeaknessSRS(user?.id)

  const [sessionCount, setSessionCount] = useState(0)
  const [todaySession, setTodaySession] = useState<any>(null)
  const [voiceModel, setVoiceModel] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [checkpoint, setCheckpoint] = useState<any>(null)
  const [focusMode, setFocusModeState] = useState<FocusMode>('mixed')

  const { selectPrompt } = usePromptEngine({
    userId: user?.id,
    voiceModel,
    sessionCount,
    weaknessSRS: weaknesses || [],
  })

  useEffect(() => {
    if (!user?.id) return
    async function load() {
      try {
        const count = await getSessionCount(user!.id)
        setSessionCount(count)
        const today = await getTodaySession(user!.id)
        setTodaySession(today)
        if (count >= 5) {
          const vm = await getVoiceModel(user!.id)
          setVoiceModel(vm)
        }
        const cp = await loadCheckpoint(SESSION_KEY)
        setCheckpoint(cp)
        const fm = await getFocusMode()
        setFocusModeState(fm)
      } catch (err) {
        if (__DEV__) console.error('Home data load:', err)
      }
      setPageLoading(false)
    }
    load()
  }, [user?.id])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || ''

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const handleStartSession = useCallback(async (mode = 'daily') => {
    if (mode === 'prep') {
      router.push('/prep')
      return
    }

    setLoading(true)
    try {
      let prompt: any

      if (sessionCount < 5) {
        const intakeData = user?.user_metadata?.intake_answers
        if (intakeData) {
          const personalizedSequence = getPersonalizedPrompts(intakeData)
          const idx = Math.min(sessionCount, personalizedSequence.length - 1)
          prompt = personalizedSequence[idx]
        } else {
          const types = ['reveal', 'pressure', 'reveal', 'story']
          const typeIndex = Math.min(sessionCount - 1, types.length - 1)
          const type = types[typeIndex]
          const pool = DEFAULT_PROMPTS[type] || DEFAULT_PROMPTS.reveal
          const text = pool[Math.floor(Math.random() * pool.length)]
          prompt = { promptType: type, promptText: text }
        }
      } else {
        prompt = await selectPrompt()
      }

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
      console.error('Failed to start session:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionCount, user, selectPrompt, focusMode])

  const handleResumeCheckpoint = useCallback(() => {
    if (!checkpoint) return
    router.push({
      pathname: '/session',
      params: {
        promptType: checkpoint.promptType,
        promptText: checkpoint.promptText,
        sessionCount: String(sessionCount),
        checkpointId: checkpoint.sessionId,
      },
    })
  }, [checkpoint, sessionCount])

  const handleDismissCheckpoint = useCallback(async () => {
    await clearCheckpoint(SESSION_KEY)
    setCheckpoint(null)
  }, [])

  const handleFocusMode = useCallback(async (mode: FocusMode) => {
    const prev = focusMode
    setFocusModeState(mode)
    try {
      await setFocusMode(mode)
    } catch {
      setFocusModeState(prev)
    }
  }, [focusMode])

  if (pageLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.inkGhost} />
      </View>
    )
  }

  // Already practiced today
  if (todaySession?.completed) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.logo}>CRISP</Text>
            {streak && <Text style={styles.streakBadge}>{streak.current_streak}d</Text>}
          </View>

          <View style={styles.centerContent}>
            <Text style={styles.doneText}>You practiced today.</Text>

            <TouchableOpacity onPress={() => handleStartSession()}>
              <Text style={styles.practiceAgain}>Or practice again →</Text>
            </TouchableOpacity>

            {todaySession.marked_moment && (
              <Text style={styles.markedMoment}>"{todaySession.marked_moment}"</Text>
            )}

            <Text style={styles.comeBack}>Come back tomorrow.</Text>
          </View>
        </ScrollView>
      </View>
    )
  }

  // Ready to practice
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            onPress={() => handleStartSession()}
            disabled={loading}
          >
            <Text style={styles.startButtonText}>
              {loading ? 'Preparing...' : "Begin today's session"}
            </Text>
          </TouchableOpacity>

          {sessionCount >= 5 && (
            <TouchableOpacity onPress={() => handleStartSession('prep')} style={{ marginTop: 24 }}>
              <Text style={styles.prepLink}>Prep for something →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Checkpoint recovery */}
        {checkpoint && (
          <View style={styles.checkpointCard}>
            <TouchableOpacity onPress={handleResumeCheckpoint} style={styles.checkpointContent}>
              <Text style={styles.checkpointTitle}>Interrupted session</Text>
              <Text style={styles.checkpointPreview} numberOfLines={2}>
                {checkpoint.promptText?.slice(0, 80)}{checkpoint.promptText?.length > 80 ? '...' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDismissCheckpoint} style={styles.checkpointDismiss}>
              <Text style={styles.checkpointDismissText}>✕</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 80,
  },
  logo: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 3,
    color: colors.ink,
  },
  streakBadge: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gold,
  },
  centerContent: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 20,
    color: colors.ink,
    marginBottom: 8,
  },
  readyText: {
    fontSize: 20,
    color: colors.ink,
    marginBottom: 48,
  },
  focusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  focusChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.paperDeep,
  },
  focusChipActive: {
    backgroundColor: colors.ink,
  },
  focusChipText: {
    fontSize: 13,
    color: colors.inkGhost,
  },
  focusChipTextActive: {
    color: colors.paper,
  },
  startButton: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  startButtonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
  prepLink: {
    fontSize: 14,
    color: colors.inkGhost,
  },
  doneText: {
    fontSize: 16,
    color: colors.ink,
    marginBottom: 12,
  },
  practiceAgain: {
    fontSize: 14,
    color: colors.inkGhost,
    marginBottom: 32,
  },
  markedMoment: {
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 28,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  comeBack: {
    fontSize: 16,
    color: colors.inkMuted,
  },
  checkpointCard: {
    marginTop: 40,
    backgroundColor: colors.paperDeep,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkpointContent: {
    flex: 1,
    padding: 16,
  },
  checkpointTitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 4,
  },
  checkpointPreview: {
    fontSize: 14,
    color: colors.inkGhost,
    lineHeight: 20,
  },
  checkpointDismiss: {
    padding: 12,
  },
  checkpointDismissText: {
    fontSize: 12,
    color: colors.inkGhost,
  },
})
