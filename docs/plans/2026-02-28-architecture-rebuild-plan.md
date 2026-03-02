# CRISP Architecture Rebuild — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild CRISP's session architecture around a typed state machine and shared component library, fixing 18 bugs and enabling missing UX features.

**Architecture:** `useReducer` state machine for session flow, extracted phase components, shared UI primitives with design tokens from `theme.ts`. Side effects separated from state transitions.

**Tech Stack:** Expo 55, React 19, Expo Router, TypeScript, Supabase, RevenueCat (dynamic import), @expo/vector-icons

---

## Phase 1: Get It Running

### Task 1: Fix B1 — RevenueCat crashes Expo Go

**Files:**
- Modify: `src/hooks/useSubscription.ts:1-2`

**Step 1: Replace the static import with a dynamic require**

Replace lines 1-2 of `src/hooks/useSubscription.ts`:

```typescript
// OLD:
import { useState, useEffect, useCallback } from 'react'
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases'

// NEW:
import { useState, useEffect, useCallback } from 'react'
import { Platform } from 'react-native'

// Dynamic import — react-native-purchases is a native module that crashes Expo Go
let Purchases: any = null
let PurchasesLoaded = false

try {
  Purchases = require('react-native-purchases').default
  PurchasesLoaded = true
} catch {
  // Running in Expo Go or native module unavailable — fail open
}
```

