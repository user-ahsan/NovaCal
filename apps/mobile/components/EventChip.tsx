// ─── EventChip ───
// Small event indicator on mobile grid.
// Shared element transition using Reanimated.
// Tap: chip scales 1.05, shadow increases, morphs into full-screen.
// withSpring stiffness 200 damping 20 for the transition.
// ─── Complexity: 🟡 Medium ───

import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import type { Event } from "@novacal/shared/types";

type EventChipProps = {
  /** Calendar event to display. */
  event: Event;
  /** Called when the chip is tapped. */
  onPress: (event: Event) => void;
  /** Width of the chip. Defaults to "100%". */
  width?: number | string;
};

/**
 * Small event indicator chip for the mobile calendar grid.
 * Tapping triggers a shared-element-style transition:
 * chip scales 1.05x → elevates → morphs into full-screen event view.
 */
export default function EventChip({
  event,
  onPress,
  width = "100%",
}: EventChipProps) {
  const scale = useSharedValue(1);
  const elevation = useSharedValue(0);

  const startTime = event.startTime
    ? new Date(event.startTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const handlePress = () => {
    // Trigger lift animation then call onPress
    scale.value = withSpring(1.05, { stiffness: 200, damping: 20 });
    elevation.value = withSpring(8, { stiffness: 200, damping: 20 });

    // After a brief moment to show the animation, call onPress
    setTimeout(() => {
      runOnJS(onPress)(event);
    }, 150);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: Math.min(elevation.value / 20, 0.4),
    shadowRadius: elevation.value,
    elevation: elevation.value,
    zIndex: elevation.value > 0 ? 100 : 1,
  }));

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={{ width }}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: event.color || "#6366F1",
          },
          animatedStyle,
        ]}
      >
        <Text style={styles.time} numberOfLines={1}>
          {startTime}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginVertical: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    gap: 4,
  },
  time: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    fontFamily: "JetBrains Mono",
  },
  title: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    flexShrink: 1,
    fontFamily: "Inter",
  },
});
