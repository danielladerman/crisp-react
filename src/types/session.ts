// src/types/session.ts

export interface Prompt {
  promptType: string
  promptText: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Session {
  id: string
  user_id: string
  prompt_type: string
  prompt_text: string
  response_text: string | null
  completed: boolean
  created_at: string
  [key: string]: unknown
}

export interface Checkpoint {
  sessionId: string
  phase: SessionPhase
  promptType: string
  promptText: string
  feedback: string
  conversationHistory: Message[]
  drillText: string | null
  drillResponse: string
  deepDiveCount: number
  sessionMode: string
  responseText?: string
  markedText?: string
  markExplanation?: string
}

export type SessionPhase =
  | 'idle'
  | 'responding'
  | 'thinking'
  | 'feedback'
  | 'marking'
  | 'explaining'
  | 'drilling'
  | 'quality'
  | 'closed'

export type SessionAction =
  | { type: 'START'; prompt: Prompt; session: Session }
  | { type: 'SUBMIT_RESPONSE'; text: string }
  | { type: 'FEEDBACK_CHUNK'; text: string }
  | { type: 'FEEDBACK_DONE'; fullText: string; drillText: string | null; conversationHistory: Message[] }
  | { type: 'FEEDBACK_ERROR'; error: string }
  | { type: 'GO_DEEPER'; question: string }
  | { type: 'DONE_FEEDBACK' }
  | { type: 'COMPLETE_MARK'; text: string }
  | { type: 'SKIP_MARK' }
  | { type: 'SUBMIT_DRILL'; response: string }
  | { type: 'SKIP_DRILL' }
  | { type: 'SUBMIT_EXPLANATION'; text: string }
  | { type: 'SKIP_EXPLANATION' }
  | { type: 'SUBMIT_QUALITY'; signal: string }
  | { type: 'RETRY' }
  | { type: 'RESTORE_CHECKPOINT'; checkpoint: Checkpoint }
  | { type: 'SET_ERROR'; error: string }

export interface SessionState {
  phase: SessionPhase
  session: Session | null
  prompt: Prompt | null
  responseText: string
  lastResponseText: string
  feedback: string
  feedbackStreaming: boolean
  conversationHistory: Message[]
  deepDiveCount: number
  openQuestion: string | null
  drillText: string | null
  drillResponse: string
  markedMoment: string
  markExplanation: string
  qualitySignal: string | null
  error: string | null
  sessionMode: 'daily' | 'quickrep' | 'prep'
  startTime: number | null
}
