# CRISP React Native -- Developer Handoff Brief

## What this is

CRISP is a daily expression coaching app. Users get AI-generated prompts, respond in text, receive structured feedback (Echo/Name/Drill/Open), and over time the app builds a "voice model" of their communication patterns. Think of it as reps for how you speak and think.

**Stack:** Expo 55 + React 19 + Expo Router + Supabase + Claude API (proxied) + RevenueCat

**Current state:** All 15 screens are built. Auth, onboarding (5-step intake), daily sessions, deep dive, prep mode, workout library (40+ drills), patterns viewer, settings, and a paywall. TypeScript compiles clean. No tests. No CI. One git commit. Never been run on a device.

---

## Architecture overview

```
app/                          # Expo Router file-based routing
  _layout.tsx                 # Root: auth guard + subscription gate + onboarding check
  (auth)/sign-in.tsx          # Email OTP via Supabase
  (onboarding)/               # welcome → philosophy → intake → starter-path → founding-session → paywall
  (tabs)/                     # Home, Patterns, Workouts, Settings
  session.tsx                 # Full session modal (prompt → respond → feedback → drill → mark → quality)
  prep.tsx                    # Real-world prep mode (chat → key messages)

src/
  hooks/
    useAuth.ts                # Supabase auth state + OTP
    useSession.ts             # Core session state machine (9 phases)
    usePrepSession.ts         # Prep mode state machine
    usePromptEngine.ts        # AI-powered prompt selection with priority cascade
    useStreak.ts              # Streak tracking
    useWeaknessSRS.ts         # Spaced repetition for weakness patterns
    useSubscription.ts        # RevenueCat wrapper (fail-open in dev)
    useLibraryPatterns.ts     # AI analysis of library entries

  lib/
    supabase.ts               # Client init (AsyncStorage for session persistence)
    claude.ts                 # API proxy with streaming + retry on 401
    storage.ts                # All Supabase CRUD (sessions, voice models, library, streaks, weakness SRS, workouts, prep, notifications)
    prompts.ts                # All system prompts (coaching, prompt selection, voice model update, prep, drill feedback, deep dive, pattern analysis)
    drills.ts                 # 40+ drills across 7 categories with science/instructions/variations
    frameworks.ts             # SRS scheduling, weakness detection, framework definitions
    parseFeedback.ts          # Parses AI output into Echo/Name/Drill/Open sections
    intakeMapping.ts          # Maps intake answers → voice model seed + starter drills + personalized prompts
    voiceModelValidation.ts   # Basic structural validation
    sessionCheckpoint.ts      # AsyncStorage checkpoint/restore with 24h TTL
    theme.ts                  # Design tokens (colors, spacing, fonts)
```

**Data flow:** User action → hook → storage.ts (Supabase) + claude.ts (API proxy) → state update → screen re-render. Voice model updates are fire-and-forget after session close. Checkpoints save to AsyncStorage for crash recovery.

