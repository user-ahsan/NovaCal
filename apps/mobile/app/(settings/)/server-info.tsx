// ─── Settings: Server Info ───
// Displays connected Instance URL (read-only), live ping latency, server version.
// Tap ping button to re-check latency.
// ─── Complexity: 🟢 Low ───

import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import StatusDot from "../../components/StatusDot";

// ─── Mock data — in production, read from secure store + API ───
const INSTANCE_URL = "https://cal.yourdomain.com";
const SERVER_VERSION = "1.0.0";

export default function ServerInfoSettingsScreen() {
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingStatus, setPingStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [isPinging, setIsPinging] = useState(false);

  // Check latency on mount
  useEffect(() => {
    checkLatency();
  }, []);

  const checkLatency = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPinging(true);
    setPingStatus("connecting");

    try {
      const start = performance.now();

      // GET /api/health
      await new Promise((resolve) => setTimeout(resolve, 300)); // simulate

      const elapsed = Math.round(performance.now() - start);
      setPingLatency(elapsed);
      setPingStatus("connected");
    } catch {
      setPingStatus("error");
      setPingLatency(null);
    } finally {
      setIsPinging(false);
    }
  }, []);

  const latencyColor =
    pingLatency === null
      ? "#A1A1AA"
      : pingLatency < 100
        ? "#22C55E"
        : pingLatency < 300
          ? "#F59E0B"
          : "#EF4444";

  return (
    <>
      <Stack.Screen
        options={{
          title: "Server Info",
          headerLargeTitle: true,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Instance URL ─── */}
        <Text style={styles.sectionTitle}>Instance</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Instance URL</Text>
          </View>
          <Text style={styles.monospaceValue}>{INSTANCE_URL}</Text>
        </View>

        {/* ─── Server Version ─── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Version</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Server Version</Text>
            <StatusDot
              status={pingStatus === "connected" ? "connected" : pingStatus === "error" ? "error" : pingStatus === "connecting" ? "connecting" : "disconnected"}
              size={8}
            />
          </View>
          <Text style={styles.monospaceValue}>{SERVER_VERSION}</Text>
        </View>

        {/* ─── Latency ─── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Connectivity</Text>
        <View style={styles.card}>
          <View style={styles.latencyRow}>
            <View style={styles.latencyInfo}>
              <Text style={styles.label}>Ping Latency</Text>
              <Text
                style={[styles.latencyValue, { color: latencyColor }]}
              >
                {isPinging
                  ? "Measuring..."
                  : pingLatency !== null
                    ? `${pingLatency} ms`
                    : "—"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.pingButton}
              onPress={checkLatency}
              disabled={isPinging}
              activeOpacity={0.7}
            >
              <Text style={styles.pingButtonText}>
                {isPinging ? "..." : "Ping"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Connection Status Legend ─── */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Status Legend</Text>
          <View style={styles.legendRow}>
            <StatusDot status="connected" size={8} />
            <Text style={styles.legendLabel}>Connected</Text>
          </View>
          <View style={styles.legendRow}>
            <StatusDot status="connecting" size={8} />
            <Text style={styles.legendLabel}>Pinging</Text>
          </View>
          <View style={styles.legendRow}>
            <StatusDot status="disconnected" size={8} />
            <Text style={styles.legendLabel}>Disconnected</Text>
          </View>
          <View style={styles.legendRow}>
            <StatusDot status="error" size={8} />
            <Text style={styles.legendLabel}>Error</Text>
          </View>
        </View>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  monospaceValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    fontFamily: "JetBrains Mono",
    marginTop: 2,
  },
  // ─── Latency ───
  latencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  latencyInfo: {
    flex: 1,
  },
  latencyValue: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "JetBrains Mono",
    marginTop: 4,
  },
  pingButton: {
    backgroundColor: "#27272A",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  pingButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  // ─── Legend ───
  legendCard: {
    backgroundColor: "#121214",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#52525B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    fontFamily: "Inter",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  legendLabel: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
});