Also remove the duplicate `Platform` import on line 3 (it's already imported above now).

Remove the type imports `PurchasesPackage` and `CustomerInfo` from the import — replace usages with `any` for now (these types don't exist without the native module). In `packages` state, change type to `any[]`. In `checkSubscription`, `purchase`, and `restore` functions, remove the `: CustomerInfo` and `: PurchasesPackage` type annotations.

Add a guard at the top of the `init` function (line 17):

```typescript
async function init() {
  if (!PurchasesLoaded) {
    // Native module not available (Expo Go) — fail open
    setIsSubscribed(true)
    setLoading(false)
    return
  }
  // ... rest of existing init code
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to useSubscription.ts

**Step 3: Commit**

```bash
git add src/hooks/useSubscription.ts
git commit -m "fix(B1): dynamic import for RevenueCat to prevent Expo Go crash"
```

---

### Task 2: Fix B9 — .env not in .gitignore

**Files:**
- Modify: `.gitignore:34`

**Step 1: Add .env to gitignore**

After line 34 (`# local env files`), change:

```
# local env files
.env*.local
```

to:

```
# local env files
.env
.env*.local
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "fix(B9): add .env to .gitignore to prevent key leakage"
```

---

### Task 3: Fix B3 — CSS var() colors in drills.ts

**Files:**
- Modify: `src/lib/drills.ts:4-10`

**Step 1: Replace CSS custom properties with hex values**

In `CATEGORIES` array (lines 4-10), replace:

- `color: 'var(--color-sky)'` → `color: '#4A90D9'` (presence)
- `color: 'var(--color-gold)'` → `color: '#C8A951'` (thinking)
- `color: 'var(--color-recording)'` → `color: '#D94A4A'` (pattern-breaking)

The remaining categories already use hex: `'#8B5CF6'`, `'#059669'`, `'#D97706'`, `'#DC2626'`.

**Step 2: Verify no other CSS var() usage in the codebase**

Run: `grep -r "var(--" src/ app/`
Expected: No results

**Step 3: Commit**

```bash
git add src/lib/drills.ts
git commit -m "fix(B3): replace CSS var() colors with hex values for React Native"
```

---

### Task 4: Fix B2 — Drill instructions field name

**Files:**
- Modify: `app/(tabs)/workouts.tsx:76`

**Step 1: Verify the field name in drills.ts**

Search `src/lib/drills.ts` for drill objects. Each drill has a `theDrill` field (the exercise instructions), not `instructions`.

**Step 2: Fix the field reference**

In `workouts.tsx:76`, change:

```typescript
<Text style={styles.drillInstructions}>{selectedDrill.instructions}</Text>
```

to:

```typescript
<Text style={styles.drillInstructions}>{selectedDrill.theDrill}</Text>
```

**Step 3: Commit**

```bash
git add app/(tabs)/workouts.tsx
git commit -m "fix(B2): use correct 'theDrill' field for workout instructions"
```

---

### Task 5: Cleanup C1-C3

**Files:**
- Delete: `App.tsx`
- Delete: `index.ts`
- Modify: `package.json` (remove tailwindcss)
- Modify: `app/(onboarding)/intake.tsx:3` (remove unused Animated import)

**Step 1: Delete Expo boilerplate files**

```bash
rm App.tsx index.ts
```

**Step 2: Remove tailwindcss from package.json**

In `package.json:27`, remove the line:

```
"tailwindcss": "3"
```

Then run: `npm install` to update package-lock.json.

**Step 3: Remove unused Animated import from intake.tsx**

In `app/(onboarding)/intake.tsx:3`, change:

```typescript
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
```

to:

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 5: Commit**

```bash
git add -A
git commit -m "cleanup(C1-C3): remove Expo boilerplate, tailwindcss, unused Animated import"
```

---

## Phase 2: Architecture Rebuild

### Task 6: Create shared UI components — Button

**Files:**
- Create: `src/components/ui/Button.tsx`

**Step 1: Create the component directory**

```bash
mkdir -p src/components/ui
```

**Step 2: Write Button component**

```typescript
// src/components/ui/Button.tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps {
  children: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  style?: object
}

export function Button({ children, onPress, variant = 'primary', disabled = false, style }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'primary' && disabled && styles.primaryDisabled,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          variant === 'primary' && styles.primaryText,
          variant === 'primary' && disabled && styles.primaryDisabledText,
          variant === 'secondary' && styles.secondaryText,
          variant === 'ghost' && styles.ghostText,
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  primary: {
    backgroundColor: colors.ink,
    paddingHorizontal: 32,
  },
  primaryDisabled: {
    backgroundColor: colors.paperDeep,
  },
  primaryText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
  primaryDisabledText: {
    color: colors.inkGhost,
  },
  secondary: {
    paddingVertical: 12,
  },
  secondaryText: {
    color: colors.inkMuted,
    fontSize: 14,
  },
  ghost: {
    paddingVertical: 8,
  },
  ghostText: {
    color: colors.inkGhost,
    fontSize: 14,
  },
  text: {},
})
```

**Step 3: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat: add shared Button component with primary/secondary/ghost variants"
```

---

### Task 7: Create shared UI components — TextArea, Card, ScreenContainer, LoadingScreen, BackButton

**Files:**
- Create: `src/components/ui/TextArea.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/ScreenContainer.tsx`
- Create: `src/components/ui/LoadingScreen.tsx`
- Create: `src/components/ui/BackButton.tsx`
- Create: `src/components/ui/index.ts`

**Step 1: Write TextArea**

```typescript
// src/components/ui/TextArea.tsx
import { TextInput, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

interface TextAreaProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  minHeight?: number
  editable?: boolean
  autoFocus?: boolean
}

export function TextArea({
  value, onChangeText, placeholder = 'Start anywhere...',
  minHeight = 160, editable = true, autoFocus = false,
}: TextAreaProps) {
  return (
    <TextInput
      style={[styles.textArea, { minHeight }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inkGhost}
      multiline
      textAlignVertical="top"
      editable={editable}
      autoFocus={autoFocus}
    />
  )
}

const styles = StyleSheet.create({
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
})
```

**Step 2: Write Card**

```typescript
// src/components/ui/Card.tsx
import { View, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../../lib/theme'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
})
```

**Step 3: Write ScreenContainer**

```typescript
// src/components/ui/ScreenContainer.tsx
import {
  View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
  TouchableWithoutFeedback, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'

interface ScreenContainerProps {
  children: React.ReactNode
  keyboard?: boolean
  scroll?: boolean
  center?: boolean
}

export function ScreenContainer({ children, keyboard = false, scroll = false, center = false }: ScreenContainerProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, center && styles.center]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.inner, center && styles.center]}>
      {children}
    </View>
  )

  if (keyboard) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            {content}
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {content}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
})
```

**Step 4: Write LoadingScreen and BackButton**

```typescript
// src/components/ui/LoadingScreen.tsx
import { ActivityIndicator } from 'react-native'
import { ScreenContainer } from './ScreenContainer'
import { colors } from '../../lib/theme'

