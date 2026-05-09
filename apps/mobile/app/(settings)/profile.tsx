// ─── Settings: Profile ───
// Edit display name, view current avatar + name.
// Saves to API on submit. Haptic feedback on save.
// ─── Complexity: 🟢 Low ───

import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

// Placeholder user data — in production, this comes from auth/session context
const CURRENT_USER = {
  id: "self",
  name: "Alex Nova",
  email: "alex@example.com",
  avatarUrl: null,
};

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(CURRENT_USER.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert("Validation", "Display name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      // POST /api/v1/users/profile  { name: trimmed }
      await new Promise((resolve) => setTimeout(resolve, 600)); // simulate API

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Your display name has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [displayName, router]);

  const initials = CURRENT_USER.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Profile",
          headerLargeTitle: true,
        }}
      />

      <View style={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {CURRENT_USER.avatarUrl ? (
            <View style={[styles.avatar, { backgroundColor: "#6366F1" }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          ) : (
            <View style={[styles.avatar, { backgroundColor: "#27272A" }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Email (read-only) */}
        <Text style={styles.emailLabel}>{CURRENT_USER.email}</Text>

        {/* Display Name Input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#52525B"
            autoFocus={false}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  emailLabel: {
    fontSize: 13,
    color: "#A1A1AA",
    textAlign: "center",
    marginBottom: 32,
    fontFamily: "Inter",
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A1A1AA",
    marginBottom: 8,
    fontFamily: "Inter",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#121214",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  saveButton: {
    backgroundColor: "#6366F1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
});
