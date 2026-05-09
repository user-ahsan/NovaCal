// ─── SwipeableGrid ───
// Mobile calendar grid with horizontal swipe between months.
// Uses react-native-gesture-handler PanGestureHandler.
// Reanimated useAnimatedStyle for transforms.
// Parallax header: useAnimatedScrollHandler with factor 0.3.
// Pull-to-refresh. Month view default, tap day transitions to day view.
// ─── Complexity: 🔴 Extreme ───

import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PanGestureHandler, type PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import type { Event, CalendarView } from "@novacal/shared/types";
import EventChip from "./EventChip";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_HEADER_HEIGHT = 48;
const MONTH_HEADER_HEIGHT = 56;
const TOTAL_HEADER_HEIGHT = DAY_HEADER_HEIGHT + MONTH_HEADER_HEIGHT;

type SwipeableGridProps = {
  /** Current calendar view. */
  view: CalendarView;
  /** Anchor date. */
  date: Date;
  /** Events to display. */
  events: Event[];
  /** Called when the user navigates to a new date. */
  onDateChange: (date: Date) => void;
  /** Called on pull-to-refresh. */
  onRefresh: () => void;
};

// ─── Helpers ───

function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Component ───

/**
 * Mobile calendar grid with horizontal swipe navigation between months.
 * Features: PanGestureHandler swipe, parallax scroll header (0.3 factor),
 * pull-to-refresh, month/day view switching.
 */
export default function SwipeableGrid({
  view,
  date,
  events,
  onDateChange,
  onRefresh,
}: SwipeableGridProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const translateX = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const isSwiping = useSharedValue(false);

  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();

  // ─── Parallax header handler ───
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -scrollY.value * 0.3, // 0.3 parallax factor
      },
    ],
  }));

  // ─── Swipe gesture ───
  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    translateX.value = event.nativeEvent.translationX;
    isSwiping.value = true;
  };

  const onGestureEnd = () => {
    isSwiping.value = false;
    const threshold = SCREEN_WIDTH * 0.3;

    if (translateX.value < -threshold) {
      // Swipe left = next month
      impactAsync(ImpactFeedbackStyle.Light);
      const next = new Date(currentYear, currentMonth + 1, 1);
      runJSDateChange(next);
    } else if (translateX.value > threshold) {
      // Swipe right = previous month
      impactAsync(ImpactFeedbackStyle.Light);
      const prev = new Date(currentYear, currentMonth - 1, 1);
      runJSDateChange(prev);
    }

    translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
  };

  const runJSDateChange = (newDate: Date) => {
    onDateChange(newDate);
  };

  // ─── Calendar grid data ───
  const calendarData = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const totalCells = Math.ceil((daysInMonth + firstDay) / 7) * 7;
    const days: (number | null)[] = Array(totalCells).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      days[firstDay + d - 1] = d;
    }

    return days;
  }, [currentYear, currentMonth]);

  // ─── Events for a given day ───
  const getEventsForDay = useCallback(
    (day: number): Event[] => {
      const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      return events.filter((e) => {
        const eventDate = new Date(e.startTime);
        const eventDateStr = `${eventDate.getFullYear()}-${(eventDate.getMonth() + 1).toString().padStart(2, "0")}-${eventDate.getDate().toString().padStart(2, "0")}`;
        return eventDateStr === dateStr;
      });
    },
    [events, currentYear, currentMonth]
  );

  const handleDayPress = (day: number) => {
    impactAsync(ImpactFeedbackStyle.Light);
    setSelectedDay(day);
    const newDate = new Date(currentYear, currentMonth, day);
    onDateChange(newDate);
  };

  const handleEventPress = (event: Event) => {
    impactAsync(ImpactFeedbackStyle.Light);
    // Event press handler — parent can expand to full-screen view
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Parallax header */}
        <Animated.View style={[styles.header, parallaxStyle]}>
          {/* Month/Year header */}
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>{getMonthName(date)}</Text>
            <Text style={styles.viewLabel}>
              {view === "month" ? "Month View" : view === "day" ? "Day View" : view}
            </Text>
          </View>

          {/* Day name headers */}
          <View style={styles.dayNamesRow}>
            {DAY_NAMES.map((name) => (
              <View key={name} style={styles.dayNameCell}>
                <Text style={styles.dayNameText}>{name}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Swipeable calendar grid */}
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onEnded={onGestureEnd}
          activateAfterLongPress={100}
          activeOffsetX={[-20, 20]}
        >
          <Animated.View style={[styles.gridContainer, swipeStyle]}>
            {/* Day cells */}
            <View style={styles.grid}>
              {calendarData.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const dayEvents = getEventsForDay(day);
                const isToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === currentMonth &&
                  new Date().getFullYear() === currentYear;
                const isSelected = selectedDay === day;

                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[
                      styles.dayCell,
                      isToday && styles.todayCell,
                      isSelected && styles.selectedCell,
                    ]}
                    onPress={() => handleDayPress(day)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isToday && styles.todayNumber,
                        isSelected && styles.selectedNumber,
                      ]}
                    >
                      {day}
                    </Text>

                    {/* Event chips */}
                    <View style={styles.eventChips}>
                      {dayEvents.slice(0, 3).map((event) => (
                        <EventChip
                          key={event.id}
                          event={event}
                          onPress={handleEventPress}
                          width="100%"
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <Text style={styles.moreEvents}>
                          +{dayEvents.length - 3} more
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </PanGestureHandler>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    zIndex: 10,
  },
  monthHeader: {
    height: MONTH_HEADER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#09090B",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  viewLabel: {
    fontSize: 11,
    color: "#A1A1AA",
    fontFamily: "Inter",
    marginTop: 2,
  },
  dayNamesRow: {
    flexDirection: "row",
    height: DAY_HEADER_HEIGHT,
    backgroundColor: "#09090B",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  dayNameCell: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#52525B",
    textTransform: "uppercase",
    fontFamily: "Inter",
    letterSpacing: 0.5,
  },
  gridContainer: {
    minHeight: 400,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#000000",
  },
  todayCell: {
    backgroundColor: "rgba(99,102,241,0.08)",
  },
  selectedCell: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderColor: "#6366F1",
    borderWidth: 1,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "500",
    color: "#A1A1AA",
    fontFamily: "JetBrains Mono",
    marginBottom: 2,
  },
  todayNumber: {
    color: "#6366F1",
    fontWeight: "700",
  },
  selectedNumber: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  eventChips: {
    gap: 1,
  },
  moreEvents: {
    fontSize: 9,
    color: "#52525B",
    fontFamily: "Inter",
    paddingHorizontal: 2,
  },
});
