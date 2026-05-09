// ─── SyncProgressRing ───
// Circular sync progress indicator using @shopify/react-native-skia.
// Skia Path trimmed from start→end based on progress.
// Syncing: accent color animating. Idle: static green. Offline: orange pulse.
// ─── Complexity: 🟡 Medium ───

import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

type SyncStatus = "syncing" | "idle" | "offline";

type SyncProgressRingProps = {
  /** Sync progress from 0 to 100. */
  progress: number;
  /** Sync status determining ring color and behavior. */
  status: SyncStatus;
  /** Ring diameter. Defaults to 40. */
  size?: number;
  /** Ring stroke width. Defaults to 3. */
  strokeWidth?: number;
};

const RING_COLORS: Record<SyncStatus, string> = {
  syncing: "#6366F1", // Electric Indigo accent
  idle: "#22C55E", // green-500
  offline: "#F59E0B", // amber-500
};

/**
 * Circular sync progress indicator built with @shopify/react-native-skia.
 * Uses Skia Path trimming to show fill progress. Animated via Reanimated for pulse.
 */
export default function SyncProgressRing({
  progress,
  status,
  size = 40,
  strokeWidth = 3,
}: SyncProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Offline pulse opacity
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (status === "offline") {
      pulseOpacity.value = withRepeat(
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [status, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Build Skia circular path once
  const circlePath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(center, center, radius);
    return path;
  }, [center, radius]);

  // Compute trimmed end ratio (0 to 1)
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const endRatio = clampedProgress / 100;

  // Trimmed path for progress arc
  const progressPath = useMemo(() => {
    return circlePath.trimmedPath(0, endRatio, false);
  }, [circlePath, endRatio]);

  const currentColor = RING_COLORS[status];

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, pulseStyle]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          color="rgba(255,255,255,0.05)"
          style="stroke"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc — trimmed path */}
        <Path
          path={progressPath}
          color={currentColor}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});
