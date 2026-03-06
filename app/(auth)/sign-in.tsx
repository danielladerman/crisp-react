import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../src/hooks/useAuth'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/lib/theme'

export default function SignInScreen() {
  const { signIn, verifyOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendOtp() {
    if (!email.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      await signIn(email.trim())
      setOtpSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (!token.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      await verifyOtp(email.trim(), token.trim())
      // Auth state change will trigger navigation in _layout.tsx
    } catch (err: any) {
      setError(err.message || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>CRISP</Text>
        <Text style={styles.subtitle}>Daily expression practice</Text>

        {!otpSent ? (
          <>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.inkGhost}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleSendOtp}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading || !email.trim()}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Sending...' : 'Send sign-in code'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sentText}>Code sent to {email}</Text>
            <TextInput
              style={styles.input}
              value={token}
              onChangeText={setToken}
              placeholder="Enter 6-digit code"
              placeholderTextColor={colors.inkGhost}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading || !token.trim()}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Verifying...' : 'Verify'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setOtpSent(false); setToken('') }}>
              <Text style={styles.backLink}>Use a different email</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {__DEV__ && (
          <TouchableOpacity
            style={styles.devSkip}
            onPress={async () => {
              setLoading(true)
              setError('')
              try {
                await supabase.auth.signInWithPassword({
                  email: 'dev@crisp.test',
                  password: 'devtest123',
                })
              } catch (err: any) {
                setError(err.message || 'Dev sign-in failed')
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            <Text style={styles.devSkipText}>Skip (Dev)</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 3,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 48,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDeep,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 15,
    fontWeight: '500',
  },
  sentText: {
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  backLink: {
    fontSize: 14,
    color: colors.inkGhost,
    textAlign: 'center',
    marginTop: 16,
  },
  error: {
    fontSize: 14,
    color: colors.recording,
    textAlign: 'center',
    marginTop: 16,
  },
  devSkip: {
    marginTop: 32,
    alignItems: 'center',
  },
  devSkipText: {
    fontSize: 13,
    color: colors.inkGhost,
  },
})
