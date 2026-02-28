import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { validateVoiceModel } from './voiceModelValidation'

function localDateString(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

// Sessions
export async function createSession({ userId, promptType, promptText, responseMode = 'text', sessionMode = 'daily', sessionNumber = null }) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      prompt_type: promptType,
      prompt_text: promptText,
      response_mode: responseMode,
      session_mode: sessionMode,
      session_number: sessionNumber,
      completed: false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSession(sessionId, updates) {
  const columnMap = {
    responseText: 'response_text',
    feedbackEcho: 'feedback_echo',
    feedbackName: 'feedback_name',
    feedbackOpen: 'feedback_open',
    markedMoment: 'marked_moment',
    frameworkUsed: 'framework_used',
    durationSeconds: 'duration_seconds',
    feedbackDrill: 'feedback_drill',
    drillResponse: 'drill_response',
    drillSkipped: 'drill_skipped',
    deepDiveExchanges: 'deep_dive_exchanges',
    markExplanation: 'mark_explanation',
    weaknessTargeted: 'weakness_targeted',
    qualitySignal: 'quality_signal',
    sessionNumber: 'session_number',
    sessionMode: 'session_mode',
    secondaryCapture: 'secondary_capture',
  }

  const mapped = {}
  for (const [key, value] of Object.entries(updates)) {
    const col = columnMap[key] || key
    mapped[col] = value
  }

  const { error } = await supabase
    .from('sessions')
    .update(mapped)
    .eq('id', sessionId)

  if (error) throw error
}

export async function getRecentSessions(userId, limit = 10) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getTodaySession(userId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

export async function getIncompleteSession(userId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

export async function getSessionCount(userId) {
  const { count, error } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)

  if (error) throw error
  return count || 0
}

// Voice Model
export async function getVoiceModel(userId) {
  const { data, error } = await supabase
    .from('voice_models')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data?.model || null
}

export async function upsertVoiceModel(userId, model, sessionCount) {
  const { valid, errors } = validateVoiceModel(model)
  if (!valid) {
    console.error('Voice model validation failed, keeping existing model:', errors)
    return
  }

  const { error } = await supabase
    .from('voice_models')
    .upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
      session_count: sessionCount,
      model,
    })

  if (error) throw error
}

