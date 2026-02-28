import { TextInput, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

interface TextAreaProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  minHeight?: number
  editable?: boolean
  autoFocus?: boolean
}

export function TextArea({
  value, onChangeText, placeholder = 'Start anywhere...',
  minHeight = 160, editable = true, autoFocus = false,
}: TextAreaProps) {
  return (
    <TextInput
      style={[styles.textArea, { minHeight }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inkGhost}
      multiline
      textAlignVertical="top"
      editable={editable}
      autoFocus={autoFocus}
    />
  )
}

const styles = StyleSheet.create({
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
})
