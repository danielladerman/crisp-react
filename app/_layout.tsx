import { useEffect, useState, useRef } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '../src/hooks/useAuth'
import { useSubscription } from '../src/hooks/useSubscription'
import { getSessionCount } from '../src/lib/storage'

export default function RootLayout() {
  const { user, loading } = useAuth()
  const { isSubscribed, loading: subLoading } = useSubscription(user?.id)
  const router = useRouter()
  const segments = useSegments()
  const hasNavigated = useRef(false)

  useEffect(() => {
    if (loading || subLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'

    if (!user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/sign-in')
      }
      hasNavigated.current = false
      return
    }

    // Already navigated this session — don't re-route on token refresh
    if (hasNavigated.current) return
    hasNavigated.current = true

    // Check if user needs onboarding or paywall
    let cancelled = false
    getSessionCount(user.id).then((count) => {
      if (cancelled) return
      if (count === 0) {
        router.replace('/(onboarding)/welcome')
      } else if (!isSubscribed) {
        router.replace('/(onboarding)/paywall')
      } else if (inAuthGroup || inOnboarding) {
        router.replace('/(tabs)')
      }
    })
    return () => { cancelled = true }
  }, [user, loading, subLoading, isSubscribed, segments])

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="prep" />
      </Stack>
    </>
  )
}
