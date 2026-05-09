// ─── ApprovalBottomSheet ───
// Slides up from bottom on QR detection.
// withSpring from bottom edge. Background dims with expo-blur.
// Drag handle at top (═). "Approve Login for this browser?" prompt with Approve button.
// ─── Complexity: 🟡 Medium ───

import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { ImpactFeedbackStyle, impactAsync } from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  PanGestureHandler,
  type PanGestureHandlerGestureEvent,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

type ApprovalBottomSheetProps = {
  /** Whether the bottom sheet is visible. */
  visible: boolean;
  /** Called when the user approves the login. */
  onApprove: () => void;
  /** Called when the user dismisses the sheet without approving. */
  onDismiss: () => void;
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = 220;

/**
 * Approval bottom sheet that slides up from the bottom edge when a QR code is detected.
 * Includes a drag handle, expo-blur background, and approve/dismiss actions.
 * Triggers double-pulse haptic on approval.
 */
export default function ApprovalBottomSheet({
  visible,
  onApprove,
  onDismiss,
}: ApprovalBottomSheetProps) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Slide up from bottom edge
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 200,
        mass: 0.8,
      });
      backdropOpacity.value = withSpring(0.6, { damping: 20, stiffness: 200 });
    } else {
      // Slide back down
      translateY.value = withSpring(SHEET_HEIGHT, {
        damping: 20,
        stiffness: 200,
      });
      backdropOpacity.value = withSpring(0, { damping: 20, stiffness: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleApprove = () => {
    // Double-pulse haptic on approval (per design spec)
    impactAsync(ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      impactAsync(ImpactFeedbackStyle.Medium);
    }, 100);

    // Slide down then call onApprove
    translateY.value = withSpring(SHEET_HEIGHT, { damping: 20, stiffness: 200 }, () => {
      runOnJS(onApprove)();
    });
  };

  const handleDismiss = () => {
    translateY.value = withSpring(SHEET_HEIGHT, { damping: 20, stiffness: 200 }, () => {
      runOnJS(onDismiss)();
    });
  };

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    translateY.value = Math.max(0, event.nativeEvent.translationY);
  };

  const onGestureEnd = () => {
    // If dragged more than 40% of sheet height, dismiss
    if (translateY.value > SHEET_HEIGHT * 0.4) {
      handleDismiss();
    } else {
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    }
  };

  if (!visible) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <View style={styles.wrapper} pointerEvents="box-none">
        {/* Blurred backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* Tappable backdrop to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        {/* Bottom sheet */}
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onEnded={onGestureEnd}
          activateAfterLongPress={0}
        >
          <Animated.View style={[styles.sheet, sheetStyle]}>
            {/* Drag handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.icon}>🔐</Text>
              <Text style={styles.title}>Approve Login</Text>
              <Text style={styles.subtitle}>
                Approve Login for this browser?
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleDismiss}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={handleApprove}
                >
                  <Text style={styles.approveText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#18181B", // Depth 3
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Safe area bottom
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#A1A1AA", // zinc-400
    fontFamily: "Inter",
    textAlign: "center",
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#09090B", // Depth 1
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  approveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#6366F1", // Electric Indigo
    alignItems: "center",
  },
  approveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
});
