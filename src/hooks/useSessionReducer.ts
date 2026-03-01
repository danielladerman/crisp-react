// src/hooks/useSessionReducer.ts
import { useReducer } from 'react'
import type { SessionState, SessionAction, SessionPhase } from '../types/session'

const initialState: SessionState = {
  phase: 'idle',
  session: null,
  prompt: null,
  responseText: '',
  lastResponseText: '',
  feedback: '',
  feedbackStreaming: false,
  conversationHistory: [],
  deepDiveCount: 0,
  openQuestion: null,
  drillText: null,
  drillResponse: '',
  markedMoment: '',
  markExplanation: '',
  qualitySignal: null,
  error: null,
  sessionMode: 'daily',
  startTime: null,
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START':
      return {
        ...initialState,
        phase: 'responding',
        prompt: action.prompt,
        session: action.session,
        startTime: Date.now(),
      }

    case 'SUBMIT_RESPONSE':
      return {
        ...state,
        phase: 'thinking',
        responseText: action.text,
        lastResponseText: action.text,
        error: null,
      }

    case 'FEEDBACK_CHUNK':
      return {
        ...state,
        phase: 'thinking', // stay in thinking while streaming
        feedback: action.text,
        feedbackStreaming: true,
      }

    case 'FEEDBACK_DONE':
      return {
        ...state,
        phase: 'feedback',
        feedback: action.fullText,
        feedbackStreaming: false,
        drillText: action.drillText,
        conversationHistory: action.conversationHistory,
      }

    case 'FEEDBACK_ERROR':
      return {
        ...state,
        phase: 'feedback',
        feedbackStreaming: false,
        error: action.error,
      }

    case 'GO_DEEPER': {
      if (state.deepDiveCount >= 10) return state
      return {
        ...state,
        phase: 'responding',
        openQuestion: action.question,
        deepDiveCount: state.deepDiveCount + 1,
        feedback: '',
        error: null,
      }
    }

    case 'DONE_FEEDBACK':
      // ALWAYS go to marking first (fixes B4)
      return {
        ...state,
        phase: 'marking',
      }

    case 'COMPLETE_MARK':
      return {
        ...state,
        markedMoment: action.text,
        // After marking, go to explaining
        phase: 'explaining',
      }

    case 'SKIP_MARK':
      return {
        ...state,
        markedMoment: '',
        // Skip mark -> go to drilling if drill exists, else quality
        phase: state.drillText ? 'drilling' : 'quality',
      }

    case 'SUBMIT_EXPLANATION':
      return {
        ...state,
        markExplanation: action.text,
        // After explaining, go to drilling if drill exists, else quality
        phase: state.drillText ? 'drilling' : 'quality',
      }

    case 'SKIP_EXPLANATION':
      return {
        ...state,
        phase: state.drillText ? 'drilling' : 'quality',
      }

    case 'SUBMIT_DRILL':
      return {
        ...state,
        drillResponse: action.response,
        phase: 'quality',
      }

    case 'SKIP_DRILL':
      return {
        ...state,
        phase: 'quality',
      }

    case 'SUBMIT_QUALITY':
      // This is the ONLY place completed=true should fire (fixes B8)
      return {
        ...state,
        qualitySignal: action.signal,
        phase: 'closed',
      }

    case 'RETRY':
      // Re-enter thinking with stored response (fixes B6)
      return {
        ...state,
        phase: 'thinking',
        error: null,
      }

    case 'RESTORE_CHECKPOINT':
      return {
        ...state,
        phase: action.checkpoint.phase,
        feedback: action.checkpoint.feedback || '',
        conversationHistory: action.checkpoint.conversationHistory || [],
        drillText: action.checkpoint.drillText || null,
        drillResponse: action.checkpoint.drillResponse || '',
        deepDiveCount: action.checkpoint.deepDiveCount || 0,
        sessionMode: (action.checkpoint.sessionMode as SessionState['sessionMode']) || 'daily',
        prompt: {
          promptType: action.checkpoint.promptType,
          promptText: action.checkpoint.promptText,
        },
        responseText: action.checkpoint.responseText || '',
        lastResponseText: action.checkpoint.responseText || '',
        markedMoment: action.checkpoint.markedText || '',
        markExplanation: action.checkpoint.markExplanation || '',
      }

    case 'SET_SESSION':
      return {
        ...state,
        session: action.session,
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
      }

    default:
      return state
  }
}

export function useSessionReducer() {
  return useReducer(sessionReducer, initialState)
}

// Export for testing
export { sessionReducer, initialState }
