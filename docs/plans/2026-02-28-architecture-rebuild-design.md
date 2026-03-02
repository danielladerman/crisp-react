# CRISP Architecture Rebuild Design

## Context

CRISP is a daily expression coaching app built with Expo 55 + React 19 + Expo Router. All 15 screens exist but the app has never run on a device. A developer brief identified 18 bugs, 6 cleanup items, and 20 features to build. A Figma UX flow defines the intended user experience including features not yet implemented (Quick Rep, Explain Mark, Expression Library).

This design addresses the root cause: architectural debt in the session flow that makes bugs easy to introduce and features hard to add.

## Decision: Architecture-First Rebuild

Rather than fixing 18 bugs one-by-one on the current architecture, we rebuild the foundation so that 4 critical bugs dissolve automatically and future features are easy to add.

Key decisions already made (preserved):
- Expo Router over React Navigation
- StyleSheet over NativeWind
- RevenueCat fail-open in dev
- Claude proxy on Vercel
- AsyncStorage for checkpoints
- Fire-and-forget voice model updates

---

## 1. Session State Machine (useReducer)

### Problem

`useSession.ts` manages 9 phases with 12+ `useState` calls. Phase transitions are scattered across callbacks. This causes:
- B4: Marking phase unreachable (startMarking skips to drilling)
- B6: retryFeedback is a no-op (no stored response to retry)
- B8: completed=true fires before quality signal
- B10: Explaining phase has no UI handler

### Solution

Replace with a single `useReducer` where every transition is an explicit typed action.

```typescript
// src/hooks/useSessionReducer.ts

type SessionPhase =
  | 'idle' | 'responding' | 'thinking' | 'feedback'
  | 'marking' | 'explaining' | 'drilling' | 'quality' | 'closed'

type SessionAction =
  | { type: 'START'; prompt: Prompt }
  | { type: 'SUBMIT_RESPONSE'; text: string }
  | { type: 'FEEDBACK_CHUNK'; text: string }
  | { type: 'FEEDBACK_DONE'; fullText: string; drillText: string | null }
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

interface SessionState {
  phase: SessionPhase
  session: Session | null
  prompt: Prompt | null
  responseText: string
  lastResponseText: string        // for retry (fixes B6)
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
}
```

### Transition rules

- `DONE_FEEDBACK` always transitions to `marking` (fixes B4)
- `COMPLETE_MARK` transitions to `drilling` if drillText exists, else `explaining` (fixes B10)
- `SKIP_MARK` same as COMPLETE_MARK with empty text
- `SUBMIT_QUALITY` is the ONLY place that sets session as completed (fixes B8)
- `RETRY` reads `lastResponseText` from state and re-dispatches (fixes B6)
- `GO_DEEPER` increments deepDiveCount and transitions to `responding` (max 10)

### Side effects

Side effects (API calls, DB writes, checkpoints) live in a separate hook:

```typescript
// src/hooks/useSessionSideEffects.ts
// Watches state changes via useEffect and triggers async operations
// Dispatches results back (FEEDBACK_CHUNK, FEEDBACK_DONE, FEEDBACK_ERROR)
```

This separation means the reducer is pure and testable.

---

## 2. Phase Component Extraction

### Problem

`session.tsx` is 475 lines with 8 conditional render blocks. Each phase is a different screen crammed into one file. Adding a phase means modifying the monolith.

### Solution

Each phase becomes a self-contained component:

```
src/components/session/
  RespondingPhase.tsx      # Prompt + TextArea + Submit (handles both initial + deep dive)
  ThinkingPhase.tsx        # Prompt + spinner
  FeedbackPhase.tsx        # Feedback card + Go Deeper / Done
  MarkingPhase.tsx         # "Mark a moment" + TextArea + Mark/Skip
  ExplainingPhase.tsx      # "Why this moment?" + TextArea + Submit/Skip
  DrillingPhase.tsx        # Drill prompt + TextArea + Done/Skip
  QualityPhase.tsx         # Four quality signal buttons
  ClosedPhase.tsx          # Session complete + streak + Home
```

All phase components receive `(state: SessionState, dispatch: Dispatch<SessionAction>)` as props.

### Session screen becomes a thin shell

```typescript
// app/session.tsx — ~40 lines
export default function SessionScreen() {
  const params = useLocalSearchParams()
  const [state, dispatch] = useSessionReducer()
  useSessionSideEffects(state, dispatch)

  const PhaseComponent = PHASE_MAP[state.phase]
  return (
    <ErrorBoundary>
      <PhaseComponent state={state} dispatch={dispatch} />
    </ErrorBoundary>
  )
}
```

---

## 3. Shared Component Library

### Problem

Every screen redefines identical styles: button, textArea, container, scrollContent. 6 files each have their own copy of the same patterns.

### Solution

