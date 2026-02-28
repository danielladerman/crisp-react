import { useCallback } from 'react'
import { callClaude } from '../lib/claude'
import { PROMPT_SELECTION_SYSTEM_PROMPT, DEFAULT_PROMPTS } from '../lib/prompts'
import { getVoiceModel, getRecentSessions } from '../lib/storage'
import { getWeaknessDrillsDue } from '../lib/frameworks'

// --- Prompt builders ---

function buildContradictionPrompt(contradiction) {
  return {
    promptType: 'contradiction',
    promptText: `You've said two things that pull against each other: "${contradiction.description}" — I want to hear you sit inside that tension. Which side is closer to what you actually believe? Say it without softening either side.`,
  }
}

function buildReclaimPrompt(opportunity) {
  return {
    promptType: 'reclaim',
    promptText: `Earlier you said something and then walked it back: "${opportunity.description}" — I want the original version. The one before you edited yourself. Say it again, full strength.`,
  }
}

function buildDeepPatternPrompt(pattern) {
  return {
    promptType: 'deep-pattern',
    promptText: `There's a pattern underneath your last several sessions that doesn't fit a neat category: "${pattern.description}" — What do you think is actually going on there? Don't analyze it. Just say what you notice.`,
  }
}

function buildCirclingPrompt(idea) {
  return {
    promptType: 'circling',
    promptText: `You've come back to this idea across ${idea.sessionsCircling} sessions now: "${idea.description}" — What would it take to finally land on it? Say the thing you keep almost saying.`,
  }
}

function buildWeaknessDrillPrompt(weakness) {
  return {
    promptType: 'weakness-drill',
    promptText: `This session targets a specific pattern: ${weakness.weakness_id}. Talk about something you care about for 60 seconds. The constraint: no ${weakness.weakness_id.replace(/-/g, ' ')}. If the pattern appears, you'll be called on it immediately.`,
  }
}

function fallbackPrompt() {
  const pool = DEFAULT_PROMPTS.reveal
  return {
    promptType: 'reveal',
    promptText: pool[Math.floor(Math.random() * pool.length)],
  }
}

// --- Hook ---

export function usePromptEngine({ userId, voiceModel, sessionCount, weaknessSRS }) {
  const selectPrompt = useCallback(async () => {
    // Priority 1: Contradiction probes (sessionCount >= 6)
    if (sessionCount >= 6 && voiceModel?.pendingProbes?.contradictions) {
      const unused = voiceModel.pendingProbes.contradictions.find(c => !c.used)
      if (unused) {
        return buildContradictionPrompt(unused)
      }
    }

    // Priority 2: Reclaim opportunity probes (sessionCount >= 6)
    if (sessionCount >= 6 && voiceModel?.pendingProbes?.reclaimOpportunities) {
      const unused = voiceModel.pendingProbes.reclaimOpportunities.find(r => !r.used)
      if (unused) {
        return buildReclaimPrompt(unused)
      }
    }

    // Priority 3: Deep pattern probes (sessionCount >= 15)
    if (sessionCount >= 15 && voiceModel?.pendingProbes?.deepPatterns) {
      const unused = voiceModel.pendingProbes.deepPatterns.find(d => !d.used)
      if (unused) {
        return buildDeepPatternPrompt(unused)
      }
    }

    // Priority 4: Circling ideas (3+ sessions unresolved)
    if (voiceModel?.crossSessionPatterns?.circlingIdeas) {
      const circling = voiceModel.crossSessionPatterns.circlingIdeas.find(
        i => i.sessionsCircling >= 3
      )
      if (circling) {
        return buildCirclingPrompt(circling)
      }
    }

    // Priority 5: Weakness SRS drills due
    if (weaknessSRS && weaknessSRS.length > 0) {
      const due = getWeaknessDrillsDue(weaknessSRS)
      if (due.length > 0) {
        return buildWeaknessDrillPrompt(due[0])
      }
    }

    // Priority 6: AI prompt selection via Claude
    try {
      const vm = voiceModel || (await getVoiceModel(userId))
      const recent = await getRecentSessions(userId, 5)
      const result = await callClaude({
        systemPrompt: PROMPT_SELECTION_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `VOICE MODEL: ${JSON.stringify(vm || {})}\nSRS STATE: ${JSON.stringify(weaknessSRS || [])}\nLAST 5 SESSIONS: ${JSON.stringify(recent.map(s => ({ promptType: s.prompt_type, promptText: s.prompt_text, markedMoment: s.marked_moment })))}\nSESSION COUNT: ${sessionCount}\n\nSelect the best prompt for today's session.`,
        }],
      })
      return JSON.parse(result)
    } catch {
      return fallbackPrompt()
    }
  }, [userId, voiceModel, sessionCount, weaknessSRS])

  return { selectPrompt }
}
