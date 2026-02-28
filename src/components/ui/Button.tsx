import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps {
  children: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  style?: object
}

export function Button({ children, onPress, variant = 'primary', disabled = false, style }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'primary' && disabled && styles.primaryDisabled,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          variant === 'primary' && styles.primaryText,
          variant === 'primary' && disabled && styles.primaryDisabledText,
          variant === 'secondary' && styles.secondaryText,
          variant === 'ghost' && styles.ghostText,
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  primary: {
    backgroundColor: colors.ink,
    paddingHorizontal: 32,
  },
  primaryDisabled: {
    backgroundColor: colors.paperDeep,
  },
  primaryText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
  primaryDisabledText: {
    color: colors.inkGhost,
  },
  secondary: {
    paddingVertical: 12,
  },
  secondaryText: {
    color: colors.inkMuted,
    fontSize: 14,
  },
  ghost: {
    paddingVertical: 8,
  },
  ghostText: {
    color: colors.inkGhost,
    fontSize: 14,
  },
  text: {},
})
