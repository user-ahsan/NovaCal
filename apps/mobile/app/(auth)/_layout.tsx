// ─── Auth Stack Layout ───
// No bottom tabs. Full-screen stack navigator.
// Shown only when no valid session exists.
// ─── Complexity: 🟢 Low ───

import React from "react";
import { Stack } from "expo-router";

/**
 * Auth stack layout for the unauthenticated flow.
 *
 * Screens:
 * - /connect → Instance URL entry
 * - /login   → Email/password form
 * - /scanner → QR bridge camera
 *
 * Presented as a full-screen stack with no bottom tabs.
 * Each screen slides from the right (iOS default spring).
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#000000" },
        // Prevent swipe-back gesture to keep auth flow linear
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="connect" />
      <Stack.Screen name="login" />
      <Stack.Screen name="scanner" />
    </Stack>
  );
}