// Library
export async function addToLibrary({ userId, sessionId, markedText, promptText, aiObservation, promptType, markExplanation = null, secondaryCapture = null, sessionNumber = null }) {
  const { data, error } = await supabase
    .from('library')
    .insert({
      user_id: userId,
      session_id: sessionId,
      marked_text: markedText,
      prompt_text: promptText,
      ai_observation: aiObservation,
      prompt_type: promptType,
      mark_explanation: markExplanation,
      secondary_capture: secondaryCapture,
      session_number: sessionNumber,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateLibraryEntry(entryId, userId, updates) {
  const columnMap = {
    markedText: 'marked_text',
    markExplanation: 'mark_explanation',
    secondaryCapture: 'secondary_capture',
  }

  const mapped = { updated_at: new Date().toISOString() }
  for (const [key, value] of Object.entries(updates)) {
    const col = columnMap[key] || key
    mapped[col] = value
  }

  const { error } = await supabase
    .from('library')
    .update(mapped)
    .eq('id', entryId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function deleteLibraryEntry(entryId, userId) {
  const { error } = await supabase
    .from('library')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getLibrary(userId) {
  const { data, error } = await supabase
    .from('library')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getLibraryFiltered(userId, filter = 'all') {
  if (filter === 'all') {
    return getLibrary(userId)
  }

  if (filter === 'breakthroughs') {
    const { data, error } = await supabase
      .from('library')
      .select('*, sessions!inner(quality_signal)')
      .eq('user_id', userId)
      .eq('sessions.quality_signal', 'breakthrough')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  if (filter === 'prep') {
    const { data, error } = await supabase
      .from('library')
      .select('*')
      .eq('user_id', userId)
      .eq('prompt_type', 'prep')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  return getLibrary(userId)
}

// Streaks
export async function getStreak(userId) {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || { current_streak: 0, longest_streak: 0, last_practiced_date: null, freeze_count: 2 }
}

export async function updateStreak(userId) {
  const streak = await getStreak(userId)
  const today = localDateString()

  if (streak.last_practiced_date === today) {
    return streak
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = new Intl.DateTimeFormat('en-CA').format(yesterday)

  let newStreak = streak.current_streak
  if (streak.last_practiced_date === yesterdayStr) {
    newStreak += 1
  } else if (streak.last_practiced_date) {
    // Missed a day — check for freeze
    const daysBetween = Math.floor(
      (new Date(today).getTime() - new Date(streak.last_practiced_date).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysBetween <= 2 && streak.freeze_count > 0) {
      newStreak += 1
      streak.freeze_count -= 1
    } else {
      newStreak = 1
    }
  } else {
    newStreak = 1
  }

  const longestStreak = Math.max(streak.longest_streak, newStreak)

  const { data, error } = await supabase
    .from('streaks')
    .upsert({
      user_id: userId,
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_practiced_date: today,
      freeze_count: streak.freeze_count,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Weakness SRS
export async function getWeaknessSRS(userId) {
  const { data, error } = await supabase
    .from('weakness_srs')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error
  return data || []
}

export async function upsertWeaknessSRS(userId, weaknessId, updates) {
  const { error } = await supabase
    .from('weakness_srs')
    .upsert({
      user_id: userId,
      weakness_id: weaknessId,
      ...updates,
    })

  if (error) throw error
}

export async function getActiveWeaknesses(userId) {
  const { data, error } = await supabase
    .from('weakness_srs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error
  return data || []
}

// Prep Sessions
export async function createPrepSession({ userId, situationType, situationDescription }) {
  const { data, error } = await supabase
    .from('prep_sessions')
    .insert({
      user_id: userId,
      situation_type: situationType,
      situation_description: situationDescription,
      completed: false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePrepSession(prepId, updates) {
  const columnMap = {
    prepExchanges: 'prep_exchanges',
    keyMessages: 'key_messages',
    situationType: 'situation_type',
    situationDescription: 'situation_description',
  }

  const mapped = {}
  for (const [key, value] of Object.entries(updates)) {
    const col = columnMap[key] || key
    mapped[col] = value
  }

  const { error } = await supabase
    .from('prep_sessions')
    .update(mapped)
    .eq('id', prepId)

  if (error) throw error
}

export async function getPrepSessions(userId, limit = 10) {
  const { data, error } = await supabase
    .from('prep_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

export async function getPrepSession(prepId) {
  const { data, error } = await supabase
    .from('prep_sessions')
    .select('*')
    .eq('id', prepId)
    .single()

  if (error) throw error
  return data
}

// Notification Log
export async function logNotification({ userId, promptText }) {
  const { error } = await supabase
    .from('notification_log')
    .insert({
      user_id: userId,
      prompt_text: promptText,
    })

  if (error) throw error
}

export async function getRecentNotifications(userId, limit = 10) {
  const { data, error } = await supabase
    .from('notification_log')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

// ── Intake Answers ──────────────────────────────

export async function saveIntakeAnswers(answers) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.auth.updateUser({
    data: { ...user?.user_metadata, intake_answers: answers },
  })
  if (error) throw error
}

// ── Workout Library ──────────────────────────────

const TODAY_WORKOUT_KEY = 'crisp_today_workout'

export async function saveTodayWorkout(drillName: string) {
  const date = localDateString()
  await AsyncStorage.setItem(TODAY_WORKOUT_KEY, JSON.stringify({ drillName, date }))
}

export async function loadTodayWorkout() {
  try {
    const raw = await AsyncStorage.getItem(TODAY_WORKOUT_KEY)
    if (!raw) return null
    const { drillName, date } = JSON.parse(raw)
    const today = localDateString()
    return date === today ? { drill_name: drillName } : null
  } catch {
    return null
  }
}

export async function createWorkoutSession({ userId, drillId, drillName, category, difficulty, durationSeconds, notes = null }) {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId,
      drill_id: drillId,
      drill_name: drillName,
      category,
      difficulty,
      duration_seconds: durationSeconds,
      notes,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function upsertWorkoutProgress(userId, drillId) {
  const { data: existing } = await supabase
    .from('workout_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('drill_id', drillId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('workout_progress')
      .update({
        times_completed: existing.times_completed + 1,
        last_completed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('drill_id', drillId)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('workout_progress')
      .insert({
        user_id: userId,
        drill_id: drillId,
        times_completed: 1,
        last_completed_at: new Date().toISOString(),
        unlocked_at: new Date().toISOString(),
        difficulty_unlocked: 'foundational',
      })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function getAllWorkoutProgress(userId) {
  const { data, error } = await supabase
    .from('workout_progress')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export async function getWorkoutSessionCount(userId, category = null) {
  let query = supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (category) {
    query = query.eq('category', category)
  }
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

export async function getCategoryCompletions(userId) {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('category')
    .eq('user_id', userId)
  if (error) throw error
  const counts = {}
  ;(data || []).forEach(row => {
    counts[row.category] = (counts[row.category] || 0) + 1
  })
  return counts
}
