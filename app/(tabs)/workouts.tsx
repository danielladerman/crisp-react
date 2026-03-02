import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useAuth } from '../../src/hooks/useAuth'
import {
  CATEGORIES, getDrillsByCategory, getDrillById,
} from '../../src/lib/drills'
import {
  createWorkoutSession, upsertWorkoutProgress, getVoiceModel,
  upsertVoiceModel, getCategoryCompletions, getSessionCount,
  getRecentSessions,
} from '../../src/lib/storage'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors } from '../../src/lib/theme'

type ViewState = 'grid' | 'category' | 'drill' | 'active' | 'complete'

export default function WorkoutsScreen() {
  const { user } = useAuth()
  const [view, setView] = useState<ViewState>('grid')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDrill, setSelectedDrill] = useState<any>(null)
  const [response, setResponse] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggestedDrills, setSuggestedDrills] = useState<string[]>([])

  // Load suggested drills from most recent session
  useEffect(() => {
    if (!user?.id) return
    getRecentSessions(user.id, 1).then(sessions => {
      if (sessions[0]?.suggested_drills) {
        setSuggestedDrills(sessions[0].suggested_drills)
      }
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
      // Save today's workout to AsyncStorage
      await AsyncStorage.setItem('crisp_today_workout', JSON.stringify({
        name: selectedDrill.name,
        date: new Date().toISOString().slice(0, 10),
      }))
      setView('complete')
    } catch (err) {
      console.error('Failed to save workout:', err)
    } finally {
      setSaving(false)
    }
  }, [user, selectedDrill, response, notes])

  // --- Drill active phase ---
  if (view === 'active' && selectedDrill) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
    )
  }

  // --- Drill complete ---
  if (view === 'complete' && selectedDrill) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.completeTitle}>Drill complete.</Text>
        <Text style={styles.completeSubtitle}>{selectedDrill.name}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => { setSelectedDrill(null); setView('grid') }}
        >
          <Text style={styles.buttonText}>Back to Library</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // --- Category view ---
  if (view === 'category' && selectedCategory) {
    return (
      <View style={styles.container}>
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
      </View>
    )
  }

  // --- Grid view ---
  return (
    <View style={styles.container}>
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
    </View>
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
    paddingTop: 60,
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
})
