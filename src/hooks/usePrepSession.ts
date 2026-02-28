import { useState, useCallback, useRef } from 'react'
import { createPrepSession, updatePrepSession, upsertVoiceModel } from '../lib/storage'
import { streamClaude, callClaude } from '../lib/claude'
import { PREP_COACHING_SYSTEM_PROMPT, KEY_MESSAGES_SYSTEM_PROMPT, VOICE_MODEL_UPDATE_PROMPT } from '../lib/prompts'
import { getVoiceModel } from '../lib/storage'
import { saveCheckpoint, clearCheckpoint, PREP_KEY } from '../lib/sessionCheckpoint'
// Note: saveCheckpoint/clearCheckpoint are async in RN but fire-and-forget is fine

export function usePrepSession({ userId, sessionCount = 0 }) {
  const [prepSession, setPrepSession] = useState(null)
  const [exchanges, setExchanges] = useState([])
  const [keyMessages, setKeyMessages] = useState(null)
  const [phase, setPhase] = useState('setup') // setup | conversation | generating | messages | done
  const [streaming, setStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [error, setError] = useState(null)
  const voiceModelRef = useRef(null)

  const startPrep = useCallback(async (situationType, situationDescription) => {
    try {
      const session = await createPrepSession({ userId, situationType, situationDescription })
      setPrepSession(session)

      // Get voice model for calibration (cache in ref for submitMessage)
      const voiceModel = await getVoiceModel(userId)
      voiceModelRef.current = voiceModel

      const systemPrompt = `${PREP_COACHING_SYSTEM_PROMPT}\n\nSITUATION TYPE: ${situationType}\nSITUATION: ${situationDescription}${voiceModel ? `\n\nVOICE MODEL:\n${JSON.stringify(voiceModel, null, 2)}` : ''}`

      const messages = [{ role: 'user', content: situationDescription }]

      // Transition to conversation phase BEFORE streaming starts.
      // This prevents PrepModeEntry from remounting (losing user input) if the stream fails.
      setExchanges([{ role: 'user', content: situationDescription }])
      setPhase('conversation')
      setStreaming(true)
      setCurrentResponse('')
      setError(null)

      await streamClaude({
        systemPrompt,
        messages,
        onChunk: (text) => setCurrentResponse(text),
        onDone: async (fullText) => {
          setStreaming(false)
          setExchanges([
            { role: 'user', content: situationDescription },
            { role: 'assistant', content: fullText },
          ])
          setCurrentResponse('')
          const initialExchanges = [
            { role: 'user', content: situationDescription },
            { role: 'assistant', content: fullText },
          ]
          await updatePrepSession(session.id, { prepExchanges: initialExchanges })
          saveCheckpoint(PREP_KEY, {
            prepSessionId: session.id,
            phase: 'conversation',
            exchanges: initialExchanges,
            situationType,
            situationDescription,
          })
        },
        onError: (err) => {
          setStreaming(false)
          setError((err as any).message)
        },
      })
    } catch (err) {
      setError((err as any).message)
    }
  }, [userId])

  const submitMessage = useCallback(async (text) => {
    if (!prepSession) return
    setStreaming(true)
    setCurrentResponse('')

    const newExchanges = [...exchanges, { role: 'user', content: text }]
    setExchanges(newExchanges)

    const voiceModel = voiceModelRef.current
    const systemPrompt = `${PREP_COACHING_SYSTEM_PROMPT}${voiceModel ? `\n\nVOICE MODEL:\n${JSON.stringify(voiceModel, null, 2)}` : ''}`

    await streamClaude({
      systemPrompt,
      messages: newExchanges,
      onChunk: (text) => setCurrentResponse(text),
      onDone: async (fullText) => {
        setStreaming(false)
        const updated = [...newExchanges, { role: 'assistant', content: fullText }]
        setExchanges(updated)
        setCurrentResponse('')
        await updatePrepSession(prepSession.id, { prepExchanges: updated })
        saveCheckpoint(PREP_KEY, {
          prepSessionId: prepSession.id,
          phase: 'conversation',
          exchanges: updated,
        })
      },
      onError: (err) => {
        setStreaming(false)
        setError((err as any).message)
      },
    })
  }, [prepSession, exchanges, userId])

  const generateKeyMessages = useCallback(async () => {
    if (!prepSession) return
    setPhase('generating')

    try {
      const conversationSummary = exchanges
        .map(e => `${e.role === 'user' ? 'USER' : 'COACH'}: ${e.content}`)
        .join('\n\n')

      const result = await callClaude({
        systemPrompt: KEY_MESSAGES_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: conversationSummary }],
      })

      const cleaned = result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const parsed = JSON.parse(cleaned)
      setKeyMessages(parsed)
      setPhase('messages')
      await updatePrepSession(prepSession.id, { keyMessages: parsed, completed: true })
      clearCheckpoint(PREP_KEY)

      // Fire-and-forget voice model update
      try {
        const currentModel = await getVoiceModel(userId) || {}
        const prepData = `CURRENT VOICE MODEL:\n${JSON.stringify(currentModel, null, 2)}\n\nSESSION DATA:\nMode: prep\nSession Number: ${sessionCount + 1}\nSituation Type: ${prepSession.situation_type}\nSituation Description: ${prepSession.situation_description}\n\nFull Coaching Conversation:\n${conversationSummary}\n\nKey Messages Distilled:\n${parsed.map((m, i) => `${i + 1}. ${typeof m === 'string' ? m : m.text || JSON.stringify(m)}`).join('\n')}\n\nUpdate the voice model. Return only updated JSON.`
        const result2 = await callClaude({
          model: 'claude-sonnet-4-6',
          maxTokens: 3000,
          systemPrompt: VOICE_MODEL_UPDATE_PROMPT,
          messages: [{ role: 'user', content: prepData }],
        })
        const updatedModel = JSON.parse(result2)
        await upsertVoiceModel(userId, updatedModel, sessionCount + 1)
      } catch (err) {
        console.error('Voice model update failed (non-blocking):', err)
      }
    } catch (err) {
      setError((err as any).message)
      setPhase('conversation')
    }
  }, [prepSession, exchanges, userId, sessionCount])

  const completePrep = useCallback(() => {
    setPhase('done')
    clearCheckpoint(PREP_KEY)
  }, [])

  return {
    prepSession,
    exchanges,
    keyMessages,
    phase,
    streaming,
    currentResponse,
    error,
    startPrep,
    submitMessage,
    generateKeyMessages,
    completePrep,
  }
}
