# CLAUDE.md — CRISP React Native

> Last updated: 2026-03-05 (pre-build scan)

## What CRISP Is

CRISP is a daily expression coaching app. Users get AI-generated prompts, respond in text or voice, receive structured feedback, and over time the app builds a "voice model" of their communication patterns. Think of it as reps for how you speak and think.

**Stack:** Expo 55 + React 19 + Expo Router + Supabase + Claude API (proxied via Vercel) + RevenueCat

**Current state:** The vNext architecture rebuild is complete. All 15+ screens are built. Auth, onboarding (6-step intake), daily sessions, prep mode, workout library (40+ drills), patterns viewer, expression library, and settings. The app uses a simplified session flow with an `interactions` table (chat log) instead of monolithic session columns.

---

## File Structure (actual)

```
crispreact/
├── app/                              # Expo Router file-based routing
│   ├── _layout.tsx                   # Root: auth guard + subscription gate + onboarding check
│   ├── session.tsx                   # Full daily session (fullScreenModal)
│   ├── prep.tsx                      # Prep mode (fullScreenModal)
│   ├── (auth)/
│   │   ├── _layout.tsx              # Auth stack wrapper
│   │   └── sign-in.tsx              # Email OTP via Supabase
│   ├── (onboarding)/
│   │   ├── _layout.tsx              # Onboarding stack (slide_from_right)
│   │   ├── welcome.tsx              # Name entry
│   │   ├── philosophy.tsx           # Philosophy text
│   │   ├── intake.tsx               # 6-question survey
│   │   ├── starter-path.tsx         # Personalized drill recommendations
│   │   ├── founding-session.tsx     # First AI session
│   │   └── paywall.tsx              # RevenueCat subscription
│   └── (tabs)/
│       ├── _layout.tsx              # Tab navigator (5 tabs)
│       ├── index.tsx                # Home: greeting, start session, streak
│       ├── library.tsx              # Expression Library: saved moments, pin/edit/add
│       ├── patterns.tsx             # Patterns: strengths + weaknesses (3+ sessions)
│       ├── workouts.tsx             # Workout Library: categories → drills → active → complete
│       └── settings.tsx             # Settings: name, onboarding replay, sign out
├── src/
│   ├── components/ui/
│   │   ├── index.ts                 # Barrel export
│   │   ├── Button.tsx               # variant: primary | secondary | ghost
│   │   ├── TextArea.tsx             # Multiline input with placeholder
│   │   ├── Card.tsx                 # Surface with padding + border-radius
│   │   ├── ScreenContainer.tsx      # SafeAreaView + KeyboardAvoidingView + ScrollView
│   │   ├── BackButton.tsx           # ← Back with onPress
│   │   ├── LoadingScreen.tsx        # Centered ActivityIndicator
│   │   └── ErrorBoundary.tsx        # Class component, catches crashes
│   ├── hooks/
│   │   ├── useAuth.ts               # Supabase auth state + OTP + saveName
│   │   ├── useSession.ts            # Session state machine (prompt → responding → feedback → done)
│   │   ├── usePatterns.ts           # Pattern fetch + strengths/weaknesses split
│   │   ├── useStreak.ts             # Streak tracking
│   │   ├── useSubscription.ts       # RevenueCat wrapper (dynamic require, fail-open)
│   │   ├── useTranscription.ts      # Audio → text via /api/transcribe
│   │   └── useVoiceRecorder.ts      # expo-av recording controls
│   ├── lib/
│   │   ├── supabase.ts              # Client init (AsyncStorage for session persistence)
│   │   ├── claude.ts                # API proxy: streamClaude, callClaude, callClaudeWithCallbacks
│   │   ├── storage.ts               # All Supabase CRUD (32 functions)
│   │   ├── prompts.ts               # 11 system prompt constants
│   │   ├── drills.ts                # 40+ drills, 7 categories, WEAKNESS_TO_DRILL mapping
│   │   ├── intakeMapping.ts         # Maps intake answers → voice model seed + starter drills
│   │   ├── sessionCheckpoint.ts     # AsyncStorage checkpoint save/restore (24h TTL)
│   │   └── theme.ts                 # Design tokens (colors, spacing, fonts)
│   └── types/
│       └── session.ts               # SessionPhase, Interaction, Session, Pattern, Checkpoint
├── docs/
│   ├── migrations/
│   │   ├── 001_fresh_schema.sql     # Full schema for fresh Supabase project
│   │   ├── 002_library_enhancements.sql  # pinned + source columns
│   │   └── 003_rebuild_schema.sql   # Simplified sessions + interactions table
│   └── plans/
│       ├── 2026-02-28-architecture-rebuild-design.md   # Architecture decisions
│       └── 2026-02-28-architecture-rebuild-plan.md     # Phase-by-phase implementation plan
├── assets/                          # App icons + splash screen
├── DEVELOPER_BRIEF.md               # Original developer handoff (bugs, cleanup, features)
├── README.md                        # Setup and architecture overview
├── package.json                     # Dependencies
├── app.json                         # Expo config
├── tsconfig.json                    # TypeScript config
├── .env.example                     # Env var template
└── .gitignore
```

