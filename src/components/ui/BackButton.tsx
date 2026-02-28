import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

interface BackButtonProps {
  onPress: () => void
  label?: string
}

export function BackButton({ onPress, label = '← Back' }: BackButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    color: colors.inkGhost,
  },
})