**Backend:** Supabase for auth + database. Claude API calls go through a proxy at `EXPO_PUBLIC_API_URL/api/claude` (the existing CRISP web app's Vercel deployment). The proxy holds the Anthropic API key server-side.

---

## Bugs -- fix these before anything else

### Critical (app won't work)

**B1. RevenueCat import crashes Expo Go**
`useSubscription.ts:2` does `import Purchases from 'react-native-purchases'` unconditionally. This is a native module -- it throws immediately in Expo Go before any fail-open logic runs. The app cannot launch in development.

Fix: Dynamic import or try/catch around `require('react-native-purchases')`, falling back to a mock when unavailable.

---

**B2. `selectedDrill.instructions` is undefined -- workouts show blank**
`workouts.tsx:76` reads `selectedDrill.instructions` but the drill object uses `theDrill` as the field name. The active workout screen shows no instructions.

Fix: Change to `selectedDrill.theDrill`.

---

**B3. CSS `var()` colors render as nothing in React Native**
`drills.ts` CATEGORIES use `'var(--color-sky)'` etc. for colors. React Native doesn't support CSS custom properties. The workout category dots (`workouts.tsx:174`) are invisible. Any future use of `cat.color` will also be broken.

Fix: Replace with actual hex values from `theme.ts`, e.g. `colors.sky`, `colors.gold`, `colors.recording`. The mapping:
- `var(--color-sky)` → `'#4A90D9'`
- `var(--color-gold)` → `'#C8A951'`
- `var(--color-recording)` → `'#D94A4A'`
- Remaining categories use hardcoded hex already

---

**B4. Marking phase is unreachable -- dead UI**
`useSession.ts:startMarking` transitions to `'drilling'` (if drill exists) or `'quality'` (if not). It never sets phase to `'marking'`. The marking UI in `session.tsx:228-260` is dead code. Users can never mark a moment in regular sessions.

Fix: `startMarking` should set phase to `'marking'` first. After marking, transition to `'drilling'` (if drill) or `'explaining'`/`'quality'`.

---

**B5. `startSession` called during render (founding-session.tsx:45-48)**
Side effect during render body. React strict mode double-invokes this, creating two Supabase sessions.

Fix: Move to `useEffect` with a guard ref, like session.tsx already does.

Same problem in `prep.tsx:19-21` with `getSessionCount`.

---

**B6. `retryFeedback` is a no-op**
`useSession.ts:264-268` clears the error and sets phase to `'thinking'` but never re-invokes `submitResponse` or `submitDeepDive`. Any retry button shows a spinner forever.

Fix: Store the last `responseText` in a ref. In `retryFeedback`, re-call the appropriate submit function.

---

### High (wrong behavior)

**B7. Streak dates use UTC, not local time**
`storage.ts:254` uses `new Date().toISOString().split('T')[0]`. A user at 11pm EST gets tomorrow's UTC date. Streaks misfire -- they can break or double-count.

Fix: Use local date everywhere streaks are calculated. `new Intl.DateTimeFormat('en-CA').format(new Date())` returns `YYYY-MM-DD` in local time.

---

**B8. `completeMark` sets `completed: true` before quality signal**
`useSession.ts:212-216` marks the session complete in the DB, then moves to `'explaining'` → `'quality'`. If the app crashes between, `getSessionCount` includes this session but it has no quality data.

Fix: Move `completed: true` to `submitQuality`.

---

**B9. `.env` not in `.gitignore`**
`.gitignore` only covers `.env*.local`. A plain `.env` file with Supabase keys will be committed.

Fix: Add `.env` to `.gitignore`.

---

**B10. Missing `explaining` phase in founding-session.tsx**
The founding session auto-skips marking via `completeMark('')`, which sets phase to `'explaining'`. But there's no `if (phase === 'explaining')` handler. Falls through to loading spinner. User gets stuck.

Fix: Add an explaining phase handler, or skip explaining in founding session by going straight to quality.

---

**B11. `handleExit` tells user response is "saved" but it isn't**
`session.tsx:118` says "Your response so far has been saved" but `responseText` is only in local state -- nothing has been persisted.

Fix: Either save to checkpoint before showing the alert, or change the copy to "Your response will be lost."

---

**B12. Root layout `useEffect` missing `segments` dependency**
`_layout.tsx:43` reads `segments[0]` inside `useEffect` but `segments` isn't in the dependency array. Navigation guard won't re-evaluate on programmatic navigation.

Fix: Add `segments` to the dependency array.

---

**B13. Root layout `.then()` has no unmount guard**
`_layout.tsx:34` fires `getSessionCount().then(...)` with no cancellation. If the component unmounts before resolution, it calls `router.replace` on an unmounted component.

Fix: Add `let cancelled = false` pattern (already used in `useWeaknessSRS.ts`).

---

### Medium

**B14. `response.body!` non-null assertion in claude.ts:49**
`response.body` can be null in some RN environments. This crashes with "Cannot read properties of null."

Fix: Guard with `if (!response.body) throw new Error('No response body')`.

---

**B15. `DIFFICULTY_GATES` all set to 1**
`drills.ts:14-16` has TODO comments to restore to 15/30. All users get immediate access to advanced drills.

Fix: Use a `__DEV__` check: `intermediate: __DEV__ ? 1 : 15`.

---

**B16. Tab icons are all null**
Every `tabBarIcon` returns `null`. Tabs show as text-only with empty space above.

Fix: Add icons. Expo ships `@expo/vector-icons` by default. Use `Ionicons` or similar.

---

**B17. Voice model fetched on every prep message**
`usePrepSession.ts:80` calls `getVoiceModel(userId)` on every `submitMessage`. It doesn't change mid-conversation.

Fix: Fetch once in `startPrep`, store in a ref, pass to `submitMessage`.

---

**B18. Silent `catch {}` blocks everywhere**
`founding-session.tsx:87`, `intake.tsx:24`, `welcome.tsx:14`, `session.tsx:108`, `home/index.tsx:50` all have empty catch blocks. These silently swallow errors including network failures and auth expiry.

Fix: At minimum `console.error` in dev. Consider a lightweight error toast.

---

---

## Cleanup -- do after bugs

**C1. Delete `App.tsx` and `index.ts`** -- Expo boilerplate. Expo Router doesn't use them.

**C2. Remove `tailwindcss` from package.json** -- No NativeWind config, no usage anywhere. Dead dependency.

**C3. Remove `Animated` import from intake.tsx** -- Imported but unused.

**C4. Add TypeScript parameter types** -- Files like `frameworks.ts`, `storage.ts`, `parseFeedback.ts`, `intakeMapping.ts`, `voiceModelValidation.ts` have `.ts` extensions but no parameter types. With `strict: true`, all params are `any`. Particularly dangerous in `getNextInterval` (arithmetic) and `updateStreak` (date math).

**C5. Replace `(err as any).message` pattern** -- Used across `useSession.ts` and `usePrepSession.ts`. Replace with:
```ts
catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error')
}
```

**C6. `any` types in screen components** -- `voiceModel`, `todaySession`, `checkpoint`, `selectedDrill` are all typed as `any`. Define proper interfaces.

---

## What to build next

This is roughly in priority order for getting to a shippable v1:

### Must-have for launch

1. **EAS dev client build** -- Required for RevenueCat and any native module testing. Set up `eas.json`, create dev builds for iOS.

2. **SafeAreaView everywhere** -- No screen uses safe area insets. Content will be hidden under the notch/dynamic island on iOS and under status bar on Android.

3. **Error boundaries** -- A Claude API failure or JSON parse error in the session flow will white-screen the app. Add React error boundaries around session and prep screens at minimum.

4. **Loading and empty states** -- Several screens (Patterns, Home) have loading states but no error recovery. If `getVoiceModel` or `getSessionCount` fail, the user sees a spinner forever.

5. **Keyboard dismissal** -- TextInputs don't dismiss the keyboard on tap-outside. Add `<TouchableWithoutFeedback onPress={Keyboard.dismiss}>` wrappers or use `keyboardDismissMode` on ScrollViews.

6. **Session screen back behavior** -- The session is a `fullScreenModal` but the only exit is the back button on the responding phase. If the user is on feedback/quality, there's no way to go back to home without completing the flow. Consider adding a persistent close button.

7. **Scroll-to-bottom in prep chat** -- The prep conversation view doesn't auto-scroll as new messages arrive. Use `ref.scrollToEnd()` on the ScrollView after exchanges update.

8. **Library screen** -- The voice model has a library (marked moments, breakthroughs), and `storage.ts` has full CRUD for it, but there's no Library tab or screen. This is a major feature that's all backend with no frontend.

9. **Deep link handling** -- `app.json` defines scheme `crisp` and Expo Router is configured, but there's no explicit handling. OTP email links need to route back into the app.

### Should-have

10. **Session restore from checkpoint** -- The checkpoint card on Home passes `checkpointId` as a route param, but `session.tsx` never reads it or calls `restoreFromCheckpoint`. The recovery flow is wired on the Home side but not the Session side.

11. **Voice model seeding from intake** -- `founding-session.tsx:73` calls `mapAnswersToVoiceModel` but then merges it with `getVoiceModel` (which returns null for first session). The merge order `{ ...intakeFields, ...existingModel }` means existing model wins -- but on first session there IS no existing model, so this works accidentally. Document the intent.

12. **Offline handling** -- All Supabase calls and Claude API calls will throw if offline. No offline detection, no queuing, no cached fallback. At minimum, show an offline banner.

13. **Rate limiting / debouncing** -- `handleStartSession` calls `selectPrompt` which calls `callClaude`. No debounce -- a double-tap creates two API calls and potentially two sessions.

14. **App Store compliance** -- Paywall needs privacy policy and terms of use links. The current terms text at the bottom is plain text, not a tappable link.

15. **Haptic feedback** -- The app's aesthetic is minimal and considered. Light haptics on option selection (intake, quality signal) would match the vibe.

### Nice-to-have

16. **Onboarding animation** -- Intake transitions use `setTimeout` with opacity toggle. Replace with `react-native-reanimated` for fluid enter/exit.

17. **Pull-to-refresh on Home** -- Session count and streak don't update after completing a session and navigating back. The data is stale until the component remounts.

18. **Push notifications** -- `storage.ts` has `logNotification` and `getRecentNotifications` CRUD but nothing is wired. Daily reminder notifications are a major retention lever.

19. **Voice input** -- The app is about expression but only supports text. Even basic speech-to-text via `expo-speech` would be a big UX upgrade.

20. **Tests** -- Zero tests. Priority targets: `parseFeedback` (deterministic parsing logic), `frameworks.ts` SRS functions (date math), `useSession` state machine transitions.

---

## Environment setup

```bash
cp .env.example .env
# Fill in:
#   EXPO_PUBLIC_SUPABASE_URL
#   EXPO_PUBLIC_SUPABASE_ANON_KEY
#   EXPO_PUBLIC_API_URL (Vercel deployment of CRISP web app with /api/claude proxy)
#   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS (optional, paywall skipped without it)

npm install
npx expo start
```

Note: After fixing B1 (RevenueCat import), this should work in Expo Go. For subscription testing, you need `eas build --profile development --platform ios`.

---

## Supabase tables (inferred from storage.ts)

- `sessions` -- user_id, prompt_type, prompt_text, response_text, feedback_echo/name/drill/open, marked_moment, mark_explanation, quality_signal, deep_dive_exchanges, duration_seconds, session_number, session_mode, completed, etc.
- `voice_models` -- user_id, model (JSONB), session_count, updated_at
- `library` -- user_id, session_id, marked_text, prompt_text, ai_observation, prompt_type, mark_explanation, secondary_capture, session_number
- `streaks` -- user_id, current_streak, longest_streak, last_practiced_date, freeze_count
- `weakness_srs` -- user_id, weakness_id, status, sessions_active, sessions_clean, last_appeared, last_drilled, interval_days
- `prep_sessions` -- user_id, situation_type, situation_description, prep_exchanges, key_messages, completed
- `workout_sessions` -- user_id, drill_id, drill_name, category, difficulty, duration_seconds, notes
- `workout_progress` -- user_id, drill_id, times_completed, last_completed_at, unlocked_at, difficulty_unlocked
- `notification_log` -- user_id, prompt_text, sent_at

Schema migrations are not in this repo. Assume the database already exists (from the web app).

---

## Key decisions already made (don't redo)

- **Expo Router over React Navigation** -- file-based routing, deep linking built in
- **StyleSheet over NativeWind** -- NativeWind had React 19 peer dep conflicts; StyleSheet with theme.ts tokens is the chosen pattern
- **RevenueCat fail-open** -- intentional for dev; subscribed=true when no API key configured
- **Claude proxy** -- API key stays server-side on the Vercel web app; mobile hits `/api/claude`
- **AsyncStorage for checkpoints** -- lightweight crash recovery, 24h TTL
- **Fire-and-forget voice model updates** -- non-blocking after session close
- **Founding session as onboarding finale** -- first session IS onboarding step 5, not a separate flow
