import { getStarterDrills } from './intakeMapping'

export const CATEGORIES = [
  { id: 'presence', name: 'Presence', subtitle: 'Regulating under pressure, not performing through it', description: 'Interoceptive accuracy; training the nervous system to stay in the Social Engagement System under pressure', color: '#4A90D9' },
  { id: 'thinking', name: 'Thinking', subtitle: 'The work that happens before you talk', description: 'Building the reflective override that catches cognitive bias before it becomes speech', color: '#C8A951' },
  { id: 'pattern-breaking', name: 'Pattern Breaking', subtitle: 'Replacing habits with conscious choices', description: 'Making conscious what the basal ganglia has made automatic in habitual communication', color: '#D94A4A' },
  { id: 'emotional-precision', name: 'Emotional Precision', subtitle: 'Saying what you actually feel', description: 'Closing the gap between what you feel and what you can accurately say', color: '#8B5CF6' },
  { id: 'articulation', name: 'Articulation', subtitle: 'Finding the exact right words', description: 'Word economy; saying exactly what you mean with nothing extra', color: '#059669' },
  { id: 'communication', name: 'Communication', subtitle: 'Landing your message with any audience', description: 'Landing your message with different audiences without losing yourself', color: '#D97706' },
  { id: 'voice', name: 'Voice', subtitle: 'Speaking as yourself, not a performance', description: 'Training the mPFC to drive expression rather than the dlPFC social monitor', color: '#DC2626' },
]

export const DIFFICULTY_GATES = {
  foundational: 1,
  intermediate: __DEV__ ? 1 : 15,
  advanced: __DEV__ ? 1 : 30,
}