---

## Key Existing Code

### Prompt Constants (src/lib/prompts.ts)

| Constant | Purpose |
|----------|---------|
| `FOUNDING_PROMPT` | Opening prompt for first session |
| `COACHING_PROMPT` | Main coaching feedback system prompt (60-120 words, plain prose) |
| `DIVE_DEEPER_PROMPT` | Socratic follow-up (1-2 sentences) |
| `PATTERN_ANALYSIS_PROMPT` | Detects strengths/weaknesses from 2+ sessions (returns JSON) |
| `WORKOUT_SUGGESTION_PROMPT` | Recommends drills based on feedback + patterns (returns JSON) |
| `VOICE_MODEL_UPDATE_PROMPT` | Mutates voice model JSONB after session |
| `PROMPT_SELECTION_SYSTEM_PROMPT` | AI-selects session prompts based on growth edge |
| `DEFAULT_PROMPTS` | Fallback prompts: `{ reveal[], pressure[], story[], open[] }` |
| `PREP_COACHING_PROMPT` | Prep mode coaching system prompt |
| `PREP_SCENARIO_CATEGORIES` | Array of 5 scenario types with labels/descriptions |
| `DRILL_FEEDBACK_SYSTEM_PROMPT` | Evaluates drill execution |

### Storage Functions (src/lib/storage.ts)

**Sessions:** `createSession(userId, promptType, promptText, responseMode)` → `sessions` | `updateSession(sessionId, updates)` | `getSession(sessionId)` | `getRecentSessions(userId, limit=10)` | `getTodaySession(userId)` | `getSessionCount(userId)` — counts completed only

**Interactions:** `addInteraction(sessionId, userId, role, content, interactionType, audioUrl?)` → `interactions` | `getSessionInteractions(sessionId)` | `getRecentInteractions(userId, limit=50)`

**Patterns:** `upsertPattern(userId, pattern, sessionId)` → `patterns` (keeps last 10 evidence entries) | `getPatterns(userId)`

**Voice Model:** `getVoiceModel(userId)` → `voice_models` (handles no-row gracefully) | `upsertVoiceModel(userId, model, sessionCount)`

**Library:** `addToLibrary(...)` | `toggleLibraryPin(entryId, userId, pinned)` | `updateLibraryEntry(...)` | `deleteLibraryEntry(...)` | `getLibrary(userId)` | `getLibraryFiltered(userId, filter?)`

**Streaks:** `getStreak(userId)` → defaults `{ current_streak: 0, longest_streak: 0, last_practice_date: null, freeze_count: 2 }` | `updateStreak(userId)` — handles consecutive days + freeze (up to 2 gaps)

**Workouts:** `createWorkoutSession(...)` → `workout_sessions` | `upsertWorkoutProgress(userId, drillId)` → `workout_progress` | `getAllWorkoutProgress(userId)` | `getWorkoutSessionCount(userId, category?)` | `getCategoryCompletions(userId)`

**Audio:** `uploadAudio(userId, audioUri)` → Supabase storage bucket `audio`

**Misc:** `getFocusMode()` / `setFocusMode(mode)` → AsyncStorage | `saveIntakeAnswers(answers)` → Supabase auth metadata | `saveTodayWorkout(drillName)` / `loadTodayWorkout()` → AsyncStorage

### WEAKNESS_TO_DRILL Mapping (src/lib/drills.ts)

```
'over-qualifying'         → 'bluf-practice'
'throat-clearing'         → 'bluf-practice'
'burying-lead'            → 'bluf-practice'
'trailing-off'            → 'stop-technique'
'over-explaining'         → 'shrinking-time-rebuttal'
'abstraction-escape'      → 'semantic-feature-analysis'
'softening-under-pushback' → 'externalizing-the-monitor'
'performance-voice'       → 'mpfc-anchoring'
```