```
src/components/ui/
  Button.tsx              # variant: 'primary' | 'secondary' | 'ghost'
  TextArea.tsx            # Styled multiline with placeholder
  Card.tsx                # Surface with padding + border-radius
  ScreenContainer.tsx     # SafeAreaView + KeyboardAvoidingView + ScrollView
  BackButton.tsx          # ← Back with onPress
  LoadingScreen.tsx       # Centered ActivityIndicator
  ErrorBoundary.tsx       # Catches crashes, shows recovery
```

### Button API

```typescript
<Button variant="primary" onPress={handleSubmit} disabled={!text.trim()}>
  Submit
</Button>

<Button variant="secondary" onPress={handleSkip}>
  Skip
</Button>
```

### ScreenContainer API

```typescript
<ScreenContainer keyboard scroll>
  {/* Handles SafeArea + KeyboardAvoiding + ScrollView */}
  <BackButton onPress={handleExit} />
  <Text style={styles.prompt}>{promptText}</Text>
</ScreenContainer>
```

---

## 4. Bug Resolution Map

| Bug | Strategy | Resolved By |
|-----|----------|-------------|
| B1 | Dynamic require for RevenueCat | Phase 1 (independent) |
| B2 | Fix field name instructions→theDrill | Phase 1 (independent) |
| B3 | Replace CSS var() with hex in drills.ts | Phase 1 (independent) |
| B4 | Dissolved by state machine | Phase 2 |
| B5 | Move to useEffect in founding-session + prep | Phase 3 |
| B6 | Dissolved by state machine (lastResponseText) | Phase 2 |
| B7 | Fix UTC dates in storage.ts | Phase 3 |
| B8 | Dissolved by state machine (SUBMIT_QUALITY) | Phase 2 |
| B9 | Add .env to .gitignore | Phase 1 |
| B10 | Dissolved by ExplainingPhase component | Phase 2 |
| B11 | Fix copy or save checkpoint before alert | Phase 3 |
| B12 | Add segments to useEffect deps | Phase 3 |
| B13 | Add cancelled pattern in _layout.tsx | Phase 3 |
| B14 | Guard response.body in claude.ts | Phase 3 |
| B15 | __DEV__ check for difficulty gates | Phase 3 |
| B16 | Add Ionicons to tabs | Phase 4 |
| B17 | Fetch voice model once in startPrep | Phase 3 |
| B18 | Replace empty catches with console.error | Phase 3 |

---

## 5. Missing UX Flow Features

From the Figma UX flow diagram, these are not yet implemented:

| Feature | Backend | Frontend | Priority |
|---------|---------|----------|----------|
| Explain Mark phase | useSession has it | No UI (B10) | Built in Phase 2 |
| Expression Library tab | storage.ts CRUD exists | No screen | Phase 4 |
| Session checkpoint restore | Checkpoint card on Home | session.tsx never reads checkpointId | Phase 4 |
| Quick Rep Flow | Not started | Not started | Phase 5 |
| Suggested Workout on Home | Not started | Not started | Phase 5 |
| Session → Workout exit | Not started | Not started | Phase 5 |
| Text/Voice/Both input | Not started | Not started | Future |

---

## 6. Execution Phases

### Phase 1: Get It Running (~30 min)
- Fix B1 (RevenueCat dynamic import)
- Fix B9 (.env gitignore)
- Fix B3 (CSS var → hex colors)
- Fix B2 (drill field name)
- Cleanup C1-C3 (delete App.tsx, remove tailwindcss, remove Animated import)

### Phase 2: Architecture Rebuild (~3 hours)
- Create shared UI components (Button, TextArea, Card, ScreenContainer, ErrorBoundary)
- Build useSessionReducer with typed state machine
- Build useSessionSideEffects
- Extract 8 phase components
- Rewrite session.tsx as thin shell
- Add SafeAreaView to all screens
- Dissolves B4, B6, B8, B10

### Phase 3: Remaining Bug Fixes (~30 min)
- Fix B5, B7, B11, B12, B13, B14, B15, B17, B18
- Add TypeScript types (C4-C6)
- Replace (err as any).message pattern (C5)

### Phase 4: Missing UX Features (~2 hours)
- Expression Library screen (storage.ts CRUD already exists)
- Session checkpoint restore (wire session.tsx to read checkpointId)
- Tab icons (Ionicons)
- Keyboard dismissal
- Scroll-to-bottom in prep chat

### Phase 5: New Features (future)
- Quick Rep Flow (new reducer variant + PressureTimerPhase)
- Suggested Workout card on Home
- Session-to-Workout exit path
- Haptic feedback
- Push notifications
- Voice input

---

## React Patterns Reference

Patterns used in this design, sourced from top React Native codebases:

- **useReducer state machines**: Used by Bluesky social-app for complex flows. Pure reducer + separate side effect hook.
- **Phase component map**: Pattern from Expo Router examples. A record mapping state to components replaces conditional chains.
- **Shared UI primitives**: Every mature RN app (Shopify Restyle, Tamagui apps) extracts Button/Card/Container.
- **ErrorBoundary**: React docs + React Native community recommendation. Prevents white-screen crashes.
- **Separated side effects**: Dan Abramov pattern from "Making Sense of React Hooks". Reducer is pure, effects are explicit.
