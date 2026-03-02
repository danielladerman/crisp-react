export const INTAKE_QUESTIONS = [
  {
    id: 'coreGap',
    question: 'Where does the disconnect usually happen for you?',
    options: [
      { id: 'articulationGap', label: "I know what I think but can't find the right words" },
      { id: 'emotionalGap', label: 'I know what I feel but struggle to say it clearly' },
      { id: 'communicationGap', label: "I say the right words but they don't land with people" },
      { id: 'authenticityGap', label: 'I sound different than I actually am' },
      { id: 'cognitionGap', label: 'My thinking feels muddy before it even becomes words' },
    ],
  },
  {
    id: 'pressurePattern',
    question: 'When the stakes are high, what do you usually do?',
    options: [
      { id: 'overQualify', label: 'I over-explain and add too many qualifiers' },
      { id: 'buryLead', label: 'I bury my point and get there too slowly' },
      { id: 'freeze', label: 'I freeze or go blank' },
      { id: 'performanceVoice', label: 'I shift into a more formal, unnatural version of myself' },
      { id: 'trailOff', label: 'I trail off before finishing my thought' },
    ],
  },
  {
    id: 'environment',
    question: 'Where does communication matter most to you right now?',
    options: [
      { id: 'professional', label: 'High-stakes professional situations' },
      { id: 'interpersonal', label: 'One-on-one difficult conversations' },
      { id: 'leadership', label: 'Leading or influencing a group' },
      { id: 'creative', label: 'Creative or personal expression' },
      { id: 'broad', label: 'All of the above' },
    ],
  },
  {
    id: 'aliveCondition',
    question: 'When do you feel most like yourself when you speak?',
    options: [
      { id: 'conviction', label: "When I'm talking about something I genuinely believe in" },
      { id: 'intimateSetting', label: "When I'm in a small group or one-on-one" },
      { id: 'prepared', label: "When I've had time to think it through first" },
      { id: 'spontaneous', label: 'When the conversation is spontaneous and unplanned' },
      { id: 'undiscovered', label: "Honestly, rarely \u2014 that's why I'm here" },
    ],
  },
  {
    id: 'horizon',
    question: "What's coming up where this matters?",
    options: [
      { id: 'immediate', label: 'Something specific in the next 30 days' },
      { id: 'identity', label: 'Building a long-term communication style' },
      { id: 'spontaneousGoal', label: 'Getting better at thinking on my feet' },
      { id: 'selfKnowledge', label: 'I want to understand myself better first' },
      { id: 'habit', label: 'I just want to practice consistently' },
    ],
  },
  {
    id: 'focusMode',
    question: 'Where would you most like to sharpen your expression?',
    options: [
      { id: 'professional', label: 'Professional — pitches, meetings, presentations' },
      { id: 'relational', label: 'Relational — personal conversations, difficult talks' },
      { id: 'mixed', label: 'Both — I want to sharpen across contexts' },
    ],
  },
]

// ── Voice Model Mapping ─────────────────────────

const CORE_GAP_FOCUS = {
  articulationGap: { currentFocus: 'articulation', label: 'Articulation', observation: "You know what you think \u2014 the gap is between the thought and the words. That's a retrieval problem, not a thinking problem, and it responds well to targeted practice." },
  emotionalGap: { currentFocus: 'emotional-precision', label: 'Emotional Precision', observation: "You feel things clearly but the words don't match the feeling. That's an emotional granularity gap \u2014 your vocabulary isn't catching up to your inner experience yet." },
  communicationGap: { currentFocus: 'communication', label: 'Communication', observation: "Your words are clear to you but not landing with others. That's a calibration problem \u2014 the message is good, the delivery needs to match the listener." },
  authenticityGap: { currentFocus: 'voice', label: 'Voice', observation: "There's a gap between who you are and who shows up when you speak. That's the performance voice \u2014 and the first step is learning to hear the difference." },
  cognitionGap: { currentFocus: 'thinking', label: 'Thinking', observation: "The muddy thinking happens before speech \u2014 which means clarity of expression starts with clarity of thought. We'll build the thinking scaffold first." },
}

const PRESSURE_WEAKNESSES = {
  overQualify: ['over-qualifying', 'over-explaining'],
  buryLead: ['burying-lead', 'throat-clearing'],
  freeze: [],
  performanceVoice: ['performance-voice'],
  trailOff: ['trailing-off'],
}

const PRESSURE_FOCUS = {
  freeze: 'presence',
}

const BREAKTHROUGH_CONDITIONS = {
  conviction: 'conviction \u2014 when speaking about deeply held beliefs',
  intimateSetting: 'intimate-setting \u2014 in small groups or one-on-one',
  prepared: 'prepared \u2014 when given time to think first',
  spontaneous: 'spontaneous \u2014 in unplanned, flowing conversation',
  undiscovered: 'undiscovered \u2014 authentic voice not yet reliably accessible',
}

const CONTEXT_MAP = {
  professional: 'professional \u2014 pitches, presentations, meetings',
  interpersonal: 'interpersonal \u2014 difficult one-on-one conversations',
  leadership: 'leadership \u2014 leading and influencing groups',
  creative: 'creative \u2014 personal and creative expression',
  broad: 'broad \u2014 all communication contexts',
}

const HORIZON_MAP = {
  immediate: 'immediate \u2014 specific situation in next 30 days',
  identity: 'identity \u2014 building long-term communication style',
  spontaneousGoal: 'spontaneous \u2014 thinking on feet',
  selfKnowledge: 'self-knowledge \u2014 understanding self first',
  habit: 'habit \u2014 consistent practice',
}

