import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors } from '../../src/lib/theme'

export default function PhilosophyScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>The philosophy.</Text>

      <Text style={styles.body}>
        Most people know what they want to say. The gap is between knowing and saying it — clearly, precisely, without the filler.
      </Text>

      <Text style={styles.body}>
        CRISP closes that gap through daily practice. Not theory. Not tips. Reps.
      </Text>

      <Text style={styles.body}>
        Each session gives you a prompt, listens to your response, and gives you honest, specific feedback on how you expressed yourself — not what you said, but how you said it.
      </Text>

      <Text style={styles.body}>
        Over time, the app builds a model of your voice — your patterns, your strengths, your edges — and uses it to personalize every session. You can see everything it learns.
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/(onboarding)/intake')}>
        <Text style={styles.buttonText}>I'm in</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 32,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.inkMuted,
    marginBottom: 20,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
})