export const DRILLS = [
  // ── PRESENCE (4 drills) ──────────────────────────────
  {
    id: 'somatic-tracking',
    name: 'Somatic Tracking',
    category: 'presence',
    difficulty: 'foundational',
    duration: 180,
    science: "Porges' polyvagal theory demonstrates that interoceptive awareness in the insular cortex is the foundation for accurate emotional reporting and ventral vagal activation.",
    theWhy: 'Authentic expression begins with detecting the raw data of the body before it becomes an emotion. Without body literacy, you are guessing at what you feel, and your words reflect that guesswork.',
    theDrill: 'Set a timer for 3 minutes. Close your eyes. Do 10 slow arm circles. Stop. Scan from head to feet. For each region (head, throat, chest, gut, hands, legs), name the sensation in one word: "tight," "warm," "buzzing," "nothing." Write all six words down. Do not interpret them as emotions \u2014 stay at the sensation level.',
    variations: [
      'After a difficult conversation, repeat the scan and compare to your baseline words.',
      'Do the scan standing with eyes open in a public space to train detection under social load.',
    ],
  },
  {
    id: 'physiological-sigh',
    name: 'Physiological Sigh',
    category: 'presence',
    difficulty: 'foundational',
    duration: 120,
    science: 'Huberman Lab respiratory physiology research shows that a double inhale followed by a long exhale clears CO2 from collapsed alveoli and triggers parasympathetic activation via Respiratory Sinus Arrhythmia.',
    theWhy: 'This is the fastest evidence-based tool for real-time arousal reduction without disengaging from the current activity. It gives you a physical reset in under 10 seconds.',
    theDrill: 'Inhale deeply through the nose. At the top, take a second short "sip" of air through the nose to maximally inflate the alveoli. Exhale slowly through the mouth for twice the duration of the inhale. Repeat 3 times. Rate your tension on a 1-10 scale before and after. Write both numbers down.',
    variations: [
      'Use before entering a high-stakes meeting and note the tension delta.',
      'Chain 5 sighs consecutively and track the cumulative tension drop.',
    ],
  },
  {
    id: 'emotion-cowat',
    name: 'Emotion COWAT',
    category: 'presence',
    difficulty: 'intermediate',
    duration: 300,
    science: "Barrett's Theory of Constructed Emotion shows that emotional granularity \u2014 the size of your emotion concept library \u2014 directly determines regulation capacity. The Controlled Oral Word Association Test (COWAT) format strengthens concept retrieval under time pressure.",
    theWhy: 'If you only have "good" and "bad," every feeling triggers a generic response. A large emotion vocabulary gives your brain high-quality, actionable information for precise expression.',
    theDrill: 'Set a timer for 60 seconds. Pick a category: "varieties of frustration." Write every emotion word you can that fits. No repeats, no pausing to judge. When the timer ends, count your words. Rest 30 seconds. Repeat with a new category: "shades of contentment." Then: "types of unease." Track your word counts across sessions.',
    variations: [
      'Use a letter constraint: emotion words starting with "D" in 60 seconds.',
      'After completing, pick your 3 least familiar words and use each in a sentence describing a real experience from the last week.',
    ],
  },
  {
    id: 'prosody-mirroring',
    name: 'Prosody Mirroring',
    category: 'presence',
    difficulty: 'intermediate',
    duration: 300,
    science: "Polyvagal theory shows that the middle ear muscles tune to high-frequency human speech when the ventral vagal complex is active. Practicing vocal prosody exercises the Social Engagement System's neural regulation of cranial nerves V, VII, IX, X, and XI.",
    theWhy: "A monotone voice under stress signals danger to listeners, triggering their defensive circuits. Training prosodic range keeps your Social Engagement System online and invites co-regulation from the person you're speaking with.",
    theDrill: 'Find a 30-second clip of a speaker with high vocal prosody (varied pitch, rhythm, warmth). Listen once. Play it again, this time repeating each phrase immediately after the speaker, matching their exact pitch contour and rhythm. Record yourself. Listen back and compare: where did your pitch flatten? Repeat the flattened phrases until they match.',
    variations: [
      "Use a clip in a language you don't speak to isolate pure prosodic matching from content.",
      'Record yourself telling a mundane story ("I went to the store") with 3 different emotional tones: excited, concerned, calm. Listen back for pitch variety.',
    ],
  },

  // ── THINKING (5 drills) ──────────────────────────────
  {
    id: 'pre-mortem',
    name: 'Pre-Mortem',
    category: 'thinking',
    difficulty: 'foundational',
    duration: 300,
    science: "Mitchell, Russo & Pennington (1989) demonstrated that prospective hindsight \u2014 treating failure as a historical fact rather than a future possibility \u2014 increases accuracy of risk identification by 30%. Gary Klein operationalized this as the pre-mortem technique.",
    theWhy: 'Your brain processes your future self as a stranger, which activates third-person objectivity. Framing failure as already having happened bypasses the optimism bias that blinds first-person planning.',
    theDrill: 'Pick a plan you are currently working on (a project, a conversation, a pitch). Write at the top: "It is 6 months from now. This has failed spectacularly. I am explaining why." Set a timer for 5 minutes. Write every reason it failed. Do not filter for likelihood \u2014 volume matters. When done, circle the 3 reasons that made you most uncomfortable. Those are your blind spots.',
    variations: [
      'Do a "pre-mortem of the conversation" before a difficult talk: "The conversation went badly. Why?"',
      'Run it with a partner: each person writes independently, then compare lists to find shared blind spots.',
    ],
  },
  {
    id: 'first-principles-deconstruction',
    name: 'First Principles Deconstruction',
    category: 'thinking',
    difficulty: 'intermediate',
    duration: 420,
    science: "Aristotle's first principles reasoning, validated by cognitive science research on gist-reasoning (Gamino et al., 2010), shows that stripping analogy to find base facts significantly improves novel problem-solving in ill-structured domains.",
    theWhy: 'Most decisions are made by analogy ("Company X did this, so we should too"). Analogies carry historical artifacts. First principles force you to rebuild from verified truths, which produces solutions that fit your actual situation.',
    theDrill: 'Pick a belief you hold about communication (e.g., "You should always start with small talk"). Write it down. Below it, write "Why?" and answer. Below that answer, write "Why?" again. Repeat 5 times. At the bottom, you should reach a base fact or discover the belief is an inherited convention with no foundation. Write the base fact or write "convention \u2014 no base."',
    variations: [
      'Apply to a business decision: list every assumption, then mark each as "base fact" or "analogy."',
      'Set a 3-minute constraint to force faster deconstruction under pressure.',
    ],
  },
  {
    id: 'second-order-consequence-mapping',
    name: 'Second-Order Consequence Mapping',
    category: 'thinking',
    difficulty: 'intermediate',
    duration: 420,
    science: "Systems thinking research and second-order Theory of Mind studies show that most planning failures stem from first-order-only analysis \u2014 predicting the immediate result without mapping the ecosystem's response.",
    theWhy: 'Every action triggers reactions from other people, systems, and contexts. If you only think about the immediate outcome, you are surprised by the ripple effects. Second-order thinking turns surprise into anticipation.',
    theDrill: 'Pick a decision you\'re about to make. Draw two columns: "First-Order Effects" and "Second-Order Effects." In the first column, list what happens immediately. In the second column, for each first-order effect, ask "And then what?" Write at least 2 responses per first-order effect. Circle any second-order effects that conflict with your original goal.',
    variations: [
      'Add a "Third-Order" column for advanced practice.',
      'Apply to a conversation: "If I say X, they will feel Y, and then they will do Z."',
    ],
  },
  {
    id: 'assumption-audit',
    name: 'Assumption Audit',
    category: 'thinking',
    difficulty: 'foundational',
    duration: 300,
    science: "Stanovich's dysrationalia research shows that confirmation bias is a mindware gap \u2014 intelligent people routinely fail to red-team their own beliefs because the reflective mind does not automatically engage in belief scrutiny.",
    theWhy: "You cannot fix a bias you cannot see. The assumption audit forces the reflective mind to override the autonomous mind's tendency to seek confirming evidence, which is the single most important skill for clear thinking.",
    theDrill: 'Pick an opinion you stated in the last 48 hours. Write it at the top. Below, list every assumption required for that opinion to be true. For each assumption, write one piece of evidence that would disprove it. If you cannot think of any disconfirming evidence, flag the assumption as "untested." Commit to investigating one "untested" assumption before your next session.',
    variations: [
      'Do this with a partner who holds the opposing view \u2014 they write the disconfirming evidence.',
      'Apply to a professional presentation: audit every claim in your slide deck.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Each assumption must be explicitly paired with a specific piece of disconfirming evidence. Any assumption with no disconfirming evidence must be flagged as "untested."',
  },
  {
    id: 'brier-score-forecasting',
    name: 'Brier Score Forecasting',
    category: 'thinking',
    difficulty: 'advanced',
    duration: 600,
    science: "Tetlock's superforecasting research demonstrates that assigning granular probabilities to predictions, tracking accuracy with Brier scores, and updating beliefs via Bayesian reasoning produces forecasters who outperform professional intelligence analysts.",
    theWhy: 'Binary thinking ("it will / it won\'t") prevents learning from near-misses. Granular probability assignment forces calibration \u2014 and calibration is the difference between confidence and overconfidence.',
    theDrill: 'Pick an event in your life or the news that will resolve within 30 days. Assign a probability from 1-99% (50% is banned \u2014 it\'s a cop-out). Write your "Inside View" (reasons specific to this case) and your "Outside View" (base rate \u2014 how often does this type of event happen?). When the event resolves, calculate: Brier Score = (forecast - outcome)\u00B2. Log the score. After 10 forecasts, review your calibration curve: when you say 80%, are you right 80% of the time?',
    variations: [
      'Forecast the outcome of a conversation before it happens: "70% chance they agree." Track accuracy.',
      'Revisit a forecast mid-period and practice Bayesian updating: adjust the probability based on new information and log the update with reasoning.',
    ],
  },

  // ── PATTERN BREAKING (5 drills) ──────────────────────
  {
    id: 'if-then-blueprint',
    name: 'If-Then Blueprint',
    category: 'pattern-breaking',
    difficulty: 'foundational',
    duration: 300,
    science: 'Implementation intentions research (Gollwitzer) shows that linking a situational cue to a pre-decided response in an "If-Then" format creates strategic automaticity \u2014 the response triggers without effortful deliberation, bypassing the basal ganglia\'s habitual loop.',
    theWhy: 'Knowing you want to "speak more directly" is useless in the moment. Pre-deciding the exact trigger and exact response turns intention into automatic action at the speed of the habit it replaces.',
    theDrill: 'Identify one communication habit you want to change (e.g., over-qualifying). Write the trigger: "If [specific situational cue \u2014 e.g., \'I notice I\'m about to say I might be wrong but\']." Write the response: "Then I will [specific replacement behavior \u2014 e.g., \'state my point directly and pause.\']" Say the if-then plan out loud 3 times. Visualize the trigger scenario and mentally rehearse executing the replacement. Write the plan on a card and keep it visible for the day.',
    variations: [
      'Create 3 if-then plans for the same habit but different triggers (meeting, email, casual conversation).',
      'After one week, audit: how many times did the trigger fire? How many times did you execute the replacement?',
    ],
  },
  {
    id: 'bluf-practice',
    name: 'BLUF Practice',
    category: 'pattern-breaking',
    difficulty: 'foundational',
    duration: 300,
    science: 'Plain language and military communication research shows that Bottom Line Up Front (BLUF) information hierarchy \u2014 stating the conclusion in the first 10 words \u2014 dramatically reduces cognitive load for the listener and prevents the speaker from burying the point.',
    theWhy: 'Over-explaining and burying the lead are basal ganglia defaults driven by relational anxiety. BLUF forces the point to the surface before the anxiety loop can activate. It is a structural override of a behavioral pattern.',
    theDrill: 'Pick a message you need to deliver today (email, verbal update, request). Write it in 3 sentences. The first sentence must contain the bottom line \u2014 the single thing the recipient needs to know or do. The second sentence provides one piece of essential context. The third sentence states the deadline or next step. Read it aloud. If the first sentence does not answer "What do I need to know?", rewrite it.',
    variations: [
      'Take a past email longer than 5 sentences and rewrite it in BLUF format in 60 seconds.',
      'Practice BLUF verbally: deliver a 15-second status update where the first sentence is the conclusion.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'First sentence must contain the bottom line — the single thing the recipient needs to know or do. Second sentence: one piece of essential context. Third sentence: deadline or next step. If the first sentence doesn\'t answer "What do I need to know?", it fails.',
  },
  {
    id: 'silent-pause-competing-response',
    name: 'Silent Pause Competing Response',
    category: 'pattern-breaking',
    difficulty: 'intermediate',
    duration: 300,
    science: 'Habit Reversal Training (HRT) research demonstrates that an effective competing response must be physically incompatible with the target habit. For vocalized fillers ("um," "uh," "like"), the competing response is a 2-second silent pause \u2014 you cannot fill and be silent simultaneously.',
    theWhy: 'Filler words are not a language problem. They are an inhibitory control failure \u2014 the brain cannot tolerate silence while searching for the next word. Training the silent pause strengthens the supervisory attentional system (SAS) and replaces a credibility-eroding tic with executive presence.',
    theDrill: 'Pick a topic you know well. Set a timer for 2 minutes. Speak about it continuously. Every time you notice an urge to say "um," "uh," "so," or "like," stop completely. Hold silence for a full 2 seconds. Then continue. Record yourself. Count fillers in the first minute vs. the second minute.',
    variations: [
      'Have a partner tap the table every time they hear a filler \u2014 the immediate feedback accelerates awareness training.',
      'Increase difficulty: speak about a topic you know poorly, where the retrieval gaps are larger and the urge to fill is stronger.',
    ],
  },
  {
    id: '80-20-listening-drill',
    name: '80/20 Listening Drill',
    category: 'pattern-breaking',
    difficulty: 'intermediate',
    duration: 600,
    science: 'Behavioral activation research shows that conversational dominance is a basal ganglia default \u2014 the urge to fill silence and prove value through speaking. The 80/20 rule disrupts this default by structurally forcing listening to be the primary activity.',
    theWhy: 'Most communication failures are listening failures. If your default is to speak 60%+ of the time, you are missing the information that would make your 20% surgical. This drill trains the physical tolerance of silence and the cognitive skill of strategic questioning.',
    theDrill: 'In your next 1-on-1 conversation, set an internal rule: speak no more than 20% of the time. Your 20% must consist only of questions and brief reflections \u2014 no opinions, no stories, no advice. After the conversation, write down: what you learned that you would have missed if you had spoken more, and the hardest moment where you wanted to speak but didn\'t.',
    variations: [
      'In a group setting, track your airtime. Were you above or below 20%? What triggered the urge to exceed it?',
      'Combine with Reflective Listening: your 20% must be complex reflections (inferring meaning), not just parroting.',
    ],
  },
  {
    id: 'stop-technique',
    name: 'STOP Technique',
    category: 'pattern-breaking',
    difficulty: 'foundational',
    duration: 120,
    science: 'Somatic grounding research shows that pattern interruption at the nervous system level \u2014 physically pausing before re-engaging \u2014 breaks the automatic stimulus-response chain that drives reactive communication.',
    theWhy: 'You cannot change a pattern you are already executing. STOP creates a 10-second gap between the trigger and the response. That gap is where choice lives. Without it, the basal ganglia runs the show.',
    theDrill: 'When you notice tension rising in a conversation (or anticipate it), execute:\nS \u2014 Stop. Freeze all movement and speech.\nT \u2014 Take a breath. One slow diaphragmatic breath, expanding the belly.\nO \u2014 Observe. Name one physical sensation without judgment ("tight jaw," "fast heartbeat").\nP \u2014 Proceed. Resume speaking from the observed state, not the reactive state.\nPractice this 3 times today in low-stakes moments (before answering a phone call, before replying to an email, before entering a room).',
    variations: [
      'Use STOP before every response in a 10-minute conversation to build the habit through massed practice.',
      'After STOP, add a physiological sigh before Proceeding for a double-layer reset.',
    ],
  },

  // ── EMOTIONAL PRECISION (5 drills) ───────────────────
  {
    id: 'gendlins-focusing',
    name: "Gendlin's Focusing",
    category: 'emotional-precision',
    difficulty: 'intermediate',
    duration: 600,
    science: "Eugene Gendlin's six-step Focusing technique targets the pre-verbal felt sense \u2014 a bodily awareness that precedes linguistic labeling. Gendlin's research showed that successful therapy patients were those who intuitively checked in with this somatic layer. The \"bodily shift\" (a physical release of tension) is the hallmark of authentic labeling.",
    theWhy: 'Most emotion words are applied top-down \u2014 you decide what you "should" feel based on the situation. Focusing works bottom-up \u2014 you wait for the body to tell you what it actually feels. The difference is the gap between performing emotion and expressing it.',
    theDrill: '1. Clear a space. Sit quietly. Internally list everything weighing on you. For each one, say "Yes, that\'s there" and set it aside. Do not enter any problem.\n2. Felt sense. Choose one issue. Don\'t analyze it. Ask: "What does all of this feel like in my body?" Wait. Let a vague, murky physical sense form.\n3. Handle. Wait for a word, phrase, or image to rise from the felt sense. It might be "heavy," "stuck," "tangled," or an image.\n4. Resonate. Check the handle against the felt sense. Go back and forth: does "heavy" match? If the body tightens, try another word. If it releases slightly, the handle fits.\n5. Ask. Ask the felt sense: "What makes this whole thing so [handle]?" Wait. Do not answer intellectually. Let the body respond.\n6. Receive. Welcome whatever comes with the shift. Write it down.',
    variations: [
      'Use Focusing before a difficult conversation to identify what you actually need to say vs. what you planned to say.',
      'Practice with a partner: they ask "What\'s the felt sense?" and you describe it aloud, checking each word against the body in real time.',
    ],
  },
  {
    id: 'mood-meter-granularity',
    name: 'Mood Meter Granularity',
    category: 'emotional-precision',
    difficulty: 'foundational',
    duration: 180,
    science: 'Brackett and the Yale Center for Emotional Intelligence developed the RULER framework, with the Mood Meter mapping emotions along two axes: energy (high/low) and pleasantness (positive/negative). Research shows high emotional granularity reduces mood disorder incidence and improves stress resilience.',
    theWhy: '"I feel bad" activates a generic coping response. "I feel dismissed" activates a specific, actionable response. Granularity turns emotional noise into emotional signal.',
    theDrill: 'Check in with yourself right now. Place yourself on a 2x2 grid:\n\u2022 X-axis: Pleasantness (unpleasant \u2190 \u2192 pleasant)\n\u2022 Y-axis: Energy (low \u2193 \u2192 high \u2191)\n\nWhich quadrant are you in? Red (high energy, unpleasant), Blue (low energy, unpleasant), Yellow (high energy, pleasant), Green (low energy, pleasant)? Now find the most precise word for your position. Not "good" \u2014 try "quietly optimistic" or "cautiously relieved." Write the word. If you cannot find one granular enough, you\'ve found an edge of your emotional vocabulary. Look one up and add it to your list.',
    variations: [
      'Do a Mood Meter check-in at 3 different times today. Compare the three words \u2014 what patterns emerge?',
      'After a conversation, place yourself on the grid and identify what shifted your position.',
    ],
  },
  {
    id: 'handle-check',
    name: 'Handle Check',
    category: 'emotional-precision',
    difficulty: 'intermediate',
    duration: 300,
    science: "Gendlin's resonating step \u2014 testing a word against the body's felt sense \u2014 confirms authenticity through physical release, not cognitive approval. The RVLPFC-Amygdala inhibitory pathway is activated when the label matches the internal state, producing measurable arousal reduction.",
    theWhy: 'Many people use "around-the-feeling" language \u2014 words that describe the vicinity of the emotion without nailing it. The Handle Check trains the habit of not settling for an approximate label. Precision of language is downstream of precision of sensing.',
    theDrill: 'Name how you feel right now in one word. Say it aloud. Pause. Check your body: does it relax, tighten, or stay neutral? If it tightens or stays neutral, the word is wrong. Try another. Keep trying until you feel a micro-release \u2014 a small sigh, a softening, a sense of "yes, that\'s it." Write the final word and note how many attempts it took.',
    variations: [
      'After a charged interaction, do a Handle Check before responding. The right word will change what you say.',
      'Practice with physical sensations first (hunger, fatigue) before moving to emotional states \u2014 the body feedback is more obvious.',
    ],
  },
  {
    id: 'expressive-writing-causal-markers',
    name: 'Expressive Writing with Causal Markers',
    category: 'emotional-precision',
    difficulty: 'foundational',
    duration: 600,
    science: "Pennebaker's four-decade expressive writing paradigm shows that health improvements (fewer doctor visits, improved immune function, higher GPA) are predicted not by what people write about but by their increasing use of causal words (\"because,\" \"reason,\" \"cause\") and insight words (\"realize,\" \"understand,\" \"know\"). These markers indicate the shift from fragmented venting to coherent narrative construction.",
    theWhy: 'Writing about a problem without building a causal story is rumination. Writing with "because" and "realize" is processing. This drill trains the specific linguistic structure that converts emotional overwhelm into cognitive clarity.',
    theDrill: 'Set a timer for 10 minutes. Write continuously about something that is bothering you. Do not stop, do not edit, do not censor. After the timer, re-read what you wrote. Highlight every causal word (because, reason, since, cause, effect) in one color and every insight word (realize, understand, know, think, learn) in another. Count each. If you have fewer than 3 of either, rewrite the last paragraph specifically forcing yourself to use "because" and "I realize."',
    variations: [
      'Do this for 4 consecutive days on the same topic. Track whether causal and insight word counts increase across sessions (they should \u2014 this is the signal of processing).',
      'Rewrite the piece from a third-person perspective ("He felt...because...") to practice the perspective shift that predicts cognitive flexibility.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Writing should contain causal words (because, since, reason, cause) and insight words (realize, understand, know, think, learn). Fewer than 3 of either type indicates venting rather than processing.',
  },
  {
    id: 'i-feel-vs-i-am',
    name: '"I Feel" vs "I Am" Distinction',
    category: 'emotional-precision',
    difficulty: 'foundational',
    duration: 180,
    science: "Siegel's mindsight framework demonstrates that the linguistic shift from \"I am angry\" (identity fusion) to \"I feel anger\" (transient observation) creates psychological distance from the emotion. This shift reactivates the prefrontal cortex and disrupts amygdala hijack by framing emotion as a weather event rather than a permanent state.",
    theWhy: 'When you say "I am anxious," you become anxiety. When you say "I notice anxiety," you observe it. Observers have choices. Identities do not. This 2-word linguistic shift is the smallest possible intervention with the largest possible leverage on emotional regulation.',
    theDrill: 'For the next hour, catch every internal or spoken instance of "I am [emotion]." Replace it with "I notice [emotion]" or "I feel [emotion] right now." Write down each catch:\n\u2022 Original: "I am stressed"\n\u2022 Replacement: "I notice stress in my chest right now"\n\nTrack how many catches you make. The number will increase as awareness sharpens \u2014 that is the point.',
    variations: [
      'Extend to a full day. Set a phone reminder every 2 hours to check: "Am I fused with an emotion right now?"',
      'Apply to other people: instead of "He is rude," practice "He is behaving in a way that I interpret as dismissive." Notice how it changes your response.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Each entry must show the original "I am [emotion]" statement paired with the replacement "I notice [emotion]" or "I feel [emotion] right now" framing. The replacement must be an observation, not a re-labeling.',
  },

  // ── ARTICULATION (5 drills) ──────────────────────────
  {
    id: 'semantic-feature-analysis',
    name: 'Semantic Feature Analysis',
    category: 'articulation',
    difficulty: 'foundational',
    duration: 300,
    science: 'Semantic Feature Analysis (SFA), adapted from aphasia therapy, strengthens the entire semantic network around a target concept. By activating multiple features (category, action, properties, location, association), the brain creates redundant retrieval pathways that accelerate lexical access during speech.',
    theWhy: '"I can\'t find the right word" is a retrieval failure, not a vocabulary failure. You often know the word \u2014 you just can\'t access it fast enough. SFA builds multiple roads to the same destination so that when one path is blocked under pressure, others are available.',
    theDrill: 'Pick a concept you struggled to articulate recently (e.g., "autonomy"). Fill in this map:\n\u2022 Group: What category does it belong to? (value, need, right)\n\u2022 Action: What does it do? (enables self-direction, removes external control)\n\u2022 Properties: What are its qualities? (invisible, fragile, non-negotiable)\n\u2022 Location: Where is it found? (in decisions, in boundaries, in daily routines)\n\u2022 Association: What does it remind you of? (breathing room, sovereignty, choosing your own path)\n\nNow use the concept in 3 different sentences, each drawing from a different feature.',
    variations: [
      'Do SFA on an emotion word from your Mood Meter practice to deepen both emotional and lexical precision.',
      'Speed round: complete the SFA map for 3 different concepts in 5 minutes.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Must map at least Group, Action, Properties, Location, and Association for the concept. Then use the concept in 3 sentences each drawing from a different feature.',
  },
  {
    id: 'shrinking-time-rebuttal',
    name: 'Shrinking Time Rebuttal',
    category: 'articulation',
    difficulty: 'intermediate',
    duration: 420,
    science: 'Competitive debate training research shows that forced deletion of verbosity under time constraint produces immediate improvements in word economy. When time shrinks, the brain is forced to prioritize \u2014 and what survives the cut is the essential message.',
    theWhy: "Most people don't know which of their words are load-bearing and which are filler. Shrinking time makes the filler impossible to sustain. What you say in 60 seconds that you first said in 3 minutes is the version worth keeping.",
    theDrill: 'Pick a point you made recently in a conversation or meeting. Restate it in 3 minutes (set a timer). Now restate the exact same points in 2 minutes. Now in 1 minute. Write down what you cut at each stage. The words that survived all three rounds are your essential message. The rest was noise.',
    variations: [
      'Final round: deliver it in 30 seconds. What single sentence carries the entire argument?',
      'Record all three versions. Listen back \u2014 the 1-minute version almost always sounds more authoritative than the 3-minute version.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Must show three progressively shorter versions of the same argument. The essential message must survive all three compression stages — if the core point disappears, the compression went too far.',
  },
  {
    id: 'rephrasing-for-resonance',
    name: 'Rephrasing for Resonance',
    category: 'articulation',
    difficulty: 'intermediate',
    duration: 300,
    science: "Levelt's speech production model shows that lexical access follows specific pathways from concept to lemma to phonological form. Forcing alternate phrasings activates new lexical pathways and prevents the speaker from locking into a single vocal pattern \u2014 a phenomenon where the same sentence gets repeated with minor variations because the brain is stuck on one retrieval route.",
    theWhy: 'When you can say the same thing three different ways, you own the idea. When you can only say it one way, the words own you. Rephrasing builds the flexibility to adapt your message to any audience without losing meaning.',
    theDrill: 'Take a sentence you recently said or wrote. Rewrite it 3 times, each version using completely different words (no keywords from the original). Rate each version: which is clearest? Which is most emotionally resonant? Which is most concise? The winner becomes your default.',
    variations: [
      'Rephrase for different audiences: version 1 for a colleague, version 2 for a child, version 3 for a skeptic.',
      'Do this verbally with no writing \u2014 forces real-time lexical flexibility under the pressure of silence.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Must produce 3 versions using completely different words — no key words from the original repeated across versions — while preserving the core meaning.',
  },
  {
    id: 'denominalization-drill',
    name: 'Denominalization Drill',
    category: 'articulation',
    difficulty: 'foundational',
    duration: 300,
    science: 'Plain language research identifies nominalization \u2014 converting verbs into abstract nouns (e.g., "decide" \u2192 "a decision was made") \u2014 as the primary drain on sentence clarity. Nominalizations strip agency, hide the actor, and require more working memory to parse.',
    theWhy: 'Nominalized language sounds "professional" but communicates less. Every zombie noun you convert back to an active verb makes your sentence shorter, clearer, and more forceful. This is the single highest-leverage edit for written and spoken clarity.',
    theDrill: 'Take a paragraph from a recent email or document you wrote. Circle every noun that was originally a verb:\n\u2022 "implementation" \u2192 implement\n\u2022 "determination" \u2192 determine\n\u2022 "requirement" \u2192 require\n\u2022 "utilization" \u2192 use\n\nRewrite each sentence with the verb restored and the actor named. Compare the original and rewritten versions for word count and clarity. The rewrite should be shorter and more direct.',
    variations: [
      'Listen to a podcast or meeting recording. Count nominalizations in a 2-minute segment.',
      'Rewrite a company announcement in denominalized form. Note how the tone shifts from bureaucratic to human.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Must identify nominalized nouns (abstract nouns derived from verbs like "utilization," "determination," "implementation") and rewrite each sentence with the active verb restored and the actor named. Rewrite should be noticeably shorter.',
  },
  {
    id: 'strategic-silent-pause',
    name: 'Strategic Silent Pause',
    category: 'articulation',
    difficulty: 'advanced',
    duration: 300,
    science: 'Inhibitory control research shows that replacing vocalized fillers with silence is a hallmark of executive presence. The supervisory attentional system (SAS) must override the default urge to produce sound during retrieval gaps. Studies demonstrate that audiences perceive speakers who pause silently as more confident and credible than those who fill gaps with "um."',
    theWhy: 'Silence is not the absence of communication \u2014 it is a signal of control. A speaker who can hold silence while thinking demonstrates that they are more committed to precision than to the appearance of fluency. This is the vocal signature of someone who says what they mean.',
    theDrill: 'Prepare a 2-minute talk on a topic you care about. Deliver it with a rule: after every sentence, pause for a full 2 seconds of silence before beginning the next sentence. Record yourself. Listen back. Note: does the silence feel uncomfortable to you? (It won\'t to your audience \u2014 it will feel authoritative.) Count any fillers that crept in despite the rule.',
    variations: [
      'Increase to 3-second pauses. Then try 4 seconds. Find your edge of discomfort.',
      'During a real meeting, insert one deliberate 3-second pause before your most important point. Observe the room\'s attention shift.',
    ],
  },

  // ── COMMUNICATION (5 drills) ─────────────────────────
  {
    id: 'video-camera-observation',
    name: 'Video Camera Observation',
    category: 'communication',
    difficulty: 'foundational',
    duration: 300,
    science: "Rosenberg's Nonviolent Communication (NVC) distinguishes sensory observation from moralistic evaluation using the \"video camera\" test: if a camera cannot record it, it is an evaluation, not an observation. This metacognitive separation reduces defensiveness in the listener by removing blame from the description.",
    theWhy: '"You were dismissive" is a judgment. "You looked at your phone while I was talking" is a fact. The difference between these two sentences is the difference between a conversation and a fight. Observation precision is the foundation of non-reactive communication.',
    theDrill: 'Recall a recent interaction that bothered you. Write your initial description (e.g., "She was rude and didn\'t care"). Now rewrite using only what a camera would record: specific actions, words, gestures, timing. Eliminate all adjectives that require interpretation. Test: could a stranger watching the footage confirm your sentence? If yes, it\'s an observation. If no, rewrite.',
    variations: [
      'Practice in real-time: during a conversation, mentally describe what you observe before reacting. "He just crossed his arms" vs. "He\'s being defensive."',
      'Write observations for 3 different interactions this week. Notice how removing evaluation changes what you want to say in response.',
    ],
    needsFeedback: true,
    feedbackCriteria: 'Description must pass the camera test: only what a camera would record — specific actions, words, gestures, timing. No adjectives requiring interpretation ("rude," "dismissive"), no judgments about intent or character.',
  },
  {
    id: 'social-judgment-mapping',
    name: 'Social Judgment Mapping',
    category: 'communication',
    difficulty: 'intermediate',
    duration: 420,
    science: "Sherif's Social Judgment Theory (SJT) shows that persuasion fails not because the argument is weak but because it falls within the listener's latitude of rejection. Ego-involvement narrows the latitude of acceptance. Effective persuasion targets the latitude of non-commitment \u2014 the range of positions where the listener is neutral.",
    theWhy: "If you push a point too far into someone's rejection zone, they don't just disagree \u2014 they perceive your position as more extreme than it actually is (contrast effect). Mapping the latitudes before you speak lets you calibrate your message to land in the zone where it will actually be heard.",
    theDrill: 'Pick a disagreement you\'re navigating. Write the other person\'s anchor position (their strongest belief on the topic). Below it, write 5 statements ranging from their position toward yours. For each, estimate: Acceptance (they\'d nod), Non-commitment (they\'d listen), or Rejection (they\'d push back). Your message should target the boundary between Non-commitment and Acceptance \u2014 that\'s where persuasion happens.',
    variations: [
      'Do this for a presentation to a mixed audience. Map latitudes for 2-3 different audience segments.',
      'After the conversation, evaluate: where did your message actually land? Adjust the map based on real feedback.',
    ],
  },
  {
    id: 'steel-manning-rapoports-rules',
    name: "Steel-Manning via Rapoport's Rules",
    category: 'communication',
    difficulty: 'intermediate',
    duration: 420,
    science: "Daniel Dennett, building on Anatol Rapoport's work, demonstrates that accurately reformulating the opposing position increases perceived trustworthiness and reasonableness. Experimental evidence (Wachsmuth et al., 2025) shows that straw-manning significantly reduces persuasiveness, while steel-manning makes subsequent counter-arguments more effective because they directly address the opponent's strongest concerns.",
    theWhy: "When someone feels misrepresented, they stop listening. When they feel understood \u2014 especially when you state their position better than they did \u2014 their defensive circuits deactivate. Steel-manning is not a concession. It is the most efficient path to being heard in return.",
    theDrill: "Pick a position you disagree with (political, professional, personal). Follow Rapoport's Rules:\n1. Re-express: Write the other person's position so clearly and fairly that they would say, \"I wish I'd put it that way.\"\n2. List agreements: Write 2-3 points of genuine common ground (not platitudes).\n3. Acknowledge learning: Write one thing you genuinely learned or hadn't considered.\n4. Only then: Write your counter-argument.\n\nRead all four parts together. Does the counter-argument hit harder after the setup? It should.",
    variations: [
      'Practice verbally with a partner: they state a position, you steel-man it in real-time, they rate accuracy.',
      "Apply to an email disagreement: rewrite your response using Rapoport's Rules before sending.",
    ],
    needsFeedback: true,
    feedbackCriteria: "Must follow all four steps in order: (1) restate opposing position so clearly they'd say 'I wish I'd put it that way,' (2) list genuine common ground, (3) name something actually learned from their view, (4) then and only then counter-argue.",
  },
  {
    id: 'nvc-ofnr-expression',
    name: 'NVC OFNR Expression',
    category: 'communication',
    difficulty: 'foundational',
    duration: 300,
    science: "Rosenberg's Nonviolent Communication structures expression into four components \u2014 Observation, Feeling, Need, Request \u2014 that move dialogue from strategy clash to value alignment. Research shows NVC reduces defensiveness and increases cooperation by grounding assertions in universal human needs.",
    theWhy: 'Most requests fail because they skip the need. "Can you stop doing that?" is a demand. "When you interrupt, I feel dismissed because I need to be heard. Would you be willing to let me finish my point?" is a request that the listener can actually engage with. OFNR is the structure that makes this possible.',
    theDrill: 'Think of a request you need to make. Fill in:\n\u2022 O (Observation): "When [specific, camera-testable action]..."\n\u2022 F (Feeling): "I feel [emotion word \u2014 not a thought disguised as a feeling]..."\n\u2022 N (Need): "Because I need [universal human need: respect, safety, autonomy, connection]..."\n\u2022 R (Request): "Would you be willing to [specific, actionable, doable behavior]?"\n\nWrite the complete OFNR statement. Read it aloud. Check: is the Observation free of evaluation? Is the Feeling a pure emotion (not "I feel like you don\'t care" \u2014 that\'s a thought)? Is the Need universal (would anyone understand it)? Is the Request specific enough to say yes or no to?',
    variations: [
      'Write OFNR for a past conflict that went badly. How would it have changed the outcome?',
      'Flip the drill: someone makes a complaint to you. Listen for their implicit O, F, N, and R. Reflect it back.',
    ],
    needsFeedback: true,
    feedbackCriteria: "Must contain all four parts: O (camera-testable observation, no evaluation), F (pure emotion word — not 'I feel like you don't care' which is a thought), N (universal human need), R (specific doable request the listener can say yes/no to).",
  },
  {
    id: 'reflective-listening-levels',
    name: 'Reflective Listening Levels',
    category: 'communication',
    difficulty: 'advanced',
    duration: 600,
    science: 'Motivational Interviewing (MI) research identifies reflective listening as the most critical OARS skill. Reflections exist on a hierarchy from simple (repeating) to complex (inferring unstated meaning). Complex reflections predict therapeutic alliance, behavior change, and conflict resolution.',
    theWhy: 'Most people listen to respond, not to understand. Simple reflection (parroting back) shows you heard the words. Complex reflection (inferring the underlying feeling or meaning) shows you heard the person. The difference is what makes someone feel truly seen.',
    theDrill: 'In your next conversation, practice 4 levels of reflection:\n1. Repeat: Echo a key phrase they said, verbatim.\n2. Rephrase: Substitute synonyms but keep the meaning.\n3. Paraphrase: Infer the underlying meaning in your own words.\n4. Reflect feeling: Name the emotion beneath the content. ("It sounds like that was really disheartening.")\n\nAfter the conversation, write down which level you used most. Challenge yourself to use Level 3 or 4 at least 3 times in your next conversation.',
    variations: [
      'Practice double-sided reflection: "On one hand, you want to stay because of the team. On the other hand, the role isn\'t growing." This acknowledges ambivalence without resolving it.',
      'Record a conversation (with permission). Transcribe your reflections. Rate each one: Level 1, 2, 3, or 4?',
    ],
  },

  // ── VOICE (5 drills) ─────────────────────────────────
  {
    id: 'defamiliarization-recording',
    name: 'Defamiliarization Recording',
    category: 'voice',
    difficulty: 'foundational',
    duration: 300,
    science: 'Self-monitoring scale research (Snyder) shows that high self-monitors adopt performance patterns they cannot detect in real time. Recording and listening back with objective distance reveals vocal tics, pitch flattening, and register shifts that signal the switch from authentic mPFC-driven expression to dlPFC social monitoring.',
    theWhy: 'You cannot change what you cannot hear. The gap between how you think you sound and how you actually sound is where the performance voice hides. Recording collapses that gap and makes the invisible visible.',
    theDrill: 'Pick a topic you know intimately. Record yourself speaking about it for 3 minutes \u2014 no script, no preparation. Play it back. Listen for:\n\u2022 Vocal tics (repeated words, filler sounds)\n\u2022 Pitch changes (where does your voice go up or flatten?)\n\u2022 Register shifts (where do you start "performing" vs. speaking naturally?)\n\u2022 Moments of flow (where did you sound most like yourself?)\n\nWrite down 2 performance patterns and 1 moment of authenticity.',
    variations: [
      'Record two versions: one as if talking to your closest friend, one as if presenting to a room. Compare them. What changes?',
      'Do this weekly. Track whether the performance patterns decrease and the authenticity moments increase.',
    ],
  },
  {
    id: 'externalizing-the-monitor',
    name: 'Externalizing the Monitor',
    category: 'voice',
    difficulty: 'intermediate',
    duration: 600,
    science: "Michael White's narrative therapy technique of externalization separates the person from the problem. Instead of \"I was being fake,\" the frame becomes \"The Performance Voice showed up.\" This linguistic move \u2014 grounded in post-structuralist psychology \u2014 reduces shame and creates agency by positioning the problem as a character that can be observed, questioned, and resisted.",
    theWhy: 'Shame about inauthenticity locks you deeper into the performance. Externalization breaks the cycle. When the Performance Voice is a "character," you can study its triggers, map its influence, and notice when it\'s absent \u2014 without the self-attack that makes authentic expression harder.',
    theDrill: 'Name the part of you that performs (e.g., "The Professional," "The Pleaser," "The Expert"). Write for 10 minutes about a recent interaction where it showed up. Refer to it in the third person:\n\u2022 "The Professional took over when the CEO walked in."\n\u2022 "It made my voice go higher and my words get longer."\n\u2022 "It was trying to protect me from looking incompetent."\n\nNow write: when was the last time The Professional was quiet? What was happening? Who were you with? What made it unnecessary?',
    variations: [
      "Map the Monitor's influence: draw a diagram showing which relationships, settings, and topics activate it most.",
      'Over 5 days, write a brief daily log: "The [name] showed up / didn\'t show up today because..."',
    ],
  },
  {
    id: 'unique-outcome-scavenger-hunt',
    name: 'Unique Outcome Scavenger Hunt',
    category: 'voice',
    difficulty: 'intermediate',
    duration: 420,
    science: 'White\'s narrative therapy distinguishes the "dominant story" (problem-saturated, thinly described) from the "preferred story" (authentic, thickly described). Unique outcomes are moments that contradict the dominant story \u2014 thin traces of the authentic self that already exist but have been filtered out by the problem narrative.',
    theWhy: "You don't need to build an authentic voice from scratch. It already exists in moments you've overlooked. The scavenger hunt makes these moments visible and builds evidence for the preferred story \u2014 that you are capable of expressing yourself without the mask.",
    theDrill: 'Recall 3 times in the last week when your voice felt completely like "you" \u2014 unmonitored, natural, flowing. For each, write:\n\u2022 What were you talking about?\n\u2022 Who were you with?\n\u2022 What was the setting?\n\u2022 Why was the Monitor quiet?\n\nLook for patterns. Is there a common trigger for authenticity (certain people, topics, environments)? Write one sentence summarizing what makes the Monitor unnecessary. This is your evidence.',
    variations: [
      'Ask a trusted person: "When do I seem most like myself?" Compare their answer to yours.',
      'Over 2 weeks, collect 10 unique outcomes. Arrange them into a timeline. This is the "preferred story" of your authentic voice.',
    ],
  },
  {
    id: 'high-adrenaline-freewriting',
    name: 'High-Adrenaline Freewriting',
    category: 'voice',
    difficulty: 'advanced',
    duration: 600,
    science: "Physiological arousal research shows that elevated adrenaline surfaces unfiltered vocabulary and reduces the dlPFC's capacity for social monitoring. Under controlled arousal, the authentic mPFC-driven voice is closer to the surface because the brain's self-editing capacity is temporarily reduced.",
    theWhy: "Your most honest language comes out when you don't have time to perform. Controlled arousal (not panic \u2014 productive intensity) bypasses the editing loop. What you write under adrenaline is a raw sample of your real vocabulary, rhythm, and priorities.",
    theDrill: 'Pick a topic that genuinely excites, angers, or moves you (not a neutral topic \u2014 it must produce arousal). Do 20 jumping jacks or run in place for 30 seconds to elevate your heart rate. Immediately sit down. Set a timer for 10 minutes. Write without stopping \u2014 no editing, no backspacing, no pausing. When the timer ends, read what you wrote. Highlight 3 phrases that feel most "you" \u2014 words you would never have chosen if you were performing.',
    variations: [
      'Do this with voice recording instead of writing. Speak continuously for 5 minutes after the physical activation.',
      'Compare a high-adrenaline draft to a calm, edited version. What did the editing remove? Was it noise or authenticity?',
    ],
  },
  {
    id: 'mpfc-anchoring',
    name: 'mPFC Anchoring',
    category: 'voice',
    difficulty: 'advanced',
    duration: 420,
    science: 'Neuroimaging research shows the medial prefrontal cortex (mPFC) is the seat of self-importance \u2014 it represents the traits that are most central to your identity. When the mPFC drives expression, the voice is authentic. When the dorsolateral prefrontal cortex (dlPFC) drives expression, the voice is curated for social approval. Listeners can detect this difference \u2014 authentic speech activates their Theory of Mind network, facilitating genuine connection.',
    theWhy: 'Authenticity is not a feeling \u2014 it is a neural state where your core identity drives your words instead of your social monitor. This drill trains you to anchor in the mPFC before speaking, so the "real you" is the one who talks.',
    theDrill: 'Before an important conversation or presentation, sit for 2 minutes. Ask yourself 3 anchoring questions:\n1. "What do I actually believe about this?" (not what I should believe, not what the audience wants to hear)\n2. "What is the one thing I would regret not saying?"\n3. "If I had no reputation to protect, what would I say?"\n\nWrite your answers. These are your mPFC anchors. During the conversation, when you feel the Monitor activating (voice changing, words getting longer, hedging increasing), return to one of these anchors. Say the thing you wrote down.',
    variations: [
      'Use this before every important email: write the mPFC version first, then edit for context \u2014 but do not edit out the core truth.',
      'After a conversation, evaluate: what percentage of what I said came from the mPFC anchors vs. the Monitor? Track this over time.',
    ],
  },
]

// Maps weakness pattern IDs (from frameworks.js) to specific workout drills
export const WEAKNESS_TO_DRILL = {
  'over-qualifying': 'bluf-practice',
  'throat-clearing': 'bluf-practice',
  'burying-lead': 'bluf-practice',
  'trailing-off': 'stop-technique',
  'over-explaining': 'shrinking-time-rebuttal',
  'abstraction-escape': 'semantic-feature-analysis',
  'softening-under-pushback': 'externalizing-the-monitor',
  'performance-voice': 'mpfc-anchoring',
}

// Maps weakness patterns to their most relevant workout category
export const WEAKNESS_TO_CATEGORY = {
  'over-qualifying': 'pattern-breaking',
  'throat-clearing': 'pattern-breaking',
  'burying-lead': 'pattern-breaking',
  'trailing-off': 'pattern-breaking',
  'over-explaining': 'articulation',
  'abstraction-escape': 'articulation',
  'softening-under-pushback': 'voice',
  'performance-voice': 'voice',
}

// Maps voice model currentFocus to workout categories
const FOCUS_TO_CATEGORY = {
  'articulation': 'articulation',
  'emotional-precision': 'emotional-precision',
  'communication': 'communication',
  'voice': 'voice',
  'thinking': 'thinking',
}

/**
 * Pick a suggested drill based on user state.
 * Priority: weakness SRS > voice model focus > intake profile > random foundational
 */
export function getSuggestedDrill({ weaknesses, intakeAnswers, voiceModel, sessionCount }) {
  // 1. If weakness SRS has drills due, suggest the targeted drill
  if (weaknesses && weaknesses.length > 0) {
    for (const w of weaknesses) {
      const drillId = WEAKNESS_TO_DRILL[w.weakness_id]
      if (drillId) {
        const drill = getDrillById(drillId)
        if (drill) return { drill, reason: `Targets your ${w.weakness_id.replace(/-/g, ' ')} pattern` }
      }
    }
  }

  // 2. Use voice model currentFocus to pick a category
  if (voiceModel?.currentFocus) {
    const categoryId = FOCUS_TO_CATEGORY[voiceModel.currentFocus]
    if (categoryId) {
      const drills = getDrillsByCategory(categoryId)
      const foundational = drills.filter(d => d.difficulty === 'foundational')
      if (foundational.length > 0) {
        const drill = foundational[Math.floor(Math.random() * foundational.length)]
        return { drill, reason: `Build your ${categoryId.replace(/-/g, ' ')}` }
      }
    }
  }

  // 3. Use intake profile (works for all session counts as a fallback)
  if (intakeAnswers) {
    const starterIds = getStarterDrills(intakeAnswers)
    if (starterIds.length > 0) {
      const drill = getDrillById(starterIds[0])
      if (drill) return { drill, reason: 'Recommended based on your profile' }
    }
  }

  // 4. Fallback: random foundational drill
  const foundational = DRILLS.filter(d => d.difficulty === 'foundational')
  const drill = foundational[Math.floor(Math.random() * foundational.length)]
  return { drill, reason: 'Foundational exercise' }
}

export function getDrillForWeakness(weaknessId) {
  const drillId = WEAKNESS_TO_DRILL[weaknessId]
  return drillId ? getDrillById(drillId) : null
}

export function getDrillsByCategory(categoryId) {
  return DRILLS.filter(d => d.category === categoryId)
}

export function getDrillById(drillId) {
  return DRILLS.find(d => d.id === drillId)
}