7 drill categories: presence, thinking, pattern-breaking, emotional-precision, articulation, communication, voice

### Voice Model JSONB Structure (from intakeMapping.ts)

```json
{
  "currentFocus": "string (e.g. 'Articulation')",
  "focusMode": "string ('professional'|'relational'|'mixed')",
  "detectedWeaknesses": ["string[]"],
  "pressureFocus": "string|null",
  "coreContext": "string",
  "breakthroughConditions": "string",
  "horizon": "string",
  "intakeAnswers": { "questionId": "answerId" }
}
```

Additional fields added by VOICE_MODEL_UPDATE_PROMPT after sessions: `growthEdge`, `circlingIdeas`, `observations`, etc.

### Session State Management (src/hooks/useSession.ts)

**Phases:** `'prompt' → 'responding' → 'feedback' → 'done'`

**State variables:** phase, session, interactions, feedbackText, feedbackLoading, suggestedDrills, error

**Key callbacks:**
- `startSession(promptType, promptText, responseMode?)` — creates session in DB, transitions to 'responding'
- `submitResponse(text, audioUrl?)` — saves interaction, calls Claude for feedback, transitions to 'feedback', fires background tasks (pattern analysis, voice model update, workout suggestions)
- `diveDeeper(text)` — saves dive-deeper interaction, calls Claude, **stays in 'responding' phase**
- `tryAgain()` — back to 'responding', clears feedback
- `completeSession()` — updates status to 'completed', clears checkpoint, transitions to 'done'

**Background tasks (fire-and-forget after feedback):**
1. Pattern analysis — analyzes recent 100 interactions, upserts detected patterns
2. Voice model update — updates JSONB based on session content
3. Workout suggestions — returns suggested drill IDs

### Claude API (src/lib/claude.ts)

Three functions:
- `streamClaude(opts)` — streaming response with `onChunk`/`onDone`/`onError` callbacks
- `callClaude(opts)` — non-streaming, returns text
- `callClaudeWithCallbacks(opts)` — non-streaming with callback interface (used for RN compatibility)

All go through `proxyFetch` → `${EXPO_PUBLIC_API_URL}/api/claude` with JWT auth. Auto-retries on 401 (refreshes Supabase session).

Default model: `claude-sonnet-4-6`, default maxTokens: 1024 (stream) / 2000 (call)

---

## Database Schema (from migrations)

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK → auth.users | NOT NULL |
| prompt_type | text | NOT NULL |
| prompt_text | text | NOT NULL |
| status | text | 'active' or 'completed' |
| response_mode | text | 'text' or 'voice', default 'text' |
| suggested_drills | jsonb | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Index: `idx_sessions_user_status(user_id, status, created_at DESC)`
RLS: select/insert/update by user_id

### interactions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| session_id | uuid FK → sessions | ON DELETE CASCADE |
| user_id | uuid FK → auth.users | NOT NULL |
| role | text | 'user', 'assistant', 'system' |
| content | text | NOT NULL |
| interaction_type | text | 'response', 'dive_deeper', 'feedback', 'follow_up', 'fix_attempt' |
| audio_url | text | nullable |
| created_at | timestamptz | default now() |

Indexes: `idx_interactions_session(session_id, created_at)`, `idx_interactions_user(user_id, created_at DESC)`
RLS: select/insert by user_id

### patterns
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | NOT NULL |
| pattern_type | text | 'strength' or 'weakness' |
| pattern_id | text | NOT NULL, UNIQUE(user_id, pattern_id) |
| description | text | NOT NULL |
| evidence | jsonb | `[{ session_id, excerpt, date }]` |
| first_detected_at | timestamptz | |
| last_seen_at | timestamptz | |
| status | text | 'active' or 'resolved' |

### voice_models
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | UNIQUE |
| model_data | jsonb | The voice model (see JSONB structure above) |
| session_count | integer | default 0 |
| updated_at | timestamptz | |

### library
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | NOT NULL |
| session_id | uuid FK → sessions | nullable (from 004 migration) |
| marked_text | text | NOT NULL |
| prompt_text | text | default '' |
| ai_observation | text | default '' |
| prompt_type | text | default '' |
| pinned | boolean | default false |
| source | text | 'session' or 'manual' |
| created_at | timestamptz | |
| updated_at | timestamptz | (from 004 migration) |

### streaks
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | UNIQUE |
| current_streak | integer | default 0 |
| longest_streak | integer | default 0 |
| last_practice_date | date | nullable |
| freeze_count | integer | default 2 (from 004 migration) |
| updated_at | timestamptz | |

