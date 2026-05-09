// ─── CameraScanner ───
// Camera view with QR detection. Wraps expo-camera.
// Renders TargetingReticle as overlay. On QR detected: neon bounding box snaps to
// code with spring, turns green, calls onDetected(data).
// ─── Complexity: 🔴 High ───

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { CameraView, type BarcodeScanningResult } from "expo-camera";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import TargetingReticle from "./TargetingReticle";

type CameraScannerProps = {
  /** Called when a QR code is successfully detected and validated. */
  onDetected: (data: string) => void;
  /** Whether the scanner is actively scanning. */
  isActive: boolean;
};

/**
 * QR code camera scanner wrapping expo-camera.
 * Renders a TargetingReticle overlay with animated detection feedback.
 * On scan: neon bounding box snaps to QR, turns green, calls onDetected.
 */
export default function CameraScanner({
  onDetected,
  isActive,
}: CameraScannerProps) {
  const [hasScanned, setHasScanned] = useState(false);

  // Detection animation values
  const detectionScale = useSharedValue(0);
  const detectionOpacity = useSharedValue(0);
  const detectionColor = useSharedValue(0); // 0 = accent, 1 = green

  const scannedRef = useRef(false);

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!isActive || scannedRef.current) return;
      scannedRef.current = true;

      // Snap detection indicator to QR position with spring
      detectionScale.value = withSpring(1, { stiffness: 200, damping: 20 });
      detectionOpacity.value = withSpring(1, { stiffness: 200, damping: 20 });

      // After a brief moment, turn green to indicate validation
      setTimeout(() => {
        detectionColor.value = withSpring(1, { stiffness: 200, damping: 20 });
      }, 200);

      // Call onDetected after animation completes
      setTimeout(() => {
        onDetected(result.data);
      }, 600);
    },
    [isActive, onDetected, detectionScale, detectionOpacity, detectionColor]
  );

  const detectionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: detectionScale.value }],
    opacity: detectionOpacity.value,
    borderColor:
      detectionColor.value > 0.5 ? "#22C55E" : "#6366F1",
    backgroundColor:
      detectionColor.value > 0.5
        ? "rgba(34,197,94,0.15)"
        : "rgba(99,102,241,0.15)",
  }));

  // Reset scanner state when reactivated
  React.useEffect(() => {
    if (isActive) {
      scannedRef.current = false;
      setHasScanned(false);
      detectionScale.value = 0;
      detectionOpacity.value = 0;
      detectionColor.value = 0;
    }
  }, [isActive, detectionScale, detectionOpacity, detectionColor]);

  return (
    <View style={styles.container}>
      {isActive && (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={handleBarCodeScanned}
        >
          {/* Targeting reticle overlay */}
          <TargetingReticle size={250} accentColor="#6366F1" />

          {/* Detection bounding box */}
          <Animated.View style={[styles.detectionBox, detectionStyle]} />

          {/* Scan line sweep effect */}
          <View style={styles.sweepContainer}>
            <View style={styles.sweepLine} />
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  detectionBox: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 260,
    height: 260,
    marginLeft: -130,
    marginTop: -130,
    borderWidth: 2,
    borderRadius: 16,
  },
  sweepContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 240,
    marginLeft: -120,
    marginTop: -130,
    alignItems: "center",
  },
  sweepLine: {
    width: "100%",
    height: 2,
    backgroundColor: "rgba(99,102,241,0.6)",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
});
