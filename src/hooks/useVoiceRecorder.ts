// src/hooks/useVoiceRecorder.ts — Wraps expo-av for voice recording
import { useState, useCallback, useRef } from 'react'
import { Audio } from 'expo-av'

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync()
    if (!granted) throw new Error('Microphone permission denied')

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    })

    const recording = new Audio.Recording()
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
    await recording.startAsync()
    recordingRef.current = recording
    setIsRecording(true)
    setDuration(0)

    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1)
    }, 1000)
  }, [])

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (!recordingRef.current) return null

    await recordingRef.current.stopAndUnloadAsync()
    const uri = recordingRef.current.getURI()
    recordingRef.current = null
    setIsRecording(false)

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
    return uri
  }, [])

  const cancelRecording = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (!recordingRef.current) return

    try {
      await recordingRef.current.stopAndUnloadAsync()
    } catch {
      // already stopped
    }
    recordingRef.current = null
    setIsRecording(false)
    setDuration(0)

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
  }, [])

  return { isRecording, duration, startRecording, stopRecording, cancelRecording }
}
