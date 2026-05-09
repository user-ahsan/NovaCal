// ─── (tabs)/settings.tsx ───
// Main settings hub. Navigation rows: Profile, Workspaces, Notifications,
// Appearance, Database Sync, Server Info. Tap → push to detail screens.
// Chevron indicators. ScrollView with SectionList-style rows.
// ─── Complexity: 🟢 Low ───

import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import SyncStatusIndicator from "../../components/SyncStatusIndicator";

// ─── Types ───

type SettingsRow = {
  /** Unique key for the row. */
  key: string;
  /** Ionicons icon name displayed on the left. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Primary label text. */
  label: string;
  /** Optional secondary text shown below the label. */
  subtitle?: string;
  /** Expo Router path to navigate to on tap. */
  route: string;
};

// ─── Row definitions ───

const SETTINGS_ROWS: SettingsRow[] = [
  {
    key: "profile",
    icon: "person-outline",
    label: "Profile",
    subtitle: "Name, avatar, timezone",
    route: "/settings/profile",
  },
  {
    key: "workspaces",
    icon: "people-outline",
    label: "Workspaces",
    subtitle: "Switch active workspace",
    route: "/settings/workspaces",
  },
  {
    key: "notifications",
    icon: "notifications-outline",
    label: "Notifications",
    subtitle: "Reminder preferences",
    route: "/settings/notifications",
  },
  {
    key: "appearance",
    icon: "color-palette-outline",
    label: "Appearance",
    subtitle: "Theme, accent color",
    route: "/settings/appearance",
  },
  {
    key: "database-sync",
    icon: "sync-outline",
    label: "Database Sync",
    subtitle: "Offline cache & sync queue",
    route: "/settings/database-sync",
  },
  {
    key: "server-info",
    icon: "server-outline",
    label: "Server Info",
    subtitle: "Instance URL, latency, version",
    route: "/settings/server-info",
  },
];

// ─── Row Component ───

type SettingsRowProps = {
  row: SettingsRow;
  onPress: (route: string) => void;
};

/**
 * Single settings navigation row.
 * Icon on the left, label + subtitle in the middle, chevron on the right.
 */
function SettingsRowItem({ row, onPress }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(row.route)}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name={row.icon} size={22} color="#A1A1AA" />
      </View>

      {/* Label + subtitle */}
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        {row.subtitle && (
          <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
        )}
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={18} color="#52525B" />
    </TouchableOpacity>
  );
}

// ─── Settings Screen ───

/**
 * Settings hub tab screen. Renders a vertical list of navigation rows
 * that push to detailed settings sub-screens.
 */
export default function SettingsScreen() {
  const router = useRouter();

  const handleRowPress = useCallback(
    (route: string) => {
      impactAsync(ImpactFeedbackStyle.Light);
      router.push(route);
    },
    [router]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Navigations Rows ─── */}
      <View style={styles.section}>
        {SETTINGS_ROWS.map((row) => (
          <SettingsRowItem key={row.key} row={row} onPress={handleRowPress} />
        ))}
      </View>

      {/* ─── Sync Status Footer ─── */}
      <View style={styles.syncSection}>
        <Text style={styles.syncSectionTitle}>Sync Status</Text>
        <View style={styles.syncCard}>
          <SyncStatusIndicator
            status="synced"
            pendingCount={0}
            lastSyncTimestamp={new Date().toISOString()}
          />
        </View>
      </View>

      {/* ─── App Info ─── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>NovaCal</Text>
        <Text style={styles.footerVersion}>Version 0.0.1</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  // ─── Section ───
  section: {
    marginHorizontal: 16,
    backgroundColor: "#121214", // Depth 2
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  // ─── Row ───
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#09090B", // Depth 1
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  rowSubtitle: {
    fontSize: 12,
    color: "#52525B", // zinc-600
    fontFamily: "Inter",
    marginTop: 2,
  },
  // ─── Sync Status ───
  syncSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  syncSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#52525B",
    fontFamily: "Inter",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  syncCard: {
    backgroundColor: "#121214", // Depth 2
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  // ─── Footer ───
  footer: {
    alignItems: "center",
    marginTop: 32,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#52525B",
    fontFamily: "Inter",
  },
  footerVersion: {
    fontSize: 12,
    color: "#3F3F46",
    fontFamily: "Inter",
    marginTop: 2,
  },
});
