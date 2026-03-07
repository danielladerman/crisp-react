import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../src/hooks/useAuth'
import {
  CATEGORIES, getDrillsByCategory, getDrillById,
} from '../../src/lib/drills'
import {
  createWorkoutSession, upsertWorkoutProgress, getAllWorkoutProgress,
  getRecentSessions, getRecentInteractions, upsertPattern, getPatterns,
  getVoiceModel, upsertVoiceModel, getSessionCount, addToLibrary,
} from '../../src/lib/storage'
import { callClaude } from '../../src/lib/claude'
import { PATTERN_ANALYSIS_PROMPT, VOICE_MODEL_UPDATE_PROMPT, DRILL_FEEDBACK_SYSTEM_PROMPT } from '../../src/lib/prompts'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../../src/lib/theme'

type ViewState = 'grid' | 'category' | 'drill' | 'active' | 'feedback' | 'marking' | 'complete'

export default function WorkoutsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const { drillId: drillIdParam } = useLocalSearchParams<{ drillId?: string }>()
  const [view, setView] = useState<ViewState>('grid')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDrill, setSelectedDrill] = useState<any>(null)
  const [response, setResponse] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggestedDrills, setSuggestedDrills] = useState<string[]>([])
  // Feedback + marking state
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [chunks, setChunks] = useState<string[]>([])
  const [selectedChunks, setSelectedChunks] = useState<Set<number>>(new Set())
  const [aiPicks, setAiPicks] = useState<Set<number>>(new Set())

  // Auto-open a specific drill if passed via route params
  useEffect(() => {
    if (!drillIdParam) return
    const drill = getDrillById(drillIdParam)
    if (drill) {
      setSelectedDrill(drill)
      setSelectedCategory(drill.category)
      setView('active')
    }
  }, [drillIdParam])

  // Aggregate suggested drills across recent sessions, ranked by frequency
  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      getRecentSessions(user.id, 10),
      getAllWorkoutProgress(user.id),
    ]).then(([sessions, progress]) => {
      const drillCounts: Record<string, number> = {}
      for (const sess of sessions) {
        if (sess.suggested_drills) {
          for (const id of sess.suggested_drills) {
            drillCounts[id] = (drillCounts[id] || 0) + 1
          }
        }
      }
      const sorted = Object.entries(drillCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
      const completedIds = new Set(progress.map((p: any) => p.drill_id))
      const filtered = sorted.filter(id => !completedIds.has(id)).slice(0, 3)
      setSuggestedDrills(filtered)
    }).catch(() => {})
  }, [user?.id])

  const drills = selectedCategory ? getDrillsByCategory(selectedCategory) : []
  const category = CATEGORIES.find(c => c.id === selectedCategory)

  const handleStartDrill = useCallback((drill: any) => {
    setSelectedDrill(drill)
    setResponse('')
    setNotes('')
    setView('active')
  }, [])

  const handleCompleteDrill = useCallback(async () => {
    if (!user?.id || !selectedDrill) return
    setSaving(true)
    const combinedNotes = [response, notes].filter(Boolean).join('\n\n---\n\n') || null
    try {
      await createWorkoutSession({
        userId: user.id,
        drillId: selectedDrill.id,
        drillName: selectedDrill.name,
        category: selectedDrill.category,
        difficulty: selectedDrill.difficulty,
        durationSeconds: selectedDrill.duration,
        notes: combinedNotes,
      })
      await upsertWorkoutProgress(user.id, selectedDrill.id)
      await AsyncStorage.setItem('crisp_today_workout', JSON.stringify({
        name: selectedDrill.name,
        date: new Date().toISOString().slice(0, 10),
      }))

      // Transition to feedback view
      setFeedbackText('')
      setFeedbackLoading(true)
      setView('feedback')

      // Fire background tasks (non-blocking)
      runPostDrillTasks(user.id, selectedDrill, response)

      // Get AI feedback on the drill response
      if (response.trim()) {
        try {
          const result = await callClaude({
            systemPrompt: DRILL_FEEDBACK_SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: `Drill: ${selectedDrill.name}\nInstructions: ${selectedDrill.theDrill}\n\nUser's response:\n${response}`,
            }],
            maxTokens: 300,
          })
          setFeedbackText(result)
        } catch (err) {
          if (__DEV__) console.error('Drill feedback failed:', err)
          setFeedbackText('')
        }
      }
      setFeedbackLoading(false)
    } catch (err) {
      if (__DEV__) console.error('Failed to save workout:', err)
    } finally {
      setSaving(false)
    }
  }, [user, selectedDrill, response, notes])

  // Split text into sentence chunks for marking
  function splitIntoChunks(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
  }

  const handleGoToMarking = useCallback(async () => {
    const allChunks = splitIntoChunks(response)
    if (__DEV__) console.log('[workouts:handleGoToMarking] response length:', response.length, 'chunks:', allChunks.length)
    setChunks(allChunks)
    setSelectedChunks(new Set())
    setAiPicks(new Set())
    setView('marking')

    // AI pre-suggest 1-2 strongest moments
    if (allChunks.length > 1) {
      try {
        const numbered = allChunks.map((c, i) => `${i}: ${c}`).join('\n')
        const result = await callClaude({
          systemPrompt: 'You are selecting the most expressive or insightful moments from a user\'s drill response. Return ONLY a JSON array of indices (e.g. [0, 3]). Pick 1-2 strongest moments. No explanation.',
          messages: [{ role: 'user', content: numbered }],
          maxTokens: 50,
        })
        const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
        const indices: number[] = JSON.parse(cleaned)
        const validIndices = indices.filter(i => i >= 0 && i < allChunks.length)
        setAiPicks(new Set(validIndices))
        setSelectedChunks(new Set(validIndices))
      } catch (err) {
        if (__DEV__) console.error('AI pick suggestion failed:', err)
      }
    }
  }, [response])

  const toggleChunk = useCallback((index: number) => {
    setSelectedChunks(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const handleSaveMarkedMoments = useCallback(async () => {
    if (!user?.id || !selectedDrill) return
    const selected = Array.from(selectedChunks).map(i => chunks[i]).filter(Boolean)
    if (__DEV__) console.log('[workouts:handleSaveMarkedMoments] saving', selected.length, 'moments')
    for (const text of selected) {
      try {
        await addToLibrary({
          userId: user.id,
          markedText: text,
          promptText: selectedDrill.theDrill || '',
          aiObservation: '',
          promptType: 'drill',
          source: 'session',
        })
      } catch (err) {
        if (__DEV__) console.error('Failed to save marked moment:', err)
      }
    }
    setView('complete')
  }, [user?.id, selectedDrill, selectedChunks, chunks])

  const handleTestItLive = useCallback(() => {
    if (!selectedDrill) return
    router.push({
      pathname: '/session',
      params: {
        promptType: 'drill_practice',
        promptText: `Practice what you just drilled. ${selectedDrill.theDrill} Now try it in a natural response — as if you were in a real conversation.`,
        sessionCount: '0',
        focusMode: 'mixed',
      },
    })
  }, [selectedDrill])

  // Background tasks after drill completion (non-blocking, same as daily sessions)
  async function runPostDrillTasks(userId: string, drill: any, drillResponse: string) {
    // 1. Pattern analysis
    try {
      const [recentInts, existingPatterns] = await Promise.all([
        getRecentInteractions(userId, 100),
        getPatterns(userId),
      ])
      const context = recentInts
        .filter((i: any) => i.role === 'user')
        .map((i: any) => i.content)
        .join('\n---\n')

      // Include drill response in the analysis
      const fullContext = drillResponse
        ? `Drill: ${drill.name} (${drill.category})\nResponse: ${drillResponse}\n---\n${context}`
        : context

      // Include existing patterns so Claude can reference them instead of creating duplicates
      const existingList = existingPatterns.length > 0
        ? `\n\nALREADY DETECTED PATTERNS (reuse these pattern_ids if the same pattern is observed, do not create duplicates):\n${existingPatterns.map((p: any) => `- ${p.pattern_type}: ${p.pattern_id} — ${p.description}`).join('\n')}`
        : ''

      const result = await callClaude({
        systemPrompt: PATTERN_ANALYSIS_PROMPT,
        messages: [{ role: 'user', content: `Recent user responses across sessions:\n\n${fullContext}${existingList}` }],
        maxTokens: 1000,
      })

      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      if (parsed.patterns && Array.isArray(parsed.patterns)) {
        for (const p of parsed.patterns) {
          await upsertPattern(userId, p, drill.id)
        }
      }
    } catch (err) {
      if (__DEV__) console.error('Post-drill pattern analysis failed:', err)
    }

    // 2. Voice model update
    try {
      const currentModel = await getVoiceModel(userId) || {}
      const count = await getSessionCount(userId)
      const result = await callClaude({
        systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
        messages: [{
          role: 'user',
          content: `CURRENT VOICE MODEL:\n${JSON.stringify(currentModel, null, 2)}\n\nDRILL COMPLETED:\nDrill: ${drill.name}\nCategory: ${drill.category}\nDifficulty: ${drill.difficulty}\nUser Response: ${drillResponse || '(no response recorded)'}\n\nUpdate the voice model. Return only updated JSON.`,
        }],
        maxTokens: 3000,
      })

      const cleaned = result.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const updatedModel = JSON.parse(cleaned)
      await upsertVoiceModel(userId, updatedModel, count)
    } catch (err) {
      if (__DEV__) console.error('Post-drill voice model update failed:', err)
    }
  }

  // --- Drill active phase ---
  if (view === 'active' && selectedDrill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setView('category')}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.drillTitle}>{selectedDrill.name}</Text>
          <Text style={styles.drillInstructions}>{selectedDrill.theDrill}</Text>

          <TextInput
            style={styles.textArea}
            value={response}
            onChangeText={setResponse}
            placeholder="Your response..."
            placeholderTextColor={colors.inkGhost}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.notesLabel}>Reflection notes (optional)</Text>
          <TextInput
            style={[styles.textArea, { minHeight: 80 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="What did you notice?"
            placeholderTextColor={colors.inkGhost}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleCompleteDrill}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Complete'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // --- Drill feedback ---
  if (view === 'feedback' && selectedDrill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.drillTitle}>{selectedDrill.name}</Text>

          {feedbackLoading ? (
            <ActivityIndicator color={colors.inkGhost} style={{ marginVertical: 24 }} />
          ) : feedbackText ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackText}>{feedbackText}</Text>
            </View>
          ) : (
            <Text style={styles.completeSubtitle}>Drill complete.</Text>
          )}

          {!feedbackLoading && (
            <View style={styles.actionRow}>
              {response.trim() && (
                <TouchableOpacity style={styles.button} onPress={handleGoToMarking}>
                  <Text style={styles.buttonText}>Mark moments</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.secondaryButton} onPress={handleTestItLive}>
                <Text style={styles.secondaryButtonText}>Test it live →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setView('complete')}>
                <Text style={styles.secondaryButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    )
  }

  // --- Mark moments from drill ---
  if (view === 'marking' && selectedDrill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.drillTitle}>Mark your moments</Text>
          <Text style={styles.markingSubtitle}>
            Tap any lines that resonated. These go to your library.
          </Text>

          {chunks.map((chunk, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.chunkCard,
                selectedChunks.has(index) && styles.chunkCardSelected,
              ]}
              onPress={() => toggleChunk(index)}
              activeOpacity={0.7}
            >
              <View style={styles.chunkRow}>
                <Text style={[
                  styles.chunkText,
                  selectedChunks.has(index) && styles.chunkTextSelected,
                ]}>
                  {chunk}
                </Text>
                {aiPicks.has(index) && (
                  <Text style={styles.crispPick}>Crisp pick</Text>
                )}
              </View>
              {selectedChunks.has(index) && (
                <Ionicons name="checkmark-circle" size={18} color={colors.gold} style={{ marginTop: 4 }} />
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setView('complete')}>
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </TouchableOpacity>
            {selectedChunks.size > 0 && (
              <TouchableOpacity style={styles.button} onPress={handleSaveMarkedMoments}>
                <Text style={styles.buttonText}>
                  Save {selectedChunks.size} moment{selectedChunks.size > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // --- Drill complete ---
  if (view === 'complete' && selectedDrill) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]} edges={['top']}>
        <Text style={styles.completeTitle}>Drill complete.</Text>
        <Text style={styles.completeSubtitle}>{selectedDrill.name}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.button} onPress={handleTestItLive}>
            <Text style={styles.buttonText}>Test it live</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => { setSelectedDrill(null); setView('grid') }}>
            <Text style={styles.secondaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // --- Category view ---
  if (view === 'category' && selectedCategory) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => setView('grid')}>
            <Text style={styles.backText}>← Library</Text>
          </TouchableOpacity>

          <Text style={styles.categoryTitle}>{category?.name}</Text>
          <Text style={styles.categorySubtitle}>{category?.subtitle}</Text>

          <View style={styles.drillList}>
            {drills.map((drill) => (
              <TouchableOpacity
                key={drill.id}
                style={styles.drillCard}
                onPress={() => handleStartDrill(drill)}
              >
                <Text style={styles.drillName}>{drill.name}</Text>
                <View style={styles.drillMeta}>
                  <Text style={styles.drillDifficulty}>{drill.difficulty}</Text>
                  <Text style={styles.drillDuration}>{Math.ceil(drill.duration / 60)} min</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // --- Grid view ---
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>Workout Library</Text>
        <Text style={styles.pageSubtitle}>Isolated technique practice. Pick a category.</Text>

        {/* Suggested drills from last session */}
        {suggestedDrills.length > 0 && (
          <View style={styles.suggestedSection}>
            <Text style={styles.suggestedTitle}>SUGGESTED FOR YOU</Text>
            {suggestedDrills.map(drillId => {
              const drill = getDrillById(drillId)
              if (!drill) return null
              return (
                <TouchableOpacity
                  key={drill.id}
                  style={styles.suggestedCard}
                  onPress={() => handleStartDrill(drill)}
                >
                  <Text style={styles.suggestedName}>{drill.name}</Text>
                  <Text style={styles.suggestedMeta}>{drill.category} · {drill.difficulty}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        <View style={styles.categoryList}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryCard}
              onPress={() => { setSelectedCategory(cat.id); setView('category') }}
            >
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={styles.categoryName}>{cat.name}</Text>
              </View>
              <Text style={styles.categoryDesc}>{cat.subtitle}</Text>
              <Text style={styles.categoryCount}>
                {getDrillsByCategory(cat.id).length} exercises
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  backText: {
    fontSize: 14,
    color: colors.inkGhost,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 28,
  },
  categoryList: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: colors.paperDim,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
  },
  categoryDesc: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 4,
    marginLeft: 18,
  },
  categoryCount: {
    fontSize: 12,
    color: colors.inkGhost,
    marginTop: 2,
    marginLeft: 18,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  drillList: {
    gap: 12,
  },
  drillCard: {
    backgroundColor: colors.paperDim,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  drillName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 4,
  },
  drillMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  drillDifficulty: {
    fontSize: 12,
    color: colors.inkGhost,
    textTransform: 'capitalize',
  },
  drillDuration: {
    fontSize: 12,
    color: colors.inkGhost,
  },
  drillTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 16,
  },
  drillInstructions: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.inkMuted,
    marginBottom: 24,
  },
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    color: colors.inkGhost,
    marginBottom: 8,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    color: colors.inkMuted,
    marginBottom: 40,
  },
  suggestedSection: {
    marginBottom: 28,
  },
  suggestedTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.gold,
    marginBottom: 12,
  },
  suggestedCard: {
    backgroundColor: colors.paperDim,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  suggestedName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  suggestedMeta: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  feedbackCard: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  actionRow: {
    gap: 12,
    marginTop: 16,
    alignItems: 'center' as const,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
  },
  secondaryButtonText: {
    color: colors.inkMuted,
    fontSize: 15,
  },
  markingSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
    marginBottom: 16,
  },
  chunkCard: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chunkCardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.paperDeep,
  },
  chunkRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  chunkText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    flex: 1,
  },
  chunkTextSelected: {
    fontWeight: '500' as const,
  },
  crispPick: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.gold,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
})
