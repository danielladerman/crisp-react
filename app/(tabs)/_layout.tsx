import { Tabs } from 'expo-router'
import { colors } from '../../src/lib/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkGhost,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.paperDeep,
          borderTopWidth: 1,
          paddingTop: 8,
          height: 84,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => null,
        }}
      />
      <Tabs.Screen
        name="patterns"
        options={{
          title: 'Patterns',
          tabBarIcon: ({ color }) => null,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ color }) => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => null,
        }}
      />
    </Tabs>
  )
}
