// ─── Settings: Database Sync ───
// Critical for offline-first architecture.
// Shows SQLite local file size, pending sync count, last sync timestamp.
// SyncProgressRing visual indicator. Force Push + Pull Latest buttons.
// ─── Complexity: 🟡 Medium ───

import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import SyncProgressRing from "../../components/SyncProgressRing";

// ─── Types ───
type SyncStatus = "idle" | "syncing" | "offline" | "error";

type SyncStats = {
  sqliteSizeMB: number;
  pendingCount: number;
  lastSyncTimestamp: string;
  status: SyncStatus;
};

// ─── Format bytes to human-readable ───
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DatabaseSyncSettingsScreen() {
  const [stats, setStats] = useState<SyncStats>({
    sqliteSizeMB: 2.4,
    pendingCount: 3,
    lastSyncTimestamp: new Date().toISOString(),
    status: "idle",
  });

  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  // ─── Simulate initial status check ───
  useEffect(() => {
    // In production: read from SQLite metadata table
    if (stats.pendingCount > 0) {
      setStats((prev) => ({ ...prev, status: "offline" }));
    }
  }, [stats.pendingCount]);

  // ─── Force Push: push queued mutations to server ───
  const handleForcePush = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPushing(true);
    setStats((prev) => ({ ...prev, status: "syncing" }));

    try {
      // POST /api/v1/sync/push  { mutations: [...] }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // simulate

      setStats((prev) => ({
        ...prev,
        pendingCount: 0,
        status: "idle",
        lastSyncTimestamp: new Date().toISOString(),
      }));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Synced", "All pending mutations pushed successfully.");
    } catch {
      setStats((prev) => ({ ...prev, status: "error" }));
      Alert.alert("Sync Error", "Failed to push mutations. Check your connection.");
    } finally {
      setIsPushing(false);
    }
  }, []);

  // ─── Pull Latest: fetch remote changes ───
  const handlePullLatest = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPulling(true);
    setStats((prev) => ({ ...prev, status: "syncing" }));

    try {
      // GET /api/v1/sync/pull?since={lastSyncTimestamp}
      await new Promise((resolve) => setTimeout(resolve, 2500)); // simulate

      setStats((prev) => ({
        ...prev,
        status: "idle",
        lastSyncTimestamp: new Date().toISOString(),
      }));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Updated", "Latest remote changes pulled successfully.");
    } catch {
      setStats((prev) => ({ ...prev, status: "error" }));
      Alert.alert("Pull Error", "Failed to pull remote changes.");
    } finally {
      setIsPulling(false);
    }
  }, []);

  // ─── Progress ring: based on pending count (100 = fully synced) ───
  const syncProgress =
    stats.pendingCount === 0
      ? 100
      : Math.max(10, 100 - stats.pendingCount * 15);

  const ringStatus =
    stats.status === "idle"
      ? "idle"
      : stats.status === "syncing"
        ? "syncing"
        : stats.status === "offline"
          ? "offline"
          : "idle"; // error → show idle ring, error shown via text

  const formattedTime = stats.lastSyncTimestamp
    ? new Date(stats.lastSyncTimestamp).toLocaleString()
    : "—";

  return (
    <>
      <Stack.Screen
        options={{
          title: "Database Sync",
          headerLargeTitle: true,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Sync Status Ring ─── */}
        <View style={styles.ringSection}>
          <SyncProgressRing
            progress={syncProgress}
            status={ringStatus}
            size={80}
            strokeWidth={6}
          />

          <Text style={styles.ringLabel}>
            {stats.status === "idle"
              ? "Synced"
              : stats.status === "syncing"
                ? "Syncing..."
                : stats.status === "offline"
                  ? "Offline"
                  : "Error"}
          </Text>
        </View>

        {/* ─── Database Stats Card ─── */}
        <Text style={styles.sectionTitle}>Local SQLite Cache</Text>
        <View style={styles.card}>
          <StatRow
            label="Database Size"
            value={formatBytes(stats.sqliteSizeMB * 1024 * 1024)}
          />
          <StatRow
            label="Pending Mutations"
            value={String(stats.pendingCount)}
            valueColor={stats.pendingCount > 0 ? "#F59E0B" : "#22C55E"}
            isLast
          />
        </View>

        {/* ─── Last Sync ─── */}
        <View style={styles.lastSyncCard}>
          <Text style={styles.lastSyncLabel}>Last Sync</Text>
          <Text style={styles.lastSyncTime}>{formattedTime}</Text>
        </View>

        {/* ─── Action Buttons ─── */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.pushButton]}
            onPress={handleForcePush}
            disabled={isPushing || isPulling || stats.pendingCount === 0}
            activeOpacity={0.8}
          >
            {isPushing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.actionButtonIcon}>↑</Text>
                <Text style={styles.actionButtonText}>Force Push</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.pullButton]}
            onPress={handlePullLatest}
            disabled={isPushing || isPulling}
            activeOpacity={0.8}
          >
            {isPulling ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.actionButtonIcon}>↓</Text>
                <Text style={styles.actionButtonText}>Pull Latest</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerHint}>
          Push sends your local changes to the server. Pull fetches remote changes.
          Both keep your data in sync across devices.
        </Text>
      </ScrollView>
    </>
  );
}

// ─── Stat Row Sub-component ───
type StatRowProps = {
  label: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
};

function StatRow({ label, value, valueColor, isLast }: StatRowProps) {
  return (
    <View
      style={[
        styles.statRow,
        !isLast && styles.statRowBorder,
      ]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  // ─── Ring Section ───
  ringSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  ringLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#A1A1AA",
    marginTop: 12,
    fontFamily: "Inter",
  },
  // ─── Card ───
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
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  statLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  // ─── Last Sync ───
  lastSyncCard: {
    backgroundColor: "#121214",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  lastSyncLabel: {
    fontSize: 12,
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  lastSyncTime: {
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 4,
    fontFamily: "Inter",
  },
  // ─── Buttons ───
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  pushButton: {
    backgroundColor: "#6366F1",
  },
  pullButton: {
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  actionButtonIcon: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  footerHint: {
    fontSize: 12,
    color: "#52525B",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
    fontFamily: "Inter",
  },
});
