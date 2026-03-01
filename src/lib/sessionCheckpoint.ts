import AsyncStorage from '@react-native-async-storage/async-storage'

export const SESSION_KEY = 'crisp_session_checkpoint'
export const PREP_KEY = 'crisp_prep_checkpoint'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export async function saveCheckpoint(key: string, data: Record<string, unknown>) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ ...data, _ts: Date.now() }))
  } catch (err) {
    if (__DEV__) console.error('saveCheckpoint failed:', err)
  }
}

export async function loadCheckpoint(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data._ts > TTL_MS) {
      await AsyncStorage.removeItem(key)
      return null
    }
    return data
  } catch (err) {
    if (__DEV__) console.error('loadCheckpoint failed:', err)
    return null
  }
}

export async function clearCheckpoint(key: string) {
  try {
    await AsyncStorage.removeItem(key)
  } catch (err) {
    if (__DEV__) console.error('clearCheckpoint failed:', err)
  }
}
