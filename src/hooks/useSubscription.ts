import { useState, useEffect, useCallback } from 'react'
import { Platform } from 'react-native'

// Dynamic import — react-native-purchases is a native module that crashes Expo Go
let Purchases: any = null
let PurchasesLoaded = false

try {
  Purchases = require('react-native-purchases').default
  PurchasesLoaded = true
} catch {
  // Running in Expo Go or native module unavailable — fail open
}

const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || ''
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || ''
const ENTITLEMENT_ID = 'pro'

let initialized = false
let configuring = false

export function useSubscription(userId?: string) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [packages, setPackages] = useState<any[]>([])

  useEffect(() => {
    async function init() {
      if (!PurchasesLoaded) {
        setIsSubscribed(true)
        setLoading(false)
        return
      }

      if (initialized) {
        // Already initialized, just check status
        await checkSubscription()
        return
      }

      // Prevent concurrent configure attempts from multiple effect runs
      if (configuring) return
      configuring = true

      try {
        const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID
        if (!apiKey) {
          // No RevenueCat key configured — treat as subscribed (dev mode)
          setIsSubscribed(true)
          setLoading(false)
          configuring = false
          return
        }

        Purchases.configure({ apiKey, appUserID: userId })
        initialized = true
        configuring = false

        await checkSubscription()
      } catch (err) {
        configuring = false
        // Expected in Expo Go — native module bridge exists but isn't functional
        if (__DEV__) {
          console.warn('RevenueCat init skipped (expected in Expo Go):', (err as Error).message)
        } else {
          console.error('RevenueCat init failed:', err)
        }
        // Fail open
        setIsSubscribed(true)
        setLoading(false)
      }
    }

    init()
  }, [userId])

  async function checkSubscription() {
    try {
      const customerInfo: any = await Purchases.getCustomerInfo()
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID]
      setIsSubscribed(!!entitlement)
    } catch {
      // Fail open
      setIsSubscribed(true)
    }
    setLoading(false)
  }

  const loadOfferings = useCallback(async () => {
    if (!PurchasesLoaded) return
    try {
      const offerings = await Purchases.getOfferings()
      if (offerings.current?.availablePackages) {
        setPackages(offerings.current.availablePackages)
      }
    } catch (err) {
      if (__DEV__) console.warn('Failed to load offerings:', (err as Error).message)
      else console.error('Failed to load offerings:', err)
    }
  }, [])

  const purchase = useCallback(async (pkg: any) => {
    if (!PurchasesLoaded) return false
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg)
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID]
      setIsSubscribed(!!entitlement)
      return !!entitlement
    } catch (err: any) {
      if (!err.userCancelled) {
        console.error('Purchase failed:', err)
      }
      return false
    }
  }, [])

  const restore = useCallback(async () => {
    if (!PurchasesLoaded) return false
    try {
      const customerInfo = await Purchases.restorePurchases()
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID]
      setIsSubscribed(!!entitlement)
      return !!entitlement
    } catch (err) {
      console.error('Restore failed:', err)
      return false
    }
  }, [])

  return { isSubscribed, loading, packages, loadOfferings, purchase, restore }
}