### workout_sessions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | NOT NULL |
| drill_id | text | NOT NULL |
| drill_name | text | NOT NULL |
| category | text | NOT NULL |
| difficulty | text | NOT NULL |
| duration_seconds | integer | nullable |
| notes | text | nullable |
| created_at | timestamptz | |

### workout_progress
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | NOT NULL |
| drill_id | text | UNIQUE(user_id, drill_id) |
| times_completed | integer | default 1 |
| last_completed_at | timestamptz | |
| unlocked_at | timestamptz | (from 004 migration) |
| difficulty_unlocked | text | default 'foundational' (from 004 migration) |

### Tables dropped in rebuild (003_rebuild_schema.sql)
- `weakness_srs` — replaced by `patterns` table
- `notification_log` — removed
- `prep_sessions` — kept for legacy data but prep now uses sessions + interactions

---

## Navigation Architecture

**Navigator type:** Expo Router (file-based, uses React Navigation under the hood)

**Root Stack (_layout.tsx):**
- `(auth)` — Stack group
- `(onboarding)` — Stack group (slide_from_right animation)
- `(tabs)` — Tab group
- `session` — fullScreenModal presentation
- `prep` — fullScreenModal presentation

**Tab Navigator ((tabs)/_layout.tsx):**
5 tabs with Ionicons: Home (home-outline), Library (book-outline), Patterns (layers-outline), Workouts (barbell-outline), Settings (settings-outline)

**Navigation flow:**
```
Auth Check → sign-in (if no user)
           → onboarding/welcome (if sessionCount === 0)
           → onboarding/paywall (if not subscribed)
           → (tabs) (if authenticated + onboarded + subscribed)

Onboarding: welcome → philosophy → intake → starter-path → founding-session → paywall → (tabs)

Home → session modal (with params: promptType, promptText, sessionCount, focusMode)
Home → prep modal
Home → workouts tab

Session done → back to tabs (or workouts via suggested drills modal)
Prep done → back to tabs (auto-dismisses after 1.5s)
```

**Adding new screens:** Create file in appropriate route group. Modals go in `app/` root. Tab screens go in `app/(tabs)/`.

---

## Existing Patterns to Follow

### Component structure
- Functional components with hooks (no class components except ErrorBoundary)
- StyleSheet.create() at bottom of file for styles
- Colors/spacing from `theme.ts` tokens, never hardcoded
- ScreenContainer wraps all screens (SafeArea + keyboard handling)

### Hook ↔ storage interaction
- Hooks call storage.ts functions directly (no context provider layer)
- Hooks manage local state with useState
- Background tasks are fire-and-forget (no awaiting, errors logged silently)

### Error handling
- try/catch in async callbacks, error state set on hook
- ErrorBoundary wraps session and prep screens
- Console.error in __DEV__ for background tasks
- Supabase errors surfaced as `error.message`

### AI integration
- All Claude calls go through `callClaudeWithCallbacks` (non-streaming for RN compatibility)
- System prompt built dynamically with voice model + patterns + session count context
- AI responses parsed as plain text (not JSON) for coaching, JSON for pattern analysis / workout suggestions
- Background: pattern analysis, voice model update, workout suggestions — all non-blocking

### Navigation
- Route params passed as strings (JSON.stringify for objects)
- router.push for forward navigation, router.replace for auth redirects, router.back for dismissal

### Styling
- `theme.ts` tokens: `colors.paper`, `colors.ink`, `colors.sky`, `colors.gold`, `colors.recording`, etc.
- `spacing.xs/sm/md/lg/xl/xxl` for consistent spacing
- Font sizes: 13 (meta), 15 (body), 17 (large body), 20 (subtitle), 28 (title)
- Border radius: 12 standard, 8 for inputs
- Common patterns: `{ flex: 1, backgroundColor: colors.paper }`

---

## Discrepancies Found

### Referenced files that don't exist
1. **CRISP_PRD_CURRENT.md** — referenced in the user's scan prompt but not in repo
2. **CRISP_Strategy_Architecture.docx** — referenced in the user's scan prompt but not in repo
3. **2026-02-28-architecture-rebuild-plan.md** (at root) — exists at `docs/plans/2026-02-28-architecture-rebuild-plan.md` instead

