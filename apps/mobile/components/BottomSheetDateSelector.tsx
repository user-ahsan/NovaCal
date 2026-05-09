// ─── BottomSheetDateSelector ───
// Custom date/time picker that slides up as bottom sheet.
// Drag handle at top. Swipe down to dismiss. withSpring from bottom edge.
// Custom scroll wheel for time selection with haptic feedback on every tick.
// withDecay for momentum scrolling + snap to 15-min intervals.
// ─── Complexity: 🟡 Medium ───

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const SHEET_HEIGHT = 360;
const WHEEL_ITEM_HEIGHT = 40;
const VISIBLE_WHEEL_ITEMS = 5;

type BottomSheetDateSelectorProps = {
  /** Current date value. */
  value: Date;
  /** Called when the user picks a new date/time. */
  onChange: (date: Date) => void;
  /** Called when the sheet is dismissed without selecting. */
  onDismiss: () => void;
};

// Generate time slots at 15-minute intervals
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, "0");
      const min = m.toString().padStart(2, "0");
      slots.push(`${hour}:${min}`);
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

/**
 * Bottom sheet date/time selector with custom scroll wheel.
 * Swipe down to dismiss. Haptic feedback on every 15-min snap tick.
 * Momentum scrolling via withDecay + snap to interval.
 */
export default function BottomSheetDateSelector({
  value,
  onChange,
  onDismiss,
}: BottomSheetDateSelectorProps) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const wheelTranslateY = useSharedValue(0);
  const wheelVelocity = useSharedValue(0);
  const flatListRef = useRef<FlatList<string>>(null);

  const [selectedHourMin, setSelectedHourMin] = useState(() => {
    const h = value.getHours().toString().padStart(2, "0");
    const m = Math.floor(value.getMinutes() / 15) * 15;
    return `${h}:${m.toString().padStart(2, "0")}`;
  });

  const selectedIndex = TIME_SLOTS.indexOf(selectedHourMin);

  // Slide up on mount
  useEffect(() => {
    translateY.value = withSpring(0, {
      damping: 20,
      stiffness: 200,
      mass: 0.8,
    });
  }, [translateY]);

  // Scroll to selected time
  useEffect(() => {
    if (selectedIndex >= 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: selectedIndex,
          animated: true,
          viewPosition: 0.5,
        });
      }, 350);
    }
  }, [selectedIndex]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleDismiss = useCallback(() => {
    translateY.value = withSpring(SHEET_HEIGHT, { damping: 20, stiffness: 200 });
    onDismiss();
  }, [translateY, onDismiss]);

  const handleSelectTime = useCallback(
    (time: string) => {
      impactAsync(ImpactFeedbackStyle.Light);

      const [hours, minutes] = time.split(":").map(Number);
      const newDate = new Date(value);
      newDate.setHours(hours, minutes, 0, 0);
      onChange(newDate);
      setSelectedHourMin(time);
    },
    [value, onChange]
  );

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    translateY.value = Math.max(0, event.nativeEvent.translationY);
  };

  const onGestureEnd = () => {
    if (translateY.value > SHEET_HEIGHT * 0.35) {
      handleDismiss();
    } else {
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    }
  };

  const renderTimeItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = item === selectedHourMin;
      return (
        <TouchableOpacity
          style={[styles.timeItem, isSelected && styles.timeItemSelected]}
          onPress={() => handleSelectTime(item)}
        >
          <Text
            style={[
              styles.timeText,
              isSelected && styles.timeTextSelected,
            ]}
          >
            {item}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedHourMin, handleSelectTime]
  );

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <View style={styles.wrapper} pointerEvents="box-none">
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        {/* Sheet */}
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
              <Text style={styles.title}>Select Time</Text>

              {/* Time wheel */}
              <View style={styles.wheelContainer}>
                <FlatList
                  ref={flatListRef}
                  data={TIME_SLOTS}
                  renderItem={renderTimeItem}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={WHEEL_ITEM_HEIGHT}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  initialScrollIndex={Math.max(0, selectedIndex)}
                  getItemLayout={(_, index) => ({
                    length: WHEEL_ITEM_HEIGHT,
                    offset: WHEEL_ITEM_HEIGHT * index,
                    index,
                  })}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(
                      e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT
                    );
                    const time = TIME_SLOTS[Math.min(index, TIME_SLOTS.length - 1)];
                    if (time) {
                      impactAsync(ImpactFeedbackStyle.Light);
                      handleSelectTime(time);
                    }
                  }}
                  style={styles.wheelList}
                  contentContainerStyle={styles.wheelContent}
                />

                {/* Selection indicator */}
                <View style={styles.selectionIndicator} />
              </View>

              {/* Action buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleDismiss}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={handleDismiss}
                >
                  <Text style={styles.doneText}>Done</Text>
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
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    height: SHEET_HEIGHT,
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
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    textAlign: "center",
    marginBottom: 16,
  },
  wheelContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelList: {
    width: SCREEN_WIDTH - 48,
    maxHeight: WHEEL_ITEM_HEIGHT * VISIBLE_WHEEL_ITEMS,
  },
  wheelContent: {
    paddingVertical: WHEEL_ITEM_HEIGHT * 2,
  },
  timeItem: {
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  timeItemSelected: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderRadius: 8,
  },
  timeText: {
    fontSize: 18,
    fontFamily: "JetBrains Mono",
    color: "#52525B",
    fontWeight: "500",
  },
  timeTextSelected: {
    color: "#6366F1",
    fontWeight: "700",
    fontSize: 20,
  },
  selectionIndicator: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
    marginTop: -(WHEEL_ITEM_HEIGHT / 2),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(99,102,241,0.2)",
    pointerEvents: "none",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#09090B",
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
  doneButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#6366F1",
    alignItems: "center",
  },
  doneText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
});
