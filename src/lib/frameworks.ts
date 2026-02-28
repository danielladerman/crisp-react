export const FRAMEWORKS = [
  { id: 'first-principles', name: 'First Principles', description: 'Break assumptions down to fundamental truths' },
  { id: 'inversion', name: 'Inversion', description: 'Approach from the opposite direction' },
  { id: 'steel-manning', name: 'Steel-Manning', description: 'Build the strongest version of the opposing view' },
  { id: 'second-order', name: 'Second-Order Thinking', description: 'Think about the consequences of consequences' },
  { id: 'circle-of-competence', name: 'Circle of Competence', description: 'Know the boundaries of what you truly understand' },
  { id: 'probabilistic', name: 'Probabilistic Thinking', description: 'Think in odds, not certainties' },
  { id: 'mental-simulation', name: 'Mental Simulation', description: 'Run the scenario forward in your mind' },
  { id: 'socratic', name: 'Socratic Questioning', description: 'Examine assumptions through deep questioning' },
  { id: 'analogical', name: 'Analogical Reasoning', description: 'Find the structural parallel in another domain' },
  { id: 'systems', name: 'Systems Thinking', description: 'See the whole, the loops, the leverage points' },
  { id: 'premortem', name: 'Pre-Mortem', description: 'Imagine failure, then explain how it happened' },
  { id: 'ooda', name: 'OODA Loop', description: 'Observe, Orient, Decide, Act — then repeat' },
]

export const WEAKNESS_PATTERNS = [
  { id: 'over-qualifying', name: 'Over-qualifying', description: 'Hedging strong claims — "kind of", "sort of", "I think", "maybe"' },
  { id: 'throat-clearing', name: 'Throat-clearing', description: 'Preamble before the point' },
  { id: 'burying-lead', name: 'Burying the lead', description: 'Point arrives at the end, not the beginning' },
  { id: 'trailing-off', name: 'Trailing endings', description: "Thoughts that don't complete — diminish at the close" },
  { id: 'over-explaining', name: 'Over-explaining', description: 'Restating the same point in multiple ways' },
  { id: 'abstraction-escape', name: 'Abstraction escape', description: 'Going general when specific would be truer' },
  { id: 'softening-under-pushback', name: 'Softening under pressure', description: 'Positions dissolve when challenged' },
  { id: 'performance-voice', name: 'Performance voice', description: 'Register shifts when performing intelligence' },
]

export function getNextInterval(currentInterval, qualitySignal) {
  const multipliers = {
    breakthrough: 2.5,
    solid: 2.0,
    routine: 1.5,
    struggled: 0.5,
  }
  return Math.round(currentInterval * multipliers[qualitySignal])
}

export function getFrameworksDue(srsState) {
  const now = new Date()
  return srsState
    .filter(f => {
      if (!f.lastPracticed) return true
      const nextDate = new Date(f.lastPracticed)
      nextDate.setDate(nextDate.getDate() + f.interval_days)
      return now >= nextDate
    })
    .sort((a, b) => {
      if (!a.lastPracticed) return -1
      if (!b.lastPracticed) return 1
      return new Date(a.lastPracticed).getTime() - new Date(b.lastPracticed).getTime()
    })
}

export function getWeaknessDrillsDue(weaknessSrsState) {
  const now = new Date()
  return weaknessSrsState
    .filter(w => {
      if (w.status !== 'active') return false
      if (!w.last_drilled) return true
      const nextDate = new Date(w.last_drilled)
      nextDate.setDate(nextDate.getDate() + w.interval_days)
      return now >= nextDate
    })
    .sort((a, b) => {
      if (!a.last_drilled) return -1
      if (!b.last_drilled) return 1
      return new Date(a.last_drilled).getTime() - new Date(b.last_drilled).getTime()
    })
}

export function shouldResolveWeakness(consecutiveClean, intervalDays) {
  return consecutiveClean >= 5 && intervalDays >= 14
}

export function detectWeaknessFromFeedback(nameText, drillText) {
  if (!nameText) return null
  const text = (nameText + ' ' + (drillText || '')).toLowerCase()
  const patterns = {
    'over-qualifying': ['qualifying', 'hedg', 'kind of', 'sort of', 'i think', 'maybe'],
    'throat-clearing': ['preamble', 'setup', 'throat', 'clearing', 'before the point'],
    'burying-lead': ['bury', 'lead', 'point at the end', 'runway'],
    'trailing-off': ['trail', 'diminish', 'finish', 'incomplete', 'didn\'t complete'],
    'over-explaining': ['over-explain', 'restat', 'same point', 'said it already'],
    'abstraction-escape': ['abstract', 'general', 'specific', 'instance'],
    'softening-under-pushback': ['soften', 'retreat', 'dissolve', 'backed away'],
    'performance-voice': ['perform', 'register shift', 'impressive', 'trust'],
  }
  for (const [id, keywords] of Object.entries(patterns)) {
    if (keywords.some(kw => text.includes(kw))) return id
  }
  return null
}
