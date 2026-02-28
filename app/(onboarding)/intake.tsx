import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { INTAKE_QUESTIONS } from '../../src/lib/intakeMapping'
import { saveIntakeAnswers } from '../../src/lib/storage'
import { colors } from '../../src/lib/theme'

export default function IntakeScreen() {
  const router = useRouter()
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [animating, setAnimating] = useState(false)

  const question = INTAKE_QUESTIONS[currentQ]
  const totalQuestions = INTAKE_QUESTIONS.length

  async function handleSelect(optionId: string) {
    if (animating) return

    const updated = { ...answers, [question.id]: optionId }
    setAnswers(updated)

    if (currentQ === totalQuestions - 1) {
      try { await saveIntakeAnswers(updated) } catch (err) {
        if (__DEV__) console.error('saveIntakeAnswers:', err)
      }
      router.push({ pathname: '/(onboarding)/starter-path', params: { answers: JSON.stringify(updated) } })
      return
    }

    setAnimating(true)
    setTimeout(() => {
      setCurrentQ(prev => prev + 1)
      setAnimating(false)
    }, 300)
  }

  function handleBack() {
    if (currentQ === 0 || animating) return
    setAnimating(true)
    setTimeout(() => {
      setCurrentQ(prev => prev - 1)
      setAnimating(false)
    }, 200)
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header: back + progress dots */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} disabled={currentQ === 0}>
            <Text style={[styles.backText, currentQ === 0 && { color: 'transparent' }]}>
              ← Back
            </Text>
          </TouchableOpacity>

          <View style={styles.dots}>
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i <= currentQ ? colors.ink : colors.paperDeep },
                ]}
              />
            ))}
          </View>

          <View style={{ width: 48 }} />
        </View>

        {/* Intro text on first question */}
        {currentQ === 0 && !answers.coreGap && (
          <Text style={styles.introText}>
            There are no wrong answers. This just helps us know where to start.
          </Text>
        )}

        {/* Question */}
        <View style={{ opacity: animating ? 0 : 1 }}>
          <Text style={styles.question}>{question.question}</Text>

          <View style={styles.options}>
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option.id
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.option,
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(option.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
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
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 64,
  },
  backText: {
    fontSize: 14,
    color: colors.inkMuted,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  introText: {
    fontSize: 14,
    color: colors.inkGhost,
    marginBottom: 32,
  },
  question: {
    fontSize: 20,
    fontStyle: 'italic',
    color: colors.ink,
    lineHeight: 30,
    marginBottom: 40,
  },
  options: {
    gap: 12,
  },
  option: {
    backgroundColor: colors.paperDim,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  optionSelected: {
    backgroundColor: colors.ink,
  },
  optionText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  optionTextSelected: {
    color: colors.paper,
  },
})
