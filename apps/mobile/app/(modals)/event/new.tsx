// ─── Event Creation Modal ───
// Slide-up modal presentation. Form with title, date/time, duration, location, description.
// Workspace selector. Save button: optimistic local SQLite insert + sync queue POST.
// Double-pulse haptic on success. Uses withSpring for entry animation.
// ─── Complexity: 🟡 Medium ───

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import BottomSheetDateSelector from "../../../components/BottomSheetDateSelector";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Duration presets (in minutes) ───
const DURATION_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
  { label: "Custom", value: -1 },
];

type Workspace = {
  id: string;
  name: string;
};

/**
 * Event creation form modal.
 * Slides up from bottom on mount. Form fields for all event properties.
 * Save optimistically writes to local SQLite and queues a sync POST.
 */
export default function EventNewScreen() {
  const router = useRouter();

  // ─── Form State ───
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [duration, setDuration] = useState(60); // default 1h
  const [customDuration, setCustomDuration] = useState("");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Workspaces (mock — will come from SQLite context) ───
  const [workspaces] = useState<Workspace[]>([
    { id: "w-personal", name: "Personal" },
    { id: "w-work", name: "Work" },
  ]);

  // ─── Entry Animation ───
  const slideUp = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    slideUp.value = withSpring(0, {
      damping: 20,
      stiffness: 200,
      mass: 0.8,
    });
  }, [slideUp]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideUp.value }],
  }));

  // ─── Handlers ───
  const handleDismiss = useCallback(() => {
    slideUp.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 200 }, () => {
      runOnJS(router.back)();
    });
  }, [slideUp, router]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter an event title.");
      return;
    }

    setIsSaving(true);
    Keyboard.dismiss();

    const endTime = new Date(eventDate.getTime() + duration * 60000);
    const eventPayload = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      startTime: eventDate.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: false,
      timezone: "UTC",
      color: "#6366F1",
      workspaceId,
    };

    try {
      // ─── Optimistic local SQLite save ───
      // TODO: Replace with actual SQLite INSERT from offline-first engine
      // await localDb.events.insert(eventPayload);

      // ─── Queue sync POST to API ───
      // TODO: Replace with actual sync queue push
      // await syncQueue.enqueue({ method: "POST", path: "/api/v1/events", body: eventPayload });

      // ─── Double-pulse haptic on success (per design spec) ───
      impactAsync(ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        impactAsync(ImpactFeedbackStyle.Medium);
      }, 100);

      // Dismiss after brief pause to feel the haptic
      setTimeout(() => {
        handleDismiss();
      }, 300);
    } catch (err) {
      Alert.alert("Error", "Failed to save event. Please try again.");
      setIsSaving(false);
    }
  }, [title, eventDate, duration, location, description, workspaceId, handleDismiss]);

  const handleDateChange = useCallback((date: Date) => {
    setEventDate(date);
    setShowDatePicker(false);
  }, []);

  const handleDurationSelect = useCallback((opt: (typeof DURATION_OPTIONS)[number]) => {
    if (opt.value === -1) {
      setIsCustomDuration(true);
      setCustomDuration("");
    } else {
      setIsCustomDuration(false);
      setDuration(opt.value);
    }
  }, []);

  const endTime = new Date(eventDate.getTime() + duration * 60000);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "none",
        }}
      />

      {/* Backdrop blur */}
      <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDismiss} style={styles.headerButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Event</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.headerButton, styles.saveButton]}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Title ─── */}
          <TextInput
            style={styles.titleInput}
            placeholder="Event Title"
            placeholderTextColor="#52525B"
            value={title}
            onChangeText={setTitle}
            autoFocus={false}
            returnKeyType="next"
          />

          {/* ─── Date/Time Row ─── */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.fieldIcon}>📅</Text>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Date & Time</Text>
              <Text style={styles.fieldValue}>
                {eventDate.toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                {eventDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* ─── Duration ─── */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>⏱</Text>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.durationChips}>
                {DURATION_OPTIONS.map((opt) => {
                  const isActive =
                    opt.value === -1
                      ? isCustomDuration
                      : !isCustomDuration && duration === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.durationChip, isActive && styles.durationChipActive]}
                      onPress={() => handleDurationSelect(opt)}
                    >
                      <Text
                        style={[
                          styles.durationChipText,
                          isActive && styles.durationChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {isCustomDuration && (
                <View style={styles.customDurationRow}>
                  <TextInput
                    style={styles.customDurationInput}
                    placeholder="Minutes"
                    placeholderTextColor="#52525B"
                    keyboardType="number-pad"
                    value={customDuration}
                    onChangeText={(v) => {
                      setCustomDuration(v);
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n > 0) setDuration(n);
                    }}
                  />
                  <Text style={styles.customDurationUnit}>min</Text>
                </View>
              )}
            </View>
          </View>

          {/* ─── End Time (read-only preview) ─── */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>🔚</Text>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>End Time</Text>
              <Text style={styles.fieldValue}>
                {endTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>

          {/* ─── Location ─── */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>📍</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Location (optional)"
              placeholderTextColor="#52525B"
              value={location}
              onChangeText={setLocation}
              returnKeyType="next"
            />
          </View>

          {/* ─── Description (Markdown) ─── */}
          <View style={styles.descriptionContainer}>
            <View style={styles.descriptionHeader}>
              <Text style={styles.fieldLabel}>Description</Text>
              <Text style={styles.markdownHint}>Markdown supported</Text>
            </View>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Add description, notes, agenda..."
              placeholderTextColor="#52525B"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ─── Workspace Selector ─── */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>🏢</Text>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>Workspace</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.workspaceScroll}
              >
                {workspaces.map((ws) => {
                  const isActive = workspaceId === ws.id;
                  return (
                    <TouchableOpacity
                      key={ws.id}
                      style={[
                        styles.workspaceChip,
                        isActive && styles.workspaceChipActive,
                      ]}
                      onPress={() => setWorkspaceId(ws.id)}
                    >
                      <Text
                        style={[
                          styles.workspaceChipText,
                          isActive && styles.workspaceChipTextActive,
                        ]}
                      >
                        {ws.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Date Picker Bottom Sheet ─── */}
      {showDatePicker && (
        <BottomSheetDateSelector
          value={eventDate}
          onChange={handleDateChange}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: Platform.OS === "ios" ? 50 : 20,
  },
  flex: {
    flex: 1,
  },
  // ─── Header ───
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#09090B",
  },
  headerButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    textAlign: "center",
  },
  cancelText: {
    fontSize: 15,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "500",
  },
  saveButton: {
    alignItems: "flex-end",
  },
  saveText: {
    fontSize: 15,
    color: "#6366F1",
    fontFamily: "Inter",
    fontWeight: "700",
  },
  // ─── Scroll ───
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // ─── Title ───
  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#09090B",
  },
  // ─── Field Rows ───
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#09090B",
  },
  fieldIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 28,
    textAlign: "center",
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "500",
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontWeight: "600",
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontWeight: "500",
    paddingVertical: 0,
  },
  chevron: {
    fontSize: 22,
    color: "#52525B",
    marginLeft: 8,
    fontWeight: "300",
  },
  // ─── Duration Chips ───
  durationChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  durationChipActive: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderColor: "#6366F1",
  },
  durationChipText: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "JetBrains Mono",
    fontWeight: "600",
  },
  durationChipTextActive: {
    color: "#6366F1",
  },
  customDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  customDurationInput: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "JetBrains Mono",
    fontWeight: "600",
    backgroundColor: "#121214",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    minWidth: 80,
    textAlign: "center",
  },
  customDurationUnit: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  // ─── Description ───
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#09090B",
  },
  descriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  markdownHint: {
    fontSize: 11,
    color: "#52525B",
    fontFamily: "Inter",
    fontWeight: "500",
  },
  descriptionInput: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "Inter",
    minHeight: 120,
    backgroundColor: "#121214",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    lineHeight: 22,
  },
  // ─── Workspace Selector ───
  workspaceScroll: {
    marginTop: 4,
  },
  workspaceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginRight: 8,
  },
  workspaceChipActive: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderColor: "#6366F1",
  },
  workspaceChipText: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "600",
  },
  workspaceChipTextActive: {
    color: "#6366F1",
  },
});