export function LoadingScreen() {
  return (
    <ScreenContainer center>
      <ActivityIndicator color={colors.inkGhost} />
    </ScreenContainer>
  )
}
```

```typescript
// src/components/ui/BackButton.tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

interface BackButtonProps {
  onPress: () => void
  label?: string
}

export function BackButton({ onPress, label = '← Back' }: BackButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    color: colors.inkGhost,
  },
})
```

**Step 5: Write barrel export**

```typescript
// src/components/ui/index.ts
export { Button } from './Button'
export { TextArea } from './TextArea'
export { Card } from './Card'
export { ScreenContainer } from './ScreenContainer'
export { LoadingScreen } from './LoadingScreen'
export { BackButton } from './BackButton'
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean (may need to install `react-native-safe-area-context` types if not present)

**Step 7: Commit**

```bash
git add src/components/
git commit -m "feat: add shared UI component library (Button, TextArea, Card, ScreenContainer, LoadingScreen, BackButton)"
```

---

### Task 8: Create ErrorBoundary

**Files:**
- Create: `src/components/ui/ErrorBoundary.tsx`
- Modify: `src/components/ui/index.ts`

**Step 1: Write ErrorBoundary**

```typescript
// src/components/ui/ErrorBoundary.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

interface Props {
  children: React.ReactNode
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage || 'An unexpected error occurred.'}
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.debug}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  debug: {
    fontSize: 12,
    color: colors.inkGhost,
    fontFamily: 'monospace',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
})
```

**Step 2: Add to barrel export**

Add to `src/components/ui/index.ts`:

```typescript
export { ErrorBoundary } from './ErrorBoundary'
```

**Step 3: Commit**

```bash
git add src/components/ui/ErrorBoundary.tsx src/components/ui/index.ts
git commit -m "feat: add ErrorBoundary component for crash recovery"
```

---

### Task 9: Define session types

**Files:**
- Create: `src/types/session.ts`

**Step 1: Create types directory and session types**

```bash
mkdir -p src/types
```

```typescript
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
```

**Step 2: Commit**

```bash
git add src/types/
git commit -m "feat: add typed session state machine interfaces"
```

---

### Task 10: Build useSessionReducer

**Files:**
- Create: `src/hooks/useSessionReducer.ts`

**Step 1: Write the reducer**

```typescript
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
        // Skip mark → go to drilling if drill exists, else quality
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
        phase: action.checkpoint.phase as SessionPhase,
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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 3: Commit**

```bash
git add src/hooks/useSessionReducer.ts
git commit -m "feat: add useSessionReducer — typed state machine replacing 12 useState calls"
```

---

### Task 11: Build useSessionSideEffects

**Files:**
- Create: `src/hooks/useSessionSideEffects.ts`

**Step 1: Write the side effects hook**

This hook watches state changes and dispatches API calls, DB writes, and checkpoint operations.

```typescript
// src/hooks/useSessionSideEffects.ts
import { useEffect, useRef, useCallback, Dispatch } from 'react'
import type { SessionState, SessionAction, Message } from '../types/session'
import { createSession, updateSession } from '../lib/storage'
import { streamClaude } from '../lib/claude'
import { COACHING_SYSTEM_PROMPT, DEEP_DIVE_SYSTEM_PROMPT } from '../lib/prompts'
import { detectWeaknessFromFeedback } from '../lib/frameworks'
import { saveCheckpoint, clearCheckpoint, SESSION_KEY } from '../lib/sessionCheckpoint'
import parseFeedback from '../lib/parseFeedback'

