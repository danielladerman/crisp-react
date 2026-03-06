// src/lib/storage.ts — Data layer for CRISP (rebuilt for chat-log schema)

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import type { Session, Interaction, Pattern } from '../types/session'

function localDateString(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}

// ── Sessions ────────────────────────────────────

export async function createSession({
  userId, promptType, promptText, responseMode = 'text',
}: {
  userId: string; promptType: string; promptText: string; responseMode?: 'text' | 'voice'
}): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      prompt_type: promptType,
      prompt_text: promptText,
      response_mode: responseMode,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error
  return data as Session
}

export async function updateSession(sessionId: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from('sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw error
}

export async function getSession(sessionId: string): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (error) throw error
  return data as Session
}

export async function getRecentSessions(userId: string, limit = 10): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as Session[]
}

export async function getTodaySession(userId: string): Promise<Session | null> {
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
  return (data?.[0] as Session) || null
}

export async function getSessionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (error) throw error
  return count || 0
}

// ── Interactions (Chat Log) ─────────────────────

export async function addInteraction({
  sessionId, userId, role, content, interactionType, audioUrl = null,
}: {
  sessionId: string
  userId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  interactionType: Interaction['interaction_type']
  audioUrl?: string | null
}): Promise<Interaction> {
  const { data, error } = await supabase
    .from('interactions')
    .insert({
      session_id: sessionId,
      user_id: userId,
      role,
      content,
      interaction_type: interactionType,
      audio_url: audioUrl,
    })
    .select()
    .single()

  if (error) throw error
  return data as Interaction
}

export async function getSessionInteractions(sessionId: string): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as Interaction[]
}

export async function getRecentInteractions(userId: string, limit = 50): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as Interaction[]
}

// ── Patterns ────────────────────────────────────

export async function upsertPattern(
  userId: string,
  pattern: { pattern_type: string; pattern_id: string; description: string; evidence_excerpt: string },
  sessionId: string,
) {
  const evidence = { session_id: sessionId, excerpt: pattern.evidence_excerpt, date: new Date().toISOString() }

  // Check if pattern already exists
  const { data: existing } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_id', pattern.pattern_id)
    .maybeSingle()

  if (existing) {
    const updatedEvidence = [...(existing.evidence || []), evidence].slice(-10) // keep last 10
    const { error } = await supabase
      .from('patterns')
      .update({
        description: pattern.description,
        evidence: updatedEvidence,
        last_seen_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('patterns')
      .insert({
        user_id: userId,
        pattern_type: pattern.pattern_type,
        pattern_id: pattern.pattern_id,
        description: pattern.description,
        evidence: [evidence],
      })
    if (error) throw error
  }
}

export async function getPatterns(userId: string): Promise<Pattern[]> {
  const { data, error } = await supabase
    .from('patterns')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })

  if (error) throw error
  return (data || []) as Pattern[]
}

// ── Audio Upload ────────────────────────────────

export async function uploadAudio(userId: string, audioUri: string): Promise<string> {
  const filename = `${userId}/${Date.now()}.m4a`
  const response = await fetch(audioUri)
  const blob = await response.blob()

  const { error } = await supabase.storage
    .from('audio')
    .upload(filename, blob, { contentType: 'audio/m4a' })
  if (error) throw error

  const { data } = supabase.storage.from('audio').getPublicUrl(filename)
  return data.publicUrl
}

// ── Voice Model ─────────────────────────────────

export async function getVoiceModel(userId: string) {
  const { data, error } = await supabase
    .from('voice_models')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data?.model_data || null
}

export async function upsertVoiceModel(userId: string, model: Record<string, unknown>, sessionCount: number) {
  const { error } = await supabase
    .from('voice_models')
    .upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
      session_count: sessionCount,
      model_data: model,
    })

  if (error) throw error
}

// ── Library ─────────────────────────────────────

