// ─── Settings: Notifications ───
// Push notification toggles: Event reminders, Team invites, AI confirmations.
// Reminder timing picker (10min / 30min / 1hr / 1day).
// Haptic on toggle.
// ─── Complexity: 🟢 Low ───

import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  Switch,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";

type ToggleKey = "eventReminders" | "teamInvites" | "aiConfirmations";

const TOGGLE_LABELS: Record<ToggleKey, string> = {
  eventReminders: "Event Reminders",
  teamInvites: "Team Invites",
  aiConfirmations: "AI Scheduling Confirmations",
};

const TOGGLE_DESCRIPTIONS: Record<ToggleKey, string> = {
  eventReminders: "Get notified before your events start",
  teamInvites: "Receive invitations to join workspaces",
  aiConfirmations: "Confirm events created by AI agents",
};

const REMINDER_OPTIONS = [
  { label: "10 minutes before", value: 10 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "1 day before", value: 1440 },
] as const;

export default function NotificationsSettingsScreen() {
  const [toggles, setToggles] = useState<
    Record<ToggleKey, boolean>
  >({
    eventReminders: true,
    teamInvites: true,
    aiConfirmations: false,
  });

  const [reminderMinutes, setReminderMinutes] = useState(30);

  const handleToggle = useCallback((key: ToggleKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerLargeTitle: true,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Notification Toggles ─── */}
        <Text style={styles.sectionTitle}>Push Notifications</Text>
        <View style={styles.card}>
          {(Object.keys(TOGGLE_LABELS) as ToggleKey[]).map((key, index) => (
            <View
              key={key}
              style={[
                styles.toggleRow,
                index < Object.keys(TOGGLE_LABELS).length - 1 && styles.toggleRowBorder,
              ]}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>{TOGGLE_LABELS[key]}</Text>
                <Text style={styles.toggleDesc}>{TOGGLE_DESCRIPTIONS[key]}</Text>
              </View>
              <Switch
                value={toggles[key]}
                onValueChange={() => handleToggle(key)}
                trackColor={{ false: "#27272A", true: "#6366F180" }}
                thumbColor={toggles[key] ? "#6366F1" : "#52525B"}
              />
            </View>
          ))}
        </View>

        {/* ─── Reminder Timing ─── */}
        {toggles.eventReminders && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
              Default Reminder
            </Text>
            <View style={styles.card}>
              {REMINDER_OPTIONS.map((opt, index) => {
                const selected = reminderMinutes === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionRow,
                      index < REMINDER_OPTIONS.length - 1 && styles.toggleRowBorder,
                      selected && styles.optionRowSelected,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setReminderMinutes(opt.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {selected && (
                      <View style={styles.radioOuter}>
                        <View style={styles.radioInner} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A1A1AA",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    fontFamily: "Inter",
  },
  card: {
    backgroundColor: "#121214",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  toggleDesc: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 2,
    fontFamily: "Inter",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionRowSelected: {
    backgroundColor: "rgba(99,102,241,0.08)",
  },
  optionLabel: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  optionLabelSelected: {
    color: "#6366F1",
    fontWeight: "600",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366F1",
  },
});
