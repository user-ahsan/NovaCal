// ─── Settings: Appearance ───
// Theme selector: Dark / Light / System radio group.
// Theme preview card showing the selected theme.
// Haptic on selection. Circular reveal animation placeholder.
// ─── Complexity: 🟡 Medium ───

import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";

type ThemeMode = "dark" | "light" | "system";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "light", label: "Light", icon: "☀️" },
  { value: "system", label: "System", icon: "⚙️" },
];

/**
 * Theme preview card — shows a miniature representation of the selected theme.
 * Dark card: OLED black background with white text.
 * Light card: white background with dark text.
 */
function ThemePreviewCard({ mode }: { mode: ThemeMode }) {
  const isDark = mode === "dark" || (mode === "system" && true); // system follows device
  const bg = isDark ? "#000000" : "#FFFFFF";
  const fg = isDark ? "#FFFFFF" : "#09090B";
  const muted = isDark ? "#A1A1AA" : "#52525B";
  const accent = "#6366F1";

  return (
    <View
      style={[
        styles.previewCard,
        {
          backgroundColor: bg,
          borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)",
        },
      ]}
    >
      {/* Mini header */}
      <View style={styles.previewHeader}>
        <View style={[styles.previewDot, { backgroundColor: accent }]} />
        <View
          style={[
            styles.previewLine,
            { backgroundColor: isDark ? "#27272A" : "#E4E4E7" },
          ]}
        />
      </View>

      {/* Mini event blocks */}
      <View style={styles.previewBody}>
        <View
          style={[
            styles.previewEvent,
            {
              backgroundColor: isDark ? "#121214" : "#F4F4F5",
              borderLeftColor: accent,
            },
          ]}
        >
          <Text style={[styles.previewEventTitle, { color: fg }]}>
            Sprint Review
          </Text>
          <Text style={[styles.previewEventTime, { color: muted }]}>
            10:00 – 11:00
          </Text>
        </View>
        <View
          style={[
            styles.previewEvent,
            {
              backgroundColor: isDark ? "#121214" : "#F4F4F5",
              borderLeftColor: "#22C55E",
            },
          ]}
        >
          <Text style={[styles.previewEventTitle, { color: fg }]}>
            Standup
          </Text>
          <Text style={[styles.previewEventTime, { color: muted }]}>
            09:00 – 09:15
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AppearanceSettingsScreen() {
  const [selected, setSelected] = useState<ThemeMode>("dark");
  const revealAnim = useRef(new Animated.Value(0)).current;

  const handleSelect = useCallback(
    (mode: ThemeMode) => {
      if (mode === selected) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Circular reveal animation placeholder
      // In production: use Reanimated with circular clip-path
      // circle(0% at tapX tapY) → circle(150% at tapX tapY) ~400ms spring
      Animated.spring(revealAnim, {
        toValue: 1,
        useNativeDriver: false,
        stiffness: 200,
        damping: 25,
      }).start(() => {
        setSelected(mode);
        revealAnim.setValue(0);
      });
    },
    [selected, revealAnim],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Appearance",
          headerLargeTitle: true,
        }}
      />

      <View style={styles.container}>
        {/* Theme Preview Card */}
        <ThemePreviewCard mode={selected} />

        {/* Theme Selector */}
        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.card}>
          {THEME_OPTIONS.map((opt, index) => {
            const isSelected = selected === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionRow,
                  index < THEME_OPTIONS.length - 1 && styles.optionBorder,
                  isSelected && styles.optionSelected,
                ]}
                onPress={() => handleSelect(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.optionIcon}>{opt.icon}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && styles.optionLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <View style={styles.radioOuter}>
                    <View style={styles.radioInner} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A1A1AA",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 24,
    fontFamily: "Inter",
  },
  // ─── Preview Card ───
  previewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    minHeight: 160,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  previewLine: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  previewBody: {
    gap: 8,
  },
  previewEvent: {
    borderRadius: 8,
    borderLeftWidth: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  previewEventTitle: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  previewEventTime: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: "Inter",
  },
  // ─── Options ───
  card: {
    backgroundColor: "#121214",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  optionSelected: {
    backgroundColor: "rgba(99,102,241,0.08)",
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
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
