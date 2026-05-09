// ─── SyncStatusIndicator ───
// Compact status badge for settings.
// Shows: "Synced" (green), "Syncing..." (accent + pulse), "Offline" (orange), "Error" (red).
// Uses Reanimated for pulse animation.
// ─── Complexity: 🟢 Low ───

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import SyncProgressRing from "./SyncProgressRing";

type SyncStatus = "synced" | "syncing" | "offline" | "error";

type SyncStatusIndicatorProps = {
  /** Current sync status. */
  status: SyncStatus;
  /** Number of pending mutations to sync. */
  pendingCount: number;
  /** ISO timestamp of last successful sync. */
  lastSyncTimestamp: string;
};

const STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; showRing: boolean }> = {
  synced: { label: "Synced", color: "#22C55E", showRing: true },
  syncing: { label: "Syncing...", color: "#6366F1", showRing: true },
  offline: { label: "Offline", color: "#F59E0B", showRing: true },
  error: { label: "Error", color: "#EF4444", showRing: false },
};

/**
 * Compact sync status badge for mobile settings screens.
 * Shows connection status with text label, color coding, and pulse animation.
 */
export default function SyncStatusIndicator({
  status,
  pendingCount,
  lastSyncTimestamp,
}: SyncStatusIndicatorProps) {
  const pulseOpacity = useSharedValue(1);
  const config = STATUS_CONFIG[status];
  const isSyncing = status === "syncing";

  useEffect(() => {
    if (isSyncing) {
      pulseOpacity.value = withRepeat(
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isSyncing, pulseOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const formattedTime = lastSyncTimestamp
    ? new Date(lastSyncTimestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {config.showRing ? (
          <SyncProgressRing
            progress={status === "synced" ? 100 : pendingCount > 0 ? 30 : 100}
            status={status === "synced" ? "idle" : status === "syncing" ? "syncing" : "offline"}
            size={20}
            strokeWidth={2}
          />
        ) : (
          <View style={[styles.errorDot, { backgroundColor: config.color }]} />
        )}

        <Animated.Text
          style={[
            styles.label,
            { color: config.color },
            isSyncing && animatedStyle,
          ]}
        >
          {config.label}
        </Animated.Text>
      </View>

      {pendingCount > 0 && (
        <Text style={styles.pending}>
          {pendingCount} pending mutation{pendingCount !== 1 ? "s" : ""}
        </Text>
      )}

      <Text style={styles.timestamp}>Last sync: {formattedTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  pending: {
    fontSize: 12,
    color: "#A1A1AA", // zinc-400
    marginTop: 4,
    fontFamily: "Inter",
  },
  timestamp: {
    fontSize: 11,
    color: "#52525B", // zinc-600
    marginTop: 2,
    fontFamily: "Inter",
  },
  errorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