interface SideEffectsConfig {
  userId?: string
  sessionCount: number
  voiceModel?: any
  onWeaknessDetected?: ((id: string) => void) | null
}

export function useSessionSideEffects(
  state: SessionState,
  dispatch: Dispatch<SessionAction>,
  config: SideEffectsConfig,
) {
  const prevPhaseRef = useRef(state.phase)

  // --- Start session: create in DB ---
  const startSession = useCallback(async (promptType: string, promptText: string) => {
    try {
      const session = await createSession({
        userId: config.userId,
        promptType,
        promptText,
      })
      dispatch({ type: 'START', prompt: { promptType, promptText }, session })
      saveCheckpoint(SESSION_KEY, {
        sessionId: session.id,
        phase: 'responding',
        promptType,
        promptText,
      })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Failed to start session' })
    }
  }, [config.userId, dispatch])

  // --- Submit response: save + call Claude ---
  const submitResponse = useCallback(async (responseText: string, isDeepDive = false) => {
    if (!state.session) return
    dispatch({ type: 'SUBMIT_RESPONSE', text: responseText })

    try {
      if (!isDeepDive) {
        await updateSession(state.session.id, { responseText })
      }

      const voiceModelContext = config.voiceModel
        ? `\n\nVOICE MODEL:\n${JSON.stringify(config.voiceModel, null, 2)}`
        : ''

      const systemPrompt = isDeepDive
        ? `${DEEP_DIVE_SYSTEM_PROMPT}\n\nSession count: ${config.sessionCount}\nContext from previous exchange is in the conversation history.`
        : `${COACHING_SYSTEM_PROMPT}\n\nSession count for this user: ${config.sessionCount}${voiceModelContext}`

      const messages: Message[] = [
        ...state.conversationHistory,
        { role: 'user', content: responseText },
      ]

      let fullText = ''
      await streamClaude({
        systemPrompt,
        messages,
        onChunk: (text) => dispatch({ type: 'FEEDBACK_CHUNK', text }),
        onDone: async (text) => {
          fullText = text
          const parts = parseFeedback(text)
          const updatedHistory: Message[] = [...messages, { role: 'assistant', content: text }]

          dispatch({
            type: 'FEEDBACK_DONE',
            fullText: text,
            drillText: parts.drill || null,
            conversationHistory: updatedHistory,
          })

          // Save to DB
          await updateSession(state.session!.id, {
            feedbackEcho: parts.echo,
            feedbackName: parts.name,
            feedbackDrill: parts.drill,
            feedbackOpen: parts.open,
            deepDiveExchanges: updatedHistory,
          })

          // Checkpoint
          saveCheckpoint(SESSION_KEY, {
            sessionId: state.session!.id,
            phase: 'feedback',
            promptType: state.prompt?.promptType,
            promptText: state.prompt?.promptText,
            feedback: text,
            conversationHistory: updatedHistory,
            drillText: parts.drill,
            responseText,
          })

          // Weakness detection
          const detected = detectWeaknessFromFeedback(parts.name, parts.drill)
          if (detected && config.onWeaknessDetected) {
            config.onWeaknessDetected(detected)
          }
        },
        onError: (err) => {
          dispatch({ type: 'FEEDBACK_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
        },
      })
    } catch (err) {
      dispatch({ type: 'FEEDBACK_ERROR', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [state.session, state.conversationHistory, state.prompt, config, dispatch])

  // --- Save mark to DB ---
  const saveMark = useCallback(async (markedText: string) => {
    if (!state.session) return
    const durationSeconds = state.startTime
      ? Math.round((Date.now() - state.startTime) / 1000)
      : null
    await updateSession(state.session.id, {
      markedMoment: markedText,
      durationSeconds,
      // NOTE: completed is NOT set here (fixes B8)
    })
  }, [state.session, state.startTime])

  // --- Save drill to DB ---
  const saveDrill = useCallback(async (response: string, skipped = false) => {
    if (!state.session) return
    if (skipped) {
      await updateSession(state.session.id, { drillSkipped: true })
    } else {
      await updateSession(state.session.id, { drillResponse: response })
    }
  }, [state.session])

  // --- Save explanation to DB ---
  const saveExplanation = useCallback(async (text: string) => {
    if (!state.session) return
    await updateSession(state.session.id, { markExplanation: text })
  }, [state.session])

  // --- Save quality and mark complete ---
  const saveQuality = useCallback(async (signal: string) => {
    if (!state.session) return
    await updateSession(state.session.id, {
      qualitySignal: signal,
      completed: true, // NOW we set completed (fixes B8)
    })
    clearCheckpoint(SESSION_KEY)
  }, [state.session])

  // --- Retry logic (fixes B6) ---
  useEffect(() => {
    if (state.phase === 'thinking' && state.lastResponseText && prevPhaseRef.current === 'feedback') {
      // This was a retry — re-submit the last response
      const isDeepDive = state.deepDiveCount > 0
      submitResponse(state.lastResponseText, isDeepDive)
    }
    prevPhaseRef.current = state.phase
  }, [state.phase])

  return {
    startSession,
    submitResponse,
    saveMark,
    saveDrill,
    saveExplanation,
    saveQuality,
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/hooks/useSessionSideEffects.ts
git commit -m "feat: add useSessionSideEffects — separated API/DB/checkpoint logic from state"
```

---

### Task 12: Extract session phase components

**Files:**
- Create: `src/components/session/RespondingPhase.tsx`
- Create: `src/components/session/ThinkingPhase.tsx`
- Create: `src/components/session/FeedbackPhase.tsx`
- Create: `src/components/session/MarkingPhase.tsx`
- Create: `src/components/session/ExplainingPhase.tsx`
- Create: `src/components/session/DrillingPhase.tsx`
- Create: `src/components/session/QualityPhase.tsx`
- Create: `src/components/session/ClosedPhase.tsx`
- Create: `src/components/session/index.ts`

**Step 1: Create directory**

```bash
mkdir -p src/components/session
```

**Step 2: Write all 8 phase components + barrel export**

Each phase component receives `state`, `dispatch`, and relevant callbacks from `useSessionSideEffects`. They use the shared UI components from Task 7.

The exact code for each phase component should be extracted from the current `session.tsx` conditional blocks, replacing raw `StyleSheet` usage with `Button`, `TextArea`, `Card`, `ScreenContainer`, `BackButton` from `src/components/ui`. Each component is ~30-60 lines.

For example, `RespondingPhase.tsx` handles both initial response and deep dive (currently two separate `if` blocks in session.tsx), using `state.openQuestion` to determine which mode.

The barrel export maps phases to components:

```typescript
// src/components/session/index.ts
import type { SessionPhase } from '../../types/session'
import { RespondingPhase } from './RespondingPhase'
import { ThinkingPhase } from './ThinkingPhase'
import { FeedbackPhase } from './FeedbackPhase'
import { MarkingPhase } from './MarkingPhase'
import { ExplainingPhase } from './ExplainingPhase'
import { DrillingPhase } from './DrillingPhase'
import { QualityPhase } from './QualityPhase'
import { ClosedPhase } from './ClosedPhase'

export const PHASE_COMPONENTS: Partial<Record<SessionPhase, React.ComponentType<any>>> = {
  responding: RespondingPhase,
  thinking: ThinkingPhase,
  feedback: FeedbackPhase,
  marking: MarkingPhase,
  explaining: ExplainingPhase,
  drilling: DrillingPhase,
  quality: QualityPhase,
  closed: ClosedPhase,
}
```

**Step 3: Commit**

```bash
git add src/components/session/
git commit -m "feat: extract 8 session phase components from monolith session.tsx"
```

---

### Task 13: Rewrite session.tsx as thin shell

**Files:**
- Modify: `app/session.tsx` (full rewrite from 475 lines to ~50 lines)

**Step 1: Rewrite session.tsx**

Replace the entire file with:

```typescript
// app/session.tsx
import { useEffect, useRef, useCallback } from 'react'
import { Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../src/hooks/useAuth'
import { useSessionReducer } from '../src/hooks/useSessionReducer'
import { useSessionSideEffects } from '../src/hooks/useSessionSideEffects'
import { useStreak } from '../src/hooks/useStreak'
import { useWeaknessSRS } from '../src/hooks/useWeaknessSRS'
import { PHASE_COMPONENTS } from '../src/components/session'
import { LoadingScreen, ErrorBoundary } from '../src/components/ui'
import { loadCheckpoint, SESSION_KEY } from '../src/lib/sessionCheckpoint'

export default function SessionScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    promptType: string
    promptText: string
    sessionCount: string
    checkpointId?: string
  }>()

  const sessionCount = parseInt(params.sessionCount || '0', 10)
  const { streak, recordPractice } = useStreak(user?.id)
  const { weaknesses, recordDetection } = useWeaknessSRS(user?.id)

  const [state, dispatch] = useSessionReducer()
  const sideEffects = useSessionSideEffects(state, dispatch, {
    userId: user?.id,
    sessionCount,
    onWeaknessDetected: recordDetection,
  })

  // Start or restore session
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !user) return
    startedRef.current = true

    if (params.checkpointId) {
      loadCheckpoint(SESSION_KEY).then((cp) => {
        if (cp) dispatch({ type: 'RESTORE_CHECKPOINT', checkpoint: cp })
      })
    } else {
      sideEffects.startSession(params.promptType || 'reveal', params.promptText || '')
    }
  }, [user])

  const handleClose = useCallback(() => router.back(), [])

  const PhaseComponent = PHASE_COMPONENTS[state.phase]

  return (
    <ErrorBoundary fallbackMessage="Something went wrong during your session.">
      {PhaseComponent ? (
        <PhaseComponent
          state={state}
          dispatch={dispatch}
          sideEffects={sideEffects}
          streak={streak}
          recordPractice={recordPractice}
          sessionNumber={sessionCount + 1}
          onClose={handleClose}
        />
      ) : (
        <LoadingScreen />
      )}
    </ErrorBoundary>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/session.tsx
git commit -m "refactor: rewrite session.tsx from 475-line monolith to 50-line phase router"
```

---

## Phase 3: Remaining Bug Fixes

### Task 14: Fix B5 — Render side effects in founding-session and prep

**Files:**
- Modify: `app/(onboarding)/founding-session.tsx:45-48`
- Modify: `app/prep.tsx:19-21`

**Step 1: Fix founding-session.tsx**

Replace the render-time side effect (lines 45-48):

```typescript
// OLD (lines 45-48):
if (!started && user) {
  startSession({ promptType: foundingPrompt.promptType, promptText: foundingPrompt.promptText })
  setStarted(true)
}

// NEW:
const startedRef = useRef(false)
useEffect(() => {
  if (startedRef.current || !user) return
  startedRef.current = true
  startSession({ promptType: foundingPrompt.promptType, promptText: foundingPrompt.promptText })
}, [user])
```

Add `useRef` to the imports on line 1 and `useEffect` if not already imported.

Remove the `const [started, setStarted] = useState(false)` line since we use a ref now.

**Step 2: Fix prep.tsx**

Replace the render-time side effect (lines 19-21):

```typescript
// OLD (lines 19-21):
if (!loaded && user?.id) {
  getSessionCount(user.id).then((c) => { setSessionCount(c); setLoaded(true) })
}

// NEW:
useEffect(() => {
  if (!user?.id) return
  let cancelled = false
  getSessionCount(user.id).then((c) => {
    if (!cancelled) {
      setSessionCount(c)
      setLoaded(true)
    }
  })
  return () => { cancelled = true }
}, [user?.id])
```

Add `useEffect` to imports. Remove the `const [loaded, setLoaded] = useState(false)` line (use a different guard or keep it for conditional rendering).

**Step 3: Commit**

```bash
git add app/(onboarding)/founding-session.tsx app/prep.tsx
git commit -m "fix(B5): move side effects from render body to useEffect"
```

---

### Task 15: Fix B7 — UTC streak dates

**Files:**
- Modify: `src/lib/storage.ts:254,262,435,444`

**Step 1: Create a local date helper**

At the top of `storage.ts`, add:

```typescript
function localDateString(): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date())
}
```

**Step 2: Replace all UTC date usages**

- Line 254: `const today = new Date().toISOString().split('T')[0]` → `const today = localDateString()`
- Line 262: `const yesterdayStr = yesterday.toISOString().split('T')[0]` → Replace with:
  ```typescript
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = new Intl.DateTimeFormat('en-CA').format(yesterday)
  ```
- Line 435: `const date = new Date().toISOString().split('T')[0]` → `const date = localDateString()`
- Line 444: `const today = new Date().toISOString().split('T')[0]` → `const today = localDateString()`

**Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "fix(B7): use local dates for streak calculations instead of UTC"
```

---

### Task 16: Fix B11-B14

**Files:**
- Modify: `app/session.tsx` (B11 — handled via phase components now)
- Modify: `app/_layout.tsx:43,34` (B12, B13)
- Modify: `src/lib/claude.ts:49` (B14)

**Step 1: Fix B12 — Add segments to useEffect deps**

In `app/_layout.tsx:43`, add `segments` to the dependency array:

```typescript
}, [user, loading, subLoading, isSubscribed, segments])
```

**Step 2: Fix B13 — Add unmount guard**

In `app/_layout.tsx:34`, wrap the `.then()` with a cancellation pattern:

```typescript
useEffect(() => {
  if (loading || subLoading) return
  let cancelled = false

  const inAuthGroup = segments[0] === '(auth)'
  const inOnboarding = segments[0] === '(onboarding)'

  if (!user) {
    if (!inAuthGroup) router.replace('/(auth)/sign-in')
    hasNavigated.current = false
    return
  }

  if (hasNavigated.current) return
  hasNavigated.current = true

  getSessionCount(user.id).then((count) => {
    if (cancelled) return
    if (count === 0) {
      router.replace('/(onboarding)/welcome')
    } else if (!isSubscribed) {
      router.replace('/(onboarding)/paywall')
    } else if (inAuthGroup || inOnboarding) {
      router.replace('/(tabs)')
    }
  })

  return () => { cancelled = true }
}, [user, loading, subLoading, isSubscribed, segments])
```

**Step 3: Fix B14 — Guard response.body**

In `src/lib/claude.ts:49`, add before `const reader = response.body!.getReader()`:

```typescript
if (!response.body) {
  throw new Error('No response body — streaming not supported in this environment')
}
const reader = response.body.getReader()
```

Remove the `!` non-null assertion.

**Step 4: Commit**

```bash
git add app/_layout.tsx src/lib/claude.ts
git commit -m "fix(B12-B14): add segments dep, unmount guard, response.body null check"
```

---

### Task 17: Fix B15, B17, B18

**Files:**
- Modify: `src/lib/drills.ts:13-16` (B15)
- Modify: `src/hooks/usePrepSession.ts` (B17)
- Modify: Multiple files (B18 — silent catches)

**Step 1: Fix B15 — Difficulty gates**

In `src/lib/drills.ts:13-16`:

```typescript
export const DIFFICULTY_GATES = {
  foundational: 1,
  intermediate: __DEV__ ? 1 : 15,
  advanced: __DEV__ ? 1 : 30,
}
```

**Step 2: Fix B17 — Voice model refetch**

In `src/hooks/usePrepSession.ts`, fetch voice model once in `startPrep` and store in a ref. Change `submitMessage` to use the stored ref instead of calling `getVoiceModel(userId)` on every message.

**Step 3: Fix B18 — Silent catches**

In each file with `catch {}`, add at minimum:

```typescript
catch (err) {
  if (__DEV__) console.error('Context:', err)
}
```

Files to update:
- `app/(onboarding)/founding-session.tsx:87`
- `app/(onboarding)/intake.tsx:24`
- `app/(onboarding)/welcome.tsx:14`
- `app/(tabs)/index.tsx:50`

**Step 4: Commit**

```bash
git add src/lib/drills.ts src/hooks/usePrepSession.ts app/
git commit -m "fix(B15,B17,B18): difficulty gates, voice model caching, dev error logging"
```

---

### Task 18: TypeScript cleanup (C4-C6)

**Files:**
- Modify: `src/lib/storage.ts` — add parameter types
- Modify: `src/lib/frameworks.ts` — add parameter types
- Modify: `src/lib/parseFeedback.ts` — add parameter types

**Step 1: Add types to storage.ts functions**

Add proper parameter types to all exported functions. Key ones:

```typescript
export async function createSession({ userId, promptType, promptText, responseMode = 'text', sessionMode = 'daily', sessionNumber = null }: {
  userId: string
  promptType: string
  promptText: string
  responseMode?: string
  sessionMode?: string
  sessionNumber?: number | null
})
```

Apply similar typing to `updateSession`, `updateStreak`, `upsertVoiceModel`, etc.

**Step 2: Replace (err as any).message pattern (C5)**

In `src/hooks/useSession.ts` (now `useSessionReducer.ts`), `usePrepSession.ts`, and side effects:

```typescript
// OLD:
setError((err as any).message)

// NEW:
setError(err instanceof Error ? err.message : 'Unknown error')
```

**Step 3: Commit**

```bash
git add src/
git commit -m "cleanup(C4-C6): add TypeScript types, replace (err as any) pattern"
```

---

## Phase 4: Missing UX Features

### Task 19: Add tab icons (B16)

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Step 1: Add Ionicons**

```typescript
import { Ionicons } from '@expo/vector-icons'

// In each Tabs.Screen options:
tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />
// patterns: "layers-outline"
// workouts: "barbell-outline"
// settings: "settings-outline"
```

**Step 2: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat(B16): add Ionicons to tab bar"
```

---

### Task 20: Expression Library screen

**Files:**
- Create: `app/(tabs)/library.tsx`
- Modify: `app/(tabs)/_layout.tsx` (add tab)

**Step 1: Build the Library screen**

Use `getLibrary` and `getLibraryFiltered` from `storage.ts` (these already exist). Display marked moments with filters (all, breakthroughs, prep).

**Step 2: Add to tab layout**

Add a new `Tabs.Screen` with name `"library"` and icon `"book-outline"`. Consider whether this replaces or supplements the Patterns tab.

**Step 3: Commit**

```bash
git add app/(tabs)/library.tsx app/(tabs)/_layout.tsx
git commit -m "feat: add Expression Library screen with filter tabs"
```

---

### Task 21: Wire session checkpoint restore

**Files:**
- Already handled in Task 13 (session.tsx rewrite reads `checkpointId` and calls `RESTORE_CHECKPOINT`)

Verify that the Home screen's checkpoint card passes `checkpointId` and that session.tsx reads it. This was wired in the Task 13 rewrite.

**Step 1: Commit** (if any additional wiring needed)

```bash
git commit -m "feat: wire session checkpoint restore end-to-end"
```

---

## Summary

| Phase | Tasks | Bugs Fixed | Features Added |
|-------|-------|------------|----------------|
| 1: Get Running | 1-5 | B1, B2, B3, B9, C1-C3 | — |
| 2: Architecture | 6-13 | B4, B6, B8, B10 (dissolved) | State machine, phase components, shared UI, ErrorBoundary |
| 3: Bug Fixes | 14-18 | B5, B7, B11-B18, C4-C6 | TypeScript types |
| 4: UX Features | 19-21 | B16 | Tab icons, Expression Library, checkpoint restore |
