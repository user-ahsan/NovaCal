// ─── TargetingReticle ───
// Viewfinder corner brackets for QR scanner.
// Constant breathe: withRepeat(withSpring(1.02), -1, true).
// Darkened overlay rgba(0,0,0,0.7). Uses react-native-svg for corner bracket paths.
// ─── Complexity: 🟢 Low ───

import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSpring,
} from "react-native-reanimated";

type TargetingReticleProps = {
  /** Size of the scan window (square side length). Defaults to 250. */
  size?: number;
  /** Color of the corner brackets. Defaults to "#6366F1" (Electric Indigo). */
  accentColor?: string;
};

const BRACKET_LENGTH_RATIO = 0.25;
const BRACKET_THICKNESS = 3;

/**
 * Viewfinder corner brackets for the QR scanner overlay.
 * Four corner brackets with a constant breathe animation and darkened background.
 */
export default function TargetingReticle({
  size = 250,
  accentColor = "#6366F1",
}: TargetingReticleProps) {
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withRepeat(
          withSpring(1.02, { damping: 20, stiffness: 150 }),
          -1,
          true
        ),
      },
    ],
  }));

  const bracketLength = size * BRACKET_LENGTH_RATIO;
  const halfStroke = BRACKET_THICKNESS / 2;

  // Corner bracket SVG paths radiating from each corner
  const topLeft = `M${halfStroke},${halfStroke + bracketLength} L${halfStroke},${halfStroke} L${halfStroke + bracketLength},${halfStroke}`;
  const topRight = `M${size - halfStroke - bracketLength},${halfStroke} L${size - halfStroke},${halfStroke} L${size - halfStroke},${halfStroke + bracketLength}`;
  const bottomLeft = `M${halfStroke},${size - halfStroke - bracketLength} L${halfStroke},${size - halfStroke} L${halfStroke + bracketLength},${size - halfStroke}`;
  const bottomRight = `M${size - halfStroke - bracketLength},${size - halfStroke} L${size - halfStroke},${size - halfStroke} L${size - halfStroke},${size - halfStroke - bracketLength}`;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Darkened overlay */}
      <View style={styles.overlay} />

      {/* Central cutout wrapper */}
      <View style={styles.cutoutWrapper}>
        {/* Soft inner glow */}
        <View
          style={[
            styles.innerGlow,
            { width: size, height: size, borderColor: accentColor },
          ]}
        />

        {/* Animated bracket container */}
        <Animated.View
          style={[
            styles.bracketContainer,
            { width: size, height: size },
            breatheStyle,
          ]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path
              d={topLeft}
              stroke={accentColor}
              strokeWidth={BRACKET_THICKNESS}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d={topRight}
              stroke={accentColor}
              strokeWidth={BRACKET_THICKNESS}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d={bottomLeft}
              stroke={accentColor}
              strokeWidth={BRACKET_THICKNESS}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d={bottomRight}
              stroke={accentColor}
              strokeWidth={BRACKET_THICKNESS}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  cutoutWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  innerGlow: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 16,
    opacity: 0.3,
  },
  bracketContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});