### Architecture plan vs actual code (post-rebuild)
4. The architecture rebuild plan (Phase 2) proposed a `useReducer` state machine with `useSessionReducer.ts` and `useSessionSideEffects.ts`. The **actual** implementation uses `useState`-based `useSession.ts` with a simplified 4-phase model (`prompt → responding → feedback → done`) instead of the planned 9-phase model. This is intentional — the rebuild simplified the flow.
5. The plan proposed extracting 8 phase components (`RespondingPhase.tsx`, `ThinkingPhase.tsx`, etc.) into `src/components/session/`. These were **not created** — session rendering is still inline in `app/session.tsx` and `app/(onboarding)/founding-session.tsx`. The session screen is manageable at current size.
6. The plan references `usePrepSession.ts` — this hook was removed. Prep logic now lives directly in `app/prep.tsx`.
7. The plan references `usePromptEngine.ts`, `useWeaknessSRS.ts`, `useLibraryPatterns.ts` — all removed. Prompt selection logic moved to `app/(tabs)/index.tsx`. SRS replaced by `patterns` table. Library patterns replaced by `usePatterns.ts`.
8. The plan references `frameworks.ts`, `parseFeedback.ts`, `voiceModelValidation.ts` — all removed. Feedback is no longer parsed into sections (Echo/Name/Drill/Open); it comes as plain prose.

### storage.ts vs actual database schema (reconciled 2026-03-05)
9. **FIXED:** `storage.ts` was reading `data?.model` and writing `model` for voice_models. Corrected to `model_data` to match 001 schema.
10. **FIXED:** `storage.ts` was using `last_practiced_date` for streaks. Corrected to `last_practice_date` to match 001 schema.
11. **Migration created:** `004_storage_reconciliation.sql` adds missing columns that storage.ts expects: `streaks.freeze_count`, `library.session_id`, `library.updated_at`, `workout_progress.unlocked_at`, `workout_progress.difficulty_unlocked`. **Run this migration before first launch.**

### DEVELOPER_BRIEF bugs vs current code
12. **B1 (RevenueCat crash)** — FIXED. Dynamic require is in place in `useSubscription.ts`.
13. **B2 (instructions vs theDrill)** — FIXED. Drill objects use `theDrill` field. Workouts screen reads `selectedDrill.theDrill`.
14. **B3 (CSS var() colors)** — FIXED. `drills.ts` CATEGORIES now use hex colors from theme.
15. **B4 (marking phase unreachable)** — DISSOLVED. Marking phase removed from simplified flow.
16. **B5 (startSession during render)** — FIXED. `founding-session.tsx` uses `useEffect` with `startedRef` guard.
17. **B6 (retryFeedback no-op)** — FIXED. `tryAgain()` transitions back to responding.
18. **B7 (UTC streak dates)** — FIXED. `storage.ts` has `localDateString()` using `Intl.DateTimeFormat('en-CA')`.
19. **B8 (completed=true before quality)** — DISSOLVED. Quality signal removed from simplified flow.
20. **B9 (.env gitignore)** — VERIFIED. `.gitignore` has `.env` on line 34. Not tracked by git.
21. **B10 (explaining phase missing)** — DISSOLVED. Explaining phase removed.
22. **B11 (handleExit copy)** — Session screen has no exit alert currently; sessions auto-save via interactions table.
23. **B12 (segments dependency)** — Should verify `_layout.tsx` includes segments in useEffect deps.
24. **B13 (unmount guard)** — `_layout.tsx` has `cancelled` flag pattern.
25. **B14 (response.body null)** — `callClaudeWithCallbacks` uses non-streaming, so `response.body` is not used.
26. **B15 (DIFFICULTY_GATES all 1)** — FIXED. Uses `__DEV__ ? 1 : 15/30`.
27. **B16 (tab icons null)** — FIXED. Tab layout has Ionicons.
28. **B17 (voice model fetched every prep message)** — Prep now fetches voice model once on start.
29. **B18 (silent catch blocks)** — Partially addressed; some empty catches remain.

---

## Pre-Existing Issues Observed

1. **No `tsconfig.json` strict mode verification** — TypeScript config exists but parameter types may still be loose in some files.
2. **`tailwindcss` removed from package.json** — Cleanup C2 completed.
3. **Missing `App.tsx` and `index.ts`** — Cleanup C1 completed (Expo Router entry point is `expo-router/entry`).
4. **Voice model lazy loading inconsistency** — `session.tsx` lazy-loads voice model (session 5+), `prep.tsx` loads eagerly. Not a bug, but inconsistent.
5. **No offline detection** — All Supabase/Claude calls throw if offline. No offline banner or queue.
6. **No rate limiting** — Double-tap on "Begin session" could create two API calls.
7. **Route params not validated** — Session screen casts params from strings without validation.
8. **Background task errors invisible** — Pattern analysis, voice model update, workout suggestions fail silently.
9. **`.env` confirmed untracked** — `.gitignore` has `.env` on line 34 and git confirms it's not cached. The `?? .env` in git status means untracked (correct).

