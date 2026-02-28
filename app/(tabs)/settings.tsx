import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/hooks/useAuth'
import { colors } from '../../src/lib/theme'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, saveName, signOut } = useAuth()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(user?.user_metadata?.full_name || '')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  const currentName = user?.user_metadata?.full_name

  async function handleSaveName() {
    if (!nameValue.trim() || nameSaving) return
    setNameSaving(true)
    try {
      await saveName(nameValue.trim())
      setEditingName(false)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save name:', err)
    } finally {
      setNameSaving(false)
    }
  }

  function handleReplayOnboarding() {
    router.push('/(onboarding)/welcome')
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/sign-in')
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NAME</Text>
          {editingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                style={styles.nameInput}
                value={nameValue}
                onChangeText={setNameValue}
                placeholder="Your name"
                placeholderTextColor={colors.inkGhost}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity
                style={[styles.saveButton, (!nameValue.trim() || nameSaving) && styles.saveButtonDisabled]}
                onPress={handleSaveName}
                disabled={!nameValue.trim() || nameSaving}
              >
                <Text style={styles.saveButtonText}>
                  {nameSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setNameValue(currentName || '') }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameDisplay}>
              <Text style={styles.nameText}>{currentName || 'Not set'}</Text>
              <TouchableOpacity onPress={() => setEditingName(true)}>
                <Text style={styles.editLink}>{nameSaved ? 'Saved' : 'Edit'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Onboarding replay */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ONBOARDING</Text>
          <TouchableOpacity style={styles.replayButton} onPress={handleReplayOnboarding}>
            <Text style={styles.replayButtonText}>Replay onboarding</Text>
          </TouchableOpacity>
          <Text style={styles.replayHint}>
            Review the Welcome, Philosophy, and Intake screens again.
          </Text>
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 120,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.inkGhost,
    marginBottom: 12,
  },
  email: {
    fontSize: 14,
    color: colors.ink,
  },
  nameEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.sky,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink,
  },
  saveButton: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveButtonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  saveButtonText: {
    color: colors.paper,
    fontSize: 13,
    fontWeight: '500',
  },
  cancelText: {
    fontSize: 13,
    color: colors.inkGhost,
  },
  nameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  nameText: {
    fontSize: 14,
    color: colors.ink,
  },
  editLink: {
    fontSize: 14,
    color: colors.sky,
  },
  replayButton: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  replayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
  },
  replayHint: {
    fontSize: 12,
    color: colors.inkGhost,
  },
  signOutText: {
    fontSize: 14,
    color: colors.recording,
  },
})
