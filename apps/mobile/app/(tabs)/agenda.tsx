// ─── (tabs)/agenda.tsx ───
// Vertical scrolling chronological list of events grouped by date.
// Sticky date headers using SectionList + Reanimated for native-thread scroll.
// Event cards: time (JetBrains Mono), title, location, color dot.
// Fade-up on scroll enter (opacity 0→1, translateY 10→0).
// useAnimatedScrollHandler on UI thread — 60/120fps target.
// ─── Complexity: 🔴 High ───

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
  type SectionListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import type { Event } from "@novacal/shared/types";

// ─── Types ───

/** A section of events grouped by a single date string. */
type AgendaSection = {
  /** Date label displayed in the sticky header (e.g. "Today, May 10"). */
  title: string;
  /** Raw date string for sorting. */
  dateKey: string;
  /** Events occurring on this date. */
  data: Event[];
};

// ─── Helpers ───

/**
 * Formats an ISO date string into a human-readable label.
 * Returns "Today", "Tomorrow", or the weekday + month/day.
 */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStrNorm = dateStr.slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  if (dateStrNorm === todayStr) return "Today";
  if (dateStrNorm === tomorrowStr) return "Tomorrow";

  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${weekday}, ${monthDay}`;
}

/**
 * Groups events by date key (YYYY-MM-DD) and sorts ascending.
 */
function groupEventsByDate(events: Event[]): AgendaSection[] {
  const grouped: Record<string, Event[]> = {};

  for (const event of events) {
    const dateKey = new Date(event.startTime).toISOString().slice(0, 10);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, evts]) => ({
      title: formatDateLabel(dateKey),
      dateKey,
      data: evts.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    }));
}

// ─── Animated Event Row ───

type AgendaRowProps = {
  event: Event;
  index: number;
  scrollY: SharedValue<number>;
};

/**
 * Single event row with fade-up animation on scroll enter.
 * When the row's estimated Y position enters the viewport,
 * it fades in with a spring-driven translateY + opacity transition.
 */
function AgendaRow({ event, index, scrollY }: AgendaRowProps) {
  const ROW_HEIGHT = 72;
  const ENTER_THRESHOLD = 100;

  // Estimate the row's Y offset (approximate — production uses onLayout)
  const rowOffset = 120 + index * ROW_HEIGHT;

  // Compute how far the row is from the viewport top
  const distanceFromTop = useSharedValue(0);

  // Track scroll-driven visibility for fade-up
  const animatedStyle = useAnimatedStyle(() => {
    const offset = scrollY.value;
    const rowTop = rowOffset - offset;
    const isVisible = rowTop < ENTER_THRESHOLD + 300 && rowTop > -ROW_HEIGHT;

    if (isVisible && rowTop > 0) {
      // Fade-up: opacity 0→1, translateY 10→0 as row enters
      const progress = Math.max(0, Math.min(1, 1 - rowTop / ENTER_THRESHOLD));
      return {
        opacity: withSpring(progress, { damping: 20, stiffness: 200 }),
        transform: [
          { translateY: withSpring((1 - progress) * 10, { damping: 20, stiffness: 200 }) },
        ],
      };
    }
    return { opacity: 1, transform: [{ translateY: 0 }] };
  });

  const startTime = new Date(event.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePress = () => {
    impactAsync(ImpactFeedbackStyle.Light);
    // Navigate to event detail modal
    // router.push(`/event/${event.id}`);
  };

  return (
    <Animated.View style={[styles.eventRow, animatedStyle]}>
      <TouchableOpacity
        style={styles.eventCard}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Color dot */}
        <View
          style={[
            styles.colorDot,
            { backgroundColor: event.color || "#6366F1" },
          ]}
        />

        {/* Time column */}
        <View style={styles.timeColumn}>
          <Text style={styles.eventTime}>{startTime}</Text>
          {event.isAllDay && <Text style={styles.allDayBadge}>All day</Text>}
        </View>

        {/* Event details */}
        <View style={styles.eventDetails}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>
          {event.location && (
            <Text style={styles.eventLocation} numberOfLines={1}>
              {event.location}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Agenda Component ───

/**
 * Agenda tab screen. Chronological list of upcoming events grouped by date.
 * Features sticky date headers, fade-up animations, pull-to-refresh.
 * Uses Animated SectionList for native-thread 60/120fps scrolling.
 */
export default function AgendaScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared scroll value for child row animations
  const scrollY = useSharedValue(0);

  // Native-thread scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ─── Fetch events ───
  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      // In production:
      //   GET /api/v1/events?start={now}&limit=100&sort=startTime:asc
      //   Headers: { Authorization: `Bearer ${token}` }
      //
      // For offline-first: query local SQLite first, background sync.

      // ── Placeholder ──
      setEvents([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchEvents(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Group events by date for SectionList
  const sections = useMemo(() => groupEventsByDate(events), [events]);

  // ─── Sticky Header ───
  const renderSectionHeader = useCallback(
    ({ section }: { section: AgendaSection }) => (
      <View style={styles.stickyHeader}>
        <Text style={styles.stickyHeaderText}>{section.title}</Text>
        <Text style={styles.stickyHeaderIcon}>📅</Text>
      </View>
    ),
    []
  );

  // ─── Event Row Renderer ───
  const renderItem = useCallback(
    ({ item, index, section }: SectionListRenderItemInfo<Event, AgendaSection>) => {
      // Calculate global index across all sections
      let globalIndex = index;
      for (const sec of sections) {
        if (sec.dateKey === section.dateKey) break;
        globalIndex += sec.data.length;
      }

      return <AgendaRow event={item} index={globalIndex} scrollY={scrollY} />;
    },
    [sections, scrollY]
  );

  const keyExtractor = useCallback((item: Event) => item.id, []);

  // ─── Render: Loading ───
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading agenda...</Text>
      </View>
    );
  }

  // ─── Render: Error ───
  if (error && events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Could not load agenda</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text
          style={styles.retryLink}
          onPress={() => fetchEvents()}
        >
          Tap to retry
        </Text>
      </View>
    );
  }

  // ─── Render: Empty State ───
  if (!isLoading && events.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyDecoration}>✦   ✧   ✦</Text>
        <Text style={styles.emptyTitle}>No upcoming events</Text>
        <Text style={styles.emptySubtitle}>
          Your schedule is wide open.
        </Text>
      </View>
    );
  }

  // ─── Render: Agenda List ───
  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* Flat section list for grouped events */}
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={true}
          scrollEnabled={false} // Nested inside the animated ScrollView
          showsVerticalScrollIndicator={false}
        />
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
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
  // ─── Sticky Date Header ───
  stickyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(9,9,11,0.92)", // Depth 1 with blur-equivalent opacity
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  stickyHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  stickyHeaderIcon: {
    fontSize: 16,
  },
  // ─── Event Row ───
  eventRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214", // Depth 2
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  timeColumn: {
    width: 60,
    alignItems: "flex-start",
    marginRight: 12,
  },
  eventTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "JetBrains Mono",
  },
  allDayBadge: {
    fontSize: 9,
    fontWeight: "600",
    color: "#6366F1",
    fontFamily: "Inter",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 12,
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
});