const FOCUS_MODE_MAP: Record<string, string> = {
  professional: 'professional — pitches, meetings, presentations, leadership',
  relational: 'relational — personal conversations, difficult talks, emotional clarity',
  mixed: 'mixed — all communication contexts',
}

export function mapAnswersToVoiceModel(answers: Record<string, string>) {
  const gapData = CORE_GAP_FOCUS[answers.coreGap] || CORE_GAP_FOCUS.articulationGap
  return {
    currentFocus: gapData.currentFocus,
    focusMode: FOCUS_MODE_MAP[answers.focusMode] || FOCUS_MODE_MAP.mixed,
    detectedWeaknesses: PRESSURE_WEAKNESSES[answers.pressurePattern] || [],
    pressureFocus: PRESSURE_FOCUS[answers.pressurePattern] || null,
    coreContext: CONTEXT_MAP[answers.environment] || CONTEXT_MAP.broad,
    breakthroughConditions: BREAKTHROUGH_CONDITIONS[answers.aliveCondition] || BREAKTHROUGH_CONDITIONS.undiscovered,
    horizon: HORIZON_MAP[answers.horizon] || HORIZON_MAP.habit,
    intakeAnswers: answers,
  }
}

export function getIntakeLabel(answers) {
  return CORE_GAP_FOCUS[answers.coreGap]?.label || 'Expression'
}

export function getIntakeObservation(answers) {
  return CORE_GAP_FOCUS[answers.coreGap]?.observation || ''
}

// ── Starter Drills ──────────────────────────────

const GAP_DRILLS = {
  articulationGap: ['semantic-feature-analysis', 'shrinking-time-rebuttal'],
  emotionalGap: ['mood-meter-granularity', 'handle-check'],
  communicationGap: ['video-camera-observation', 'social-judgment-mapping'],
  authenticityGap: ['defamiliarization-recording', 'externalizing-the-monitor'],
  cognitionGap: ['first-principles-deconstruction', 'assumption-audit'],
}

const PRESSURE_DRILLS = {
  overQualify: 'bluf-practice',
  buryLead: 'bluf-practice',
  freeze: 'physiological-sigh',
  performanceVoice: 'mpfc-anchoring',
  trailOff: 'stop-technique',
}

export function getStarterDrills(answers) {
  const gapDrills = GAP_DRILLS[answers.coreGap] || GAP_DRILLS.articulationGap
  const pressureDrill = PRESSURE_DRILLS[answers.pressurePattern] || 'physiological-sigh'
  return [...gapDrills, pressureDrill]
}

// ── Personalized Session 1-4 Prompts ────────────

const PERSONALIZED_PROMPTS = {
  articulationGap: [
    { promptType: 'reveal', promptText: "What's a belief you hold that you've never quite found the right words for?" },
    { promptType: 'pressure', promptText: "Pick a position you hold strongly. Say it in one sentence. No hedging, no qualifiers. Then defend it in three more." },
    { promptType: 'reveal', promptText: "What's one thing you understand about yourself that took too long to figure out?" },
    { promptType: 'story', promptText: "Tell me about a moment when you said exactly what you meant \u2014 and it landed. What was different about that time?" },
  ],
  emotionalGap: [
    { promptType: 'reveal', promptText: "What's something you feel strongly about that you've never been able to explain to anyone's satisfaction \u2014 including your own?" },
    { promptType: 'pressure', promptText: "Name the emotion you feel most often but talk about least. Say what it actually feels like \u2014 in the body, not the head." },
    { promptType: 'reveal', promptText: "What's one thing you understand about yourself that took too long to figure out?" },
    { promptType: 'story', promptText: "Describe the last time you changed your mind about something important. What happened?" },
  ],
  communicationGap: [
    { promptType: 'reveal', promptText: "What's something you know is true that most people around you don't act like it is?" },
    { promptType: 'pressure', promptText: "What's a message you've tried to deliver more than once that keeps not landing? Say it now \u2014 the version you actually mean." },
    { promptType: 'reveal', promptText: "What do people consistently misunderstand about what you're trying to say?" },
    { promptType: 'story', promptText: "Tell me about a conversation that went wrong \u2014 not because you were wrong, but because the message didn't land. What happened?" },
  ],
  authenticityGap: [
    { promptType: 'reveal', promptText: "What's something you believe that you've never said out loud in your professional life?" },
    { promptType: 'pressure', promptText: "Say the thing you'd say if nobody you work with could hear you. The unfiltered version." },
    { promptType: 'reveal', promptText: "When did you last hear yourself say something and think: that wasn't me?" },
    { promptType: 'story', promptText: "Tell me about a moment when you dropped the performance and just said what was real. What made it possible?" },
  ],
  cognitionGap: [
    { promptType: 'reveal', promptText: "What's an idea that keeps showing up in your thinking but you can't quite pin down what it means?" },
    { promptType: 'pressure', promptText: "Pick the muddiest thought in your head right now. You have 60 seconds to make it clear. Go." },
    { promptType: 'reveal', promptText: "What's one thing you understand about yourself that took too long to figure out?" },
    { promptType: 'story', promptText: "Tell me about a moment when something clicked \u2014 when a foggy idea suddenly became clear. What changed?" },
  ],
}

export function getPersonalizedPrompts(answers) {
  return PERSONALIZED_PROMPTS[answers.coreGap] || PERSONALIZED_PROMPTS.articulationGap
}
