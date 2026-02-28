# CRISP — React Native (Expo)

Native mobile app for CRISP, a daily communication practice tool. This is a full React Native rewrite of the [crisp web app](../crisp/) for App Store distribution.

## Architecture

```
crispreact/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx         # Root layout: auth guard, subscription gate, navigation
│   ├── session.tsx         # Full daily session (modal)
│   ├── prep.tsx            # Prep mode (entry → conversation → key messages)
│   ├── (auth)/             # Sign-in with email OTP
│   ├── (onboarding)/       # Welcome → Philosophy → Intake → StarterPath → FoundingSession → Paywall
│   └── (tabs)/             # Main app tabs
│       ├── index.tsx       # Home: greeting, start session, streak, checkpoint recovery
│       ├── patterns.tsx    # Your Patterns: voice model viewer
│       ├── workouts.tsx    # Workout Library: categories → drills → active → complete
│       └── settings.tsx    # Settings: name, onboarding replay, sign out
├── src/
│   ├── hooks/              # Business logic hooks (ported from web app)
│   │   ├── useAuth.ts      # Supabase auth (email OTP, session management)
│   │   ├── useSession.ts   # Session state machine (responding → thinking → feedback → drill → quality → closed)
│   │   ├── usePrepSession.ts   # Prep conversation flow
│   │   ├── usePromptEngine.ts  # AI prompt selection (personalized → SRS → Claude)
│   │   ├── useStreak.ts        # Streak tracking
│   │   ├── useWeaknessSRS.ts   # Spaced repetition for weakness drills
│   │   ├── useLibraryPatterns.ts # Voice model pattern analysis
│   │   └── useSubscription.ts  # RevenueCat subscription management
│   └── lib/                # Shared utilities (ported from web app)
│       ├── supabase.ts     # Supabase client with AsyncStorage
│       ├── claude.ts       # Claude API proxy client (calls Vercel serverless)
│       ├── storage.ts      # All Supabase CRUD operations
│       ├── prompts.ts      # System prompts for coaching, feedback, voice model
│       ├── drills.ts       # 40+ drills across 9 categories
│       ├── frameworks.ts   # SRS interval logic
│       ├── parseFeedback.ts    # Parse AI feedback into echo/name/drill/open
│       ├── intakeMapping.ts    # Map intake answers to voice model seed
│       ├── sessionCheckpoint.ts # AsyncStorage checkpoint save/restore
│       ├── voiceModelValidation.ts # Validate voice model JSON before DB writes
│       └── theme.ts        # Design tokens (colors, shared across all screens)
```

## Key Differences from Web App

| Aspect | Web (crisp/) | Native (crispreact/) |
|--------|-------------|---------------------|
| Framework | Vite + React DOM | Expo SDK 55 + React Native |
| Routing | Manual screen state in App.jsx | Expo Router (file-based) |
| Styling | Tailwind CSS + inline styles | StyleSheet.create() + theme.ts |
| Storage | localStorage | AsyncStorage |
| Auth persistence | Supabase default (localStorage) | AsyncStorage adapter |
| Env vars | VITE_* | EXPO_PUBLIC_* |
| API calls | Relative /api/claude | Full URL via EXPO_PUBLIC_API_URL |
| Voice input | Web Speech API | Not yet implemented (text-only) |
| Payments | None | RevenueCat ($44/year, 3-day trial) |
| Navigation | Footer buttons | Bottom tab bar |

## Setup

```bash
# Install dependencies
npm install

# Create .env file from template
cp .env.example .env
# Fill in your Supabase and API URL values

# Start dev server
npx expo start
```

## Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `EXPO_PUBLIC_API_URL` — Base URL of the Vercel deployment (e.g., `https://crisp.vercel.app`). The app calls `{API_URL}/api/claude` for all Claude API requests.
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` — RevenueCat iOS API key (optional in dev; without it, paywall is skipped)
- `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` — RevenueCat Android API key (optional)

## API Proxy

The mobile app does NOT call the Anthropic API directly. All Claude requests go through the Vercel serverless function at `/api/claude` in the crisp web app project. This function:
1. Validates the user's Supabase JWT
2. Uses the server-side `ANTHROPIC_API_KEY` (single key, not per-user)
3. Forwards the request to Anthropic and streams the response back

## User Flow

1. **Sign In** — Email OTP via Supabase
2. **Onboarding** (first time only):
   - Welcome → Philosophy → Intake (5 questions) → Starter Path → Founding Session → Paywall
3. **Daily Use** (tabs):
   - Home: start daily session, resume interrupted sessions, see streak
   - Patterns: view your voice model (after 3+ sessions)
   - Workouts: browse drill categories, do isolated technique practice
   - Settings: edit name, replay onboarding, sign out
4. **Session Flow**: prompt → respond → AI feedback → go deeper (up to 10x) → mark a moment → micro drill → quality signal → close
5. **Prep Mode** (after 5 sessions): describe situation → coaching conversation → distill key messages

## Subscription (RevenueCat)

- **Gate**: After founding session completion
- **Plan**: $44/year with 3-day free trial
- **Entitlement**: `pro`
- **Behavior without keys**: In dev (no REVENUECAT keys), paywall is skipped and all features are accessible

## Building for App Store

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Submit to App Store
eas submit --platform ios
```

## Database

Uses the same Supabase database as the web app. Key tables:
- `sessions` — Daily practice sessions with prompts, responses, feedback
- `voice_models` — JSON voice model per user (thinking style, expression patterns, growth edge)
- `streaks` — Current/longest streak, freeze count
- `weakness_srs` — Spaced repetition state for detected weaknesses
- `workout_sessions` — Completed drill records
- `workout_progress` — Per-drill completion counts
- `prep_sessions` — Prep mode conversations and key messages
