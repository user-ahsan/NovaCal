// ─── (tabs)/_layout.tsx ───
// Bottom tab bar: Calendar, Agenda, Notifications, Settings.
// Auth required — redirects to /connect if no session.
// Dark theme tab bar styling per design spec.
// Ionicons from @expo/vector-icons.
// ─── Complexity: 🟡 Medium ───

import React from "react";
import { Platform, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Tab icon mapping — Ionicons names per tab
const TAB_ICONS: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  calendar: { focused: "calendar", default: "calendar-outline" },
  agenda: { focused: "list", default: "list-outline" },
  notifications: { focused: "notifications", default: "notifications-outline" },
  settings: { focused: "settings", default: "settings-outline" },
};

/**
 * Root tab navigator for the authenticated mobile experience.
 * Renders a bottom tab bar with 4 tabs. Auth guard checks for
 * a valid session token before rendering tab content.
 */
export default function TabsLayout() {
  const router = useRouter();

  // ─── Auth guard ───
  // In production this checks secure storage for a session token.
  // If none exists, redirects to /connect (instance URL entry).
  // For now the parent (auth) layout handles this redirect.
  //
  // Example guard (commented — wired by auth context):
  //   const { session } = useAuth();
  //   useEffect(() => { if (!session) router.replace("/connect"); }, [session]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#6366F1", // Electric Indigo accent
        tabBarInactiveTintColor: "#52525B", // zinc-600 muted
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      {/* ── Calendar Tab ── */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.calendar.focused : TAB_ICONS.calendar.default}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ── Agenda Tab ── */}
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.agenda.focused : TAB_ICONS.agenda.default}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ── Notifications Tab ── */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.notifications.focused : TAB_ICONS.notifications.default}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ── Settings Tab ── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.settings.focused : TAB_ICONS.settings.default}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#000000", // OLED black (Depth 0)
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 4,
    height: Platform.OS === "ios" ? 88 : 64, // Safe area bottom on iOS
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    elevation: 0, // No shadow on Android — just the border
    shadowOpacity: 0,
  },
  tabLabel: {
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
