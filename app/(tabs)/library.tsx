import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useAuth } from '../../src/hooks/useAuth'
import {
  getLibraryFiltered, deleteLibraryEntry, updateLibraryEntry,
  toggleLibraryPin, addToLibrary,
} from '../../src/lib/storage'
import { ScreenContainer, Card } from '../../src/components/ui'
import { colors, spacing } from '../../src/lib/theme'

type FilterType = 'all' | 'pinned'

interface LibraryEntry {
  id: string
  marked_text: string
  prompt_text: string
  ai_observation: string
  created_at: string
  prompt_type: string
  pinned?: boolean
  source?: string
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pinned', label: 'Pinned' },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LibraryScreen() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)

  // Edit modal state
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null)
  const [editText, setEditText] = useState('')

  // Add quote modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addText, setAddText] = useState('')

  const loadEntries = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await getLibraryFiltered(user.id, filter)
      setEntries(data as LibraryEntry[])
    } catch (err) {
      if (__DEV__) console.error('Library load error:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, filter])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleDelete = useCallback((entryId: string) => {
    Alert.alert(
      'Delete entry',
      'Remove this moment from your library?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return
            try {
              await deleteLibraryEntry(entryId, user.id)
              setEntries(prev => prev.filter(e => e.id !== entryId))
            } catch (err) {
              if (__DEV__) console.error('Delete error:', err)
              Alert.alert('Error', 'Could not delete this entry. Please try again.')
            }
          },
        },
      ],
    )
  }, [user?.id])

  const handlePin = useCallback(async (entry: LibraryEntry) => {
    if (!user?.id) return
    const newPinned = !entry.pinned
    try {
      await toggleLibraryPin(entry.id, user.id, newPinned)
      if (filter === 'pinned' && !newPinned) {
        // Remove from view when unpinning on the Pinned filter
        setEntries(prev => prev.filter(e => e.id !== entry.id))
      } else {
        setEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, pinned: newPinned } : e
        ))
      }
    } catch (err) {
      if (__DEV__) console.error('Pin toggle error:', err)
    }
  }, [user?.id, filter])

  const handleEditOpen = useCallback((entry: LibraryEntry) => {
    setEditEntry(entry)
    setEditText(entry.marked_text)
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!editEntry || !user?.id || !editText.trim()) return
    try {
      await updateLibraryEntry(editEntry.id, user.id, { markedText: editText.trim() })
      setEntries(prev => prev.map(e =>
        e.id === editEntry.id ? { ...e, marked_text: editText.trim() } : e
      ))
      setEditEntry(null)
    } catch (err) {
      if (__DEV__) console.error('Edit error:', err)
      Alert.alert('Error', 'Could not save changes.')
    }
  }, [editEntry, editText, user?.id])

  const handleAddQuote = useCallback(async () => {
    if (!user?.id || !addText.trim()) return
    try {
      const entry = await addToLibrary({
        userId: user.id,
        markedText: addText.trim(),
        promptText: '',
        aiObservation: '',
        promptType: 'manual',
        source: 'manual',
      })
      setEntries(prev => [entry as LibraryEntry, ...prev])
      setAddText('')
      setShowAddModal(false)
    } catch (err) {
      if (__DEV__) console.error('Add quote error:', err)
      Alert.alert('Error', 'Could not save quote.')
    }
  }, [addText, user?.id])

  const renderEntry = ({ item }: { item: LibraryEntry }) => (
    <Card>
      <View style={styles.entryHeader}>
        <TouchableOpacity onPress={() => handlePin(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.pinIcon, item.pinned && styles.pinIconActive]}>
            {item.pinned ? 'Pinned' : 'Pin'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleEditOpen(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.markedText}>"{item.marked_text}"</Text>
      {item.ai_observation ? (
        <Text style={styles.observation}>{item.ai_observation}</Text>
      ) : null}
      {item.prompt_text ? (
        <Text style={styles.promptText} numberOfLines={2}>
          Prompt: {item.prompt_text}
        </Text>
      ) : null}
      <View style={styles.entryFooter}>
        <Text style={styles.date}>
          {formatDate(item.created_at)}{item.source === 'manual' ? ' · Manual' : ''}
        </Text>
        <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Card>
  )

  return (
    <ScreenContainer>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Expression Library</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add Quote</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.inkGhost} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            {filter === 'pinned' ? 'No pinned moments' : 'No moments yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {filter === 'pinned'
              ? 'Pin your favorite moments to find them here.'
              : 'Complete a session and mark a moment to see it here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          maxToRenderPerBatch={8}
          removeClippedSubviews
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editEntry} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit moment</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditEntry(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEditSave} disabled={!editText.trim()}>
                <Text style={[styles.modalSave, !editText.trim() && { opacity: 0.4 }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Quote Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a quote</Text>
            <Text style={styles.modalSubtitle}>
              A sentence that matters to you — from anywhere.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={addText}
              onChangeText={setAddText}
              placeholder="Type or paste a quote..."
              placeholderTextColor={colors.inkGhost}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setAddText('') }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddQuote} disabled={!addText.trim()}>
                <Text style={[styles.modalSave, !addText.trim() && { opacity: 0.4 }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.paperDeep,
  },
  addButtonText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterTab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.paperDeep,
  },
  filterTabActive: {
    backgroundColor: colors.ink,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inkMuted,
  },
  filterLabelActive: {
    color: colors.paper,
  },
  list: {
    paddingBottom: 40,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pinIcon: {
    fontSize: 13,
    color: colors.inkGhost,
  },
  pinIconActive: {
    color: colors.gold,
    fontWeight: '500',
  },
  editText: {
    fontSize: 13,
    color: colors.inkMuted,
  },
  markedText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.gold,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  observation: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  promptText: {
    fontSize: 13,
    color: colors.inkGhost,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: colors.inkGhost,
  },
  deleteText: {
    fontSize: 13,
    color: colors.recording,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 16,
  },
  modalInput: {
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  modalCancel: {
    fontSize: 15,
    color: colors.inkMuted,
    paddingVertical: 8,
  },
  modalSave: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    paddingVertical: 8,
  },
})
