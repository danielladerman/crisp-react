import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useSubscription } from '../../src/hooks/useSubscription'
import { useAuth } from '../../src/hooks/useAuth'
import { colors } from '../../src/lib/theme'

export default function PaywallScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { isSubscribed, packages, loadOfferings, purchase, restore } = useSubscription(user?.id)
  const [purchasing, setPurchasing] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    loadOfferings()
  }, [])

  // If already subscribed, skip to home
  useEffect(() => {
    if (isSubscribed) {
      router.replace('/(tabs)')
    }
  }, [isSubscribed])

  async function handlePurchase() {
    if (packages.length === 0) return
    setPurchasing(true)
    // Pick the annual package, or first available
    const annual = packages.find(p => p.packageType === 'ANNUAL') || packages[0]
    const success = await purchase(annual)
    setPurchasing(false)
    if (success) {
      router.replace('/(tabs)')
    }
  }

  async function handleRestore() {
    setRestoring(true)
    const success = await restore()
    setRestoring(false)
    if (success) {
      router.replace('/(tabs)')
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Continue with CRISP</Text>

      <Text style={styles.body}>
        Your founding session is complete. To keep practicing daily, unlock full access.
      </Text>

      <View style={styles.features}>
        <Text style={styles.featureItem}>Daily personalized sessions</Text>
        <Text style={styles.featureItem}>Voice model that learns your patterns</Text>
        <Text style={styles.featureItem}>Prep mode for high-stakes moments</Text>
        <Text style={styles.featureItem}>Full workout library (40+ drills)</Text>
        <Text style={styles.featureItem}>Weakness tracking + spaced repetition</Text>
      </View>

      <View style={styles.priceBox}>
        <Text style={styles.price}>$44/year</Text>
        <Text style={styles.priceDetail}>3-day free trial included</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, purchasing && styles.buttonDisabled]}
        onPress={handlePurchase}
        disabled={purchasing || packages.length === 0}
      >
        {purchasing ? (
          <ActivityIndicator color={colors.paper} />
        ) : (
          <Text style={styles.buttonText}>Start free trial</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRestore} disabled={restoring}>
        <Text style={styles.restoreText}>
          {restoring ? 'Restoring...' : 'Restore purchase'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.terms}>
        Payment will be charged to your Apple ID account at confirmation of purchase.
        Subscription automatically renews unless it is canceled at least 24 hours before
        the end of the current period.
      </Text>
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
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.inkMuted,
    marginBottom: 32,
  },
  features: {
    gap: 12,
    marginBottom: 32,
  },
  featureItem: {
    fontSize: 15,
    color: colors.ink,
    paddingLeft: 16,
  },
  priceBox: {
    backgroundColor: colors.paperDim,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 4,
  },
  priceDetail: {
    fontSize: 14,
    color: colors.inkMuted,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: colors.paperDeep,
  },
  buttonText: {
    color: colors.paper,
    fontSize: 16,
    fontWeight: '500',
  },
  restoreText: {
    fontSize: 14,
    color: colors.inkGhost,
    textAlign: 'center',
    marginBottom: 24,
  },
  terms: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.inkGhost,
    textAlign: 'center',
  },
})
