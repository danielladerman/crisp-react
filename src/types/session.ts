// src/types/session.ts — Rebuilt for simplified session flow

export type SessionPhase = 'prompt' | 'responding' | 'feedback' | 'marking' | 'done'

export interface Interaction {
  id: string
  session_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  interaction_type: 'response' | 'dive_deeper' | 'feedback' | 'follow_up' | 'fix_attempt'
  audio_url: string | null
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  prompt_text: string
  prompt_type: string
  response_mode: 'text' | 'voice'
  status: 'active' | 'completed'
  suggested_drills: string[] | null
  created_at: string
  updated_at: string
}

export interface Pattern {
  id: string
  user_id: string
  pattern_type: 'strength' | 'weakness'
  pattern_id: string
  description: string
  evidence: Array<{ session_id: string; excerpt: string; date: string }>
  first_detected_at: string
  last_seen_at: string
  status: 'active' | 'resolved'
}

export interface Checkpoint {
  sessionId: string
  phase: SessionPhase
  promptType: string
  promptText: string
  interactions: Interaction[]
  feedbackText: string
}