---

## Build Plan Phases

> Updated 2026-03-05. Phases 1-2 completed in vNext rebuild. Renumbered to reflect remaining work.

### Completed Work (for reference)
- **Get It Running:** B1 (RevenueCat), B9 (.gitignore), B3 (CSS var→hex), B2 (drill field name), C1-C3 (cleanup) — all done
- **Architecture Rebuild:** Shared UI components created, session state simplified to 4 phases, B4/B6/B8/B10 dissolved — all done
- **Core Bug Fixes:** B5 (render side effect), B7 (UTC dates), B14 (response.body), B15 (difficulty gates), B16 (tab icons), B17 (voice model fetch) — all done
- **Expression Library:** Full CRUD screen with pin/edit/add/delete — done
- **Keyboard dismissal:** ScreenContainer handles this — done
- **Prep scroll-to-bottom:** Done
- **Storage reconciliation:** Column names fixed (model→model_data, last_practiced_date→last_practice_date), migration 004 created for missing columns

### Phase 1: Pre-Launch Hardening
- [ ] Run migration `004_storage_reconciliation.sql` in Supabase
- [ ] Verify B12 fix — `_layout.tsx` useEffect should include `segments` in dependency array
- [ ] Fix B18 — replace remaining empty `catch {}` blocks with `console.error` in dev
- [ ] Wire session checkpoint restore — `session.tsx` should read `checkpointId` param and call `restoreFromCheckpoint`
- [ ] Add rate limiting / debounce on "Begin session" button (prevent double-tap creating two sessions)
- [ ] Add session exit button — persistent close/X on all session phases (currently no way to exit mid-session)

### Phase 2: UX Polish
- [ ] SafeAreaView audit — verify all screens use ScreenContainer or SafeAreaView
- [ ] Error recovery states — loading spinners that never resolve if API fails need timeout + retry
- [ ] Pull-to-refresh on Home — session count and streak don't update after completing a session
- [ ] Deep link handling — OTP email links need to route back into app (scheme `crisp` configured in app.json)
- [ ] Haptic feedback on option selection (intake, quality signal)

### Phase 3: New Features
- [ ] Quick Rep Flow — abbreviated session variant (new session mode, pressure timer)
- [ ] Suggested Workout card on Home — surface drills from previous session feedback
- [ ] Session-to-Workout exit path — after session done, option to jump to suggested drill
- [ ] Push notifications — daily reminder (storage.ts notification CRUD was removed, needs rebuild)
- [ ] Offline handling — detect network state, show banner, queue or cache

### Phase 4: App Store Readiness
- [ ] EAS dev client build (required for RevenueCat testing on device)
- [ ] Privacy policy and terms of use links on paywall (currently plain text)
- [ ] App Store screenshots and metadata
- [ ] Production error reporting (Sentry or similar)
- [ ] Analytics integration

---

## Environment

```bash
cp .env.example .env
# EXPO_PUBLIC_SUPABASE_URL
# EXPO_PUBLIC_SUPABASE_ANON_KEY
# EXPO_PUBLIC_API_URL (Vercel deployment with /api/claude proxy)
# EXPO_PUBLIC_REVENUECAT_API_KEY_IOS (optional, paywall skipped without it)

npm install
npx expo start
```

Dependencies: Expo 55, React 19, React Native 0.83.2, Supabase JS 2.98, expo-router 55, expo-av 16, react-native-purchases 9.10, react-native-safe-area-context 5.6, react-native-screens 4.23

---

## Key Decisions (don't redo)

- Expo Router over React Navigation (file-based routing)
- StyleSheet over NativeWind (NativeWind had React 19 peer dep conflicts)
- RevenueCat fail-open in dev (subscribed=true without API key)
- Claude proxy on Vercel (API key server-side)
- AsyncStorage for checkpoints (lightweight, 24h TTL)
- Fire-and-forget voice model updates (non-blocking after session)
- Founding session as onboarding finale (session 1 IS onboarding step 5)
- Simplified session flow (4 phases, interactions table) over original 9-phase monolith
- Non-streaming Claude calls for RN compatibility (callClaudeWithCallbacks)
- Patterns table replaces weakness_srs for AI-detected strengths/weaknesses
