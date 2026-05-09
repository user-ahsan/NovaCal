// ─── (tabs)/calendar.tsx ───
// Swipeable month grid: swipe left/right for month navigation.
// Tap day → transitions to day view with parallax.
// Pull-to-refresh. Empty state with encouraging message.
// Events fetched from API or local SQLite.
// ─── Complexity: 🔴 High ───

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import type { Event } from "@novacal/shared/types";
import SwipeableGrid from "../../components/SwipeableGrid";

// ─── Types ───

type CalendarViewMode = "month" | "day";

// ─── Component ───

/**
 * Calendar tab screen. Manages date state, fetches events for the visible
 * month range, and renders them via the SwipeableGrid component.
 *
 * States:
 *   - Loading: shimmer while events fetch
 *   - Empty: encouraging message ("Your day is clear. Breathe.")
 *   - Data: interactive month grid with event chips
 *   - Error: retry prompt
 */
export default function CalendarScreen() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch events for the visible month range ───
  const fetchEvents = useCallback(async (date: Date, silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      // In production this calls the REST API:
      //   GET /api/v1/events?start={monthStart}&end={monthEnd}
      //   Headers: { Authorization: `Bearer ${token}` }
      //
      // For offline-first, it queries local SQLite first, then
      // syncs from server in the background.

      // ── Placeholder: simulate API fetch ──
      // const response = await fetch(
      //   `${instanceUrl}/api/v1/events?start=${encodeURIComponent(monthStart.toISOString())}&end=${encodeURIComponent(monthEnd.toISOString())}`,
      //   { headers: { Authorization: `Bearer ${sessionToken}` } }
      // );
      // const data: PaginatedResponse<Event> = await response.json();
      // setEvents(data.data);

      // Placeholder — return empty events for now
      setEvents([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(currentDate);
  }, [currentDate, fetchEvents]);

  // ─── Date change handler (from swipe or day tap) ───
  const handleDateChange = (newDate: Date) => {
    impactAsync(ImpactFeedbackStyle.Light);
    setCurrentDate(newDate);
  };

  // ─── Pull-to-refresh ───
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchEvents(currentDate, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─── Render: Loading ───
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  // ─── Render: Error ───
  if (error && events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Could not load calendar</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text
          style={styles.retryLink}
          onPress={() => fetchEvents(currentDate)}
        >
          Tap to retry
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ─── Calendar Grid ─── */}
      <SwipeableGrid
        view={viewMode}
        date={currentDate}
        events={events}
        onDateChange={handleDateChange}
        onRefresh={handleRefresh}
      />

      {/* ─── Empty State ───
           Shown when SwipeableGrid renders a month with zero events.
           Uses absolute positioning to overlay on the grid. */}
      {!isLoading && events.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyDecoration}>✦   ✧   ✦</Text>
          <Text style={styles.emptyTitle}>Your day is clear.</Text>
          <Text style={styles.emptySubtitle}>Breathe.</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#A1A1AA",
    fontFamily: "Inter",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  retryLink: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
    fontFamily: "Inter",
  },
  // ─── Empty State ───
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  emptyDecoration: {
    fontSize: 24,
    color: "rgba(255,255,255,0.08)",
    marginBottom: 16,
    letterSpacing: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Inter",
    fontStyle: "italic",
  },
});