export async function addToLibrary({
  userId, sessionId, markedText, promptText, aiObservation, promptType, source = 'session',
}: {
  userId: string; sessionId?: string; markedText: string; promptText: string
  aiObservation: string; promptType: string; source?: 'session' | 'manual'
}) {
  const row: Record<string, unknown> = {
    user_id: userId,
    marked_text: markedText,
    prompt_text: promptText,
    ai_observation: aiObservation,
    prompt_type: promptType,
    source,
  }
  if (sessionId) row.session_id = sessionId

  const { data, error } = await supabase
    .from('library')
    .insert(row)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function toggleLibraryPin(entryId: string, userId: string, pinned: boolean) {
  const { error } = await supabase
    .from('library')
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function updateLibraryEntry(entryId: string, userId: string, updates: Record<string, unknown>) {
  const columnMap: Record<string, string> = {
    markedText: 'marked_text',
  }

  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() }
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

export async function deleteLibraryEntry(entryId: string, userId: string) {
  const { error } = await supabase
    .from('library')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getLibrary(userId: string) {
  const { data, error } = await supabase
    .from('library')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getLibraryFiltered(userId: string, filter = 'all') {
  if (filter === 'pinned') {
    const { data, error } = await supabase
      .from('library')
      .select('*')
      .eq('user_id', userId)
      .eq('pinned', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  return getLibrary(userId)
}

// ── Streaks ─────────────────────────────────────

export async function getStreak(userId: string) {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || { current_streak: 0, longest_streak: 0, last_practice_date: null, freeze_count: 2 }
}

export async function updateStreak(userId: string) {
  const streak = await getStreak(userId)
  const today = localDateString()

  if (streak.last_practice_date === today) return streak

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = new Intl.DateTimeFormat('en-CA').format(yesterday)

  let newStreak = streak.current_streak
  if (streak.last_practice_date === yesterdayStr) {
    newStreak += 1
  } else if (streak.last_practice_date) {
    const daysBetween = Math.floor(
      (new Date(today).getTime() - new Date(streak.last_practice_date).getTime()) / (1000 * 60 * 60 * 24)
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
      last_practice_date: today,
      freeze_count: streak.freeze_count,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Focus Mode ──────────────────────────────────

const FOCUS_MODE_KEY = 'crisp_focus_mode'
export type FocusMode = 'professional' | 'relational' | 'mixed'

export async function getFocusMode(): Promise<FocusMode> {
  try {
    const val = await AsyncStorage.getItem(FOCUS_MODE_KEY)
    if (val === 'professional' || val === 'relational' || val === 'mixed') return val
  } catch (err) {
    if (__DEV__) console.error('getFocusMode failed:', err)
  }
  return 'mixed'
}

export async function setFocusMode(mode: FocusMode) {
  await AsyncStorage.setItem(FOCUS_MODE_KEY, mode)
}

// ── Intake Answers ──────────────────────────────

export async function saveIntakeAnswers(answers: Record<string, string>) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.auth.updateUser({
    data: { ...user?.user_metadata, intake_answers: answers },
  })
  if (error) throw error
}

// ── Workout Library ─────────────────────────────

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
  } catch (err) {
    if (__DEV__) console.error('loadTodayWorkout failed:', err)
    return null
  }
}

export async function createWorkoutSession({
  userId, drillId, drillName, category, difficulty, durationSeconds, notes = null,
}: {
  userId: string; drillId: string; drillName: string; category: string
  difficulty: string; durationSeconds: number; notes?: string | null
}) {
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

export async function upsertWorkoutProgress(userId: string, drillId: string) {
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

export async function getAllWorkoutProgress(userId: string) {
  const { data, error } = await supabase
    .from('workout_progress')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export async function getWorkoutSessionCount(userId: string, category: string | null = null) {
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

export async function getCategoryCompletions(userId: string) {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('category')
    .eq('user_id', userId)
  if (error) throw error
  const counts: Record<string, number> = {}
  ;(data || []).forEach((row: { category: string }) => {
    counts[row.category] = (counts[row.category] || 0) + 1
  })
  return counts
}
