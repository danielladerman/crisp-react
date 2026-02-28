import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useAuth } from '../../src/hooks/useAuth'
import { getLibraryFiltered, deleteLibraryEntry } from '../../src/lib/storage'
import { ScreenContainer, Card } from '../../src/components/ui'
import { colors, spacing } from '../../src/lib/theme'

type FilterType = 'all' | 'breakthroughs' | 'prep'

interface LibraryEntry {
  id: string
  marked_text: string
  prompt_text: string
  ai_observation: string
  created_at: string
  prompt_type: string
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'breakthroughs', label: 'Breakthroughs' },
  { key: 'prep', label: 'Prep' },
]

export default function LibraryScreen() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)

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
            }
          },
        },
      ],
    )
  }, [user?.id])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const renderEntry = ({ item }: { item: LibraryEntry }) => (
    <Card>
      <Text style={styles.markedText}>"{item.marked_text}"</Text>
      {item.ai_observation ? (
        <Text style={styles.observation}>{item.ai_observation}</Text>
      ) : null}
      <Text style={styles.promptText} numberOfLines={2}>
        Prompt: {item.prompt_text}
      </Text>
      <View style={styles.entryFooter}>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Card>
  )

  return (
    <ScreenContainer>
      <Text style={styles.title}>Expression Library</Text>

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
          <Text style={styles.emptyTitle}>No moments yet</Text>
          <Text style={styles.emptyBody}>
            Complete a session and mark a moment to see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
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
})
