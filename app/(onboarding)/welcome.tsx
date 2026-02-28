import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { colors } from '../../src/lib/theme'

export default function WelcomeScreen() {
  const router = useRouter()
  const { saveName } = useAuth()
  const [name, setName] = useState('')

  async function handleContinue() {
    if (name.trim()) {
      try { await saveName(name.trim()) } catch (err) {
        if (__DEV__) console.error('saveName:', err)
      }
    }
    router.push('/(onboarding)/philosophy')
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to CRISP.</Text>
        <Text style={styles.body}>
          A daily practice space for sharpening how you think and express yourself.
        </Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="What should I call you?"
          placeholderTextColor={colors.inkGhost}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.inkMuted,
    marginBottom: 40,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDeep,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 32,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
})
