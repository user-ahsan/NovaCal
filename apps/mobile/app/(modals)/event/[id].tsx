// ─── Event Detail Modal ───
// Read-only display of all event fields. Slide-up presentation.
// Bottom action bar: Edit, Delete (confirm dialog → soft delete), Add to Calendar (.ics).
// withSpring entry from bottom edge. Blur backdrop per design spec.
// ─── Complexity: 🟡 Medium ───

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Mock event data for development ───
// TODO: Replace with actual SQLite query or route param data
function getMockEvent(id: string) {
  return {
    id,
    title: "Sprint Review",
    description:
      "Review completed sprint items.\n\n## Agenda\n- Demo completed features\n- Discuss blockers\n- Plan next sprint",
    location: "Room 204 / Virtual",
    startTime: new Date(Date.now() + 3600000).toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(),
    isAllDay: false,
    timezone: "UTC",
    color: "#6366F1",
    calendar: "Work",
    workspace: "Engineering",
    attendees: [
      { id: "1", name: "Alice Chen", status: "ACCEPTED" },
      { id: "2", name: "Bob Martinez", status: "ACCEPTED" },
      { id: "3", name: "Carol Smith", status: "PENDING" },
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

type EventDetail = ReturnType<typeof getMockEvent>;

/**
 * Read-only event detail modal.
 * Displays all event fields. Bottom action bar for Edit, Delete, Add to Calendar.
 * Slides up from bottom edge with spring animation.
 */
export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ─── Load event data ───
  const event = useMemo(() => getMockEvent(id), [id]);

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

  // ─── Helpers ───
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  // ─── Dismiss ───
  const handleDismiss = useCallback(() => {
    slideUp.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 200 }, () => {
      runOnJS(router.back)();
    });
  }, [slideUp, router]);

  // ─── Edit ───
  const handleEdit = useCallback(() => {
    // Navigate to event edit screen (future: /event/[id]/edit)
    impactAsync(ImpactFeedbackStyle.Light);
    router.push(`/event/${id}/edit`);
  }, [router, id]);

  // ─── Delete (with confirm dialog) ───
  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete Event",
      'This will soft-delete the event. Others in this workspace will no longer see it.',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // ─── Soft delete: set deletedAt, queue sync DELETE ───
              // TODO: Replace with actual SQLite update + sync queue
              // await localDb.events.update(id, { deletedAt: new Date().toISOString() });
              // await syncQueue.enqueue({ method: "DELETE", path: `/api/v1/events/${id}` });

              impactAsync(ImpactFeedbackStyle.Medium);
              handleDismiss();
            } catch {
              Alert.alert("Error", "Failed to delete event.");
            }
          },
        },
      ]
    );
  }, [id, handleDismiss]);

  // ─── Add to Calendar (.ics) ───
  const handleAddToCalendar = useCallback(async () => {
    try {
      // Generate ICS content
      const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//NovaCal//EN",
        "BEGIN:VEVENT",
        `UID:${event.id}@novacal`,
        `DTSTART:${new Date(event.startTime).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTEND:${new Date(event.endTime).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `SUMMARY:${event.title}`,
        event.location ? `LOCATION:${event.location}` : "",
        event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : "",
        "END:VEVENT",
        "END:VCALENDAR",
      ]
        .filter(Boolean)
        .join("\r\n");

      // Share as .ics file or plain text
      await Share.share({
        message: icsContent,
        title: `${event.title}.ics`,
      });
    } catch {
      Alert.alert("Error", "Could not generate calendar file.");
    }
  }, [event]);

  // ─── Attendee status color ───
  const attendeeStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "#22C55E";
      case "PENDING":
        return "#F59E0B";
      case "DECLINED":
        return "#EF4444";
      default:
        return "#52525B";
    }
  };

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

      {/* ─── Drag Handle ─── */}
      <TouchableOpacity style={styles.handleArea} onPress={handleDismiss} activeOpacity={1}>
        <View style={styles.handle} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Color Bar ─── */}
        <View style={[styles.colorBar, { backgroundColor: event.color }]} />

        {/* ─── Title ─── */}
        <Text style={styles.title}>{event.title}</Text>

        {/* ─── Calendar & Workspace Tags ─── */}
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{event.calendar}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{event.workspace}</Text>
          </View>
        </View>

        {/* ─── Date & Time ─── */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>{formatDate(event.startTime)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>⏰</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>
                {formatTime(event.startTime)} – {formatTime(event.endTime)}
              </Text>
              <Text style={styles.infoSub}>
                {formatDuration(event.startTime, event.endTime)} · {event.timezone}
              </Text>
            </View>
          </View>

          {!!event.location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{event.location}</Text>
              </View>
            </View>
          )}

          {event.isAllDay && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📆</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>All Day Event</Text>
              </View>
            </View>
          )}
        </View>

        {/* ─── Divider ─── */}
        <View style={styles.divider} />

        {/* ─── Description ─── */}
        {!!event.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>
        )}

        {/* ─── Attendees ─── */}
        {event.attendees.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Attendees ({event.attendees.length})
              </Text>
              {event.attendees.map((a) => (
                <View key={a.id} style={styles.attendeeRow}>
                  <View style={styles.attendeeAvatar}>
                    <Text style={styles.attendeeAvatarText}>
                      {a.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.attendeeInfo}>
                    <Text style={styles.attendeeName}>{a.name}</Text>
                    <Text
                      style={[
                        styles.attendeeStatus,
                        { color: attendeeStatusColor(a.status) },
                      ]}
                    >
                      {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: attendeeStatusColor(a.status) },
                    ]}
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {/* ─── Metadata ─── */}
        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.metaText}>
            Created {new Date(event.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.metaText}>
            Updated {new Date(event.updatedAt).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      {/* ─── Bottom Action Bar ─── */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
          <Text style={styles.actionIcon}>✏️</Text>
          <Text style={styles.actionLabel}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
          <Text style={styles.actionIcon}>🗑️</Text>
          <Text style={[styles.actionLabel, styles.destructiveLabel]}>Delete</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.addToCalendarButton]}
          onPress={handleAddToCalendar}
        >
          <Text style={styles.actionIcon}>📥</Text>
          <Text style={styles.actionLabel}>Add to Calendar</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: Platform.OS === "ios" ? 12 : 4,
  },
  // ─── Drag Handle ───
  handleArea: {
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#09090B",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  // ─── Scroll ───
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // ─── Color Bar ───
  colorBar: {
    height: 4,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 2,
  },
  // ─── Title ───
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  // ─── Tags ───
  tagRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  tag: {
    backgroundColor: "#121214",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  tagText: {
    fontSize: 12,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "600",
  },
  // ─── Sections ───
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 20,
  },
  // ─── Info Rows ───
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  infoIcon: {
    fontSize: 18,
    width: 28,
    marginRight: 12,
    textAlign: "center",
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontWeight: "600",
    lineHeight: 22,
  },
  infoSub: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
    marginTop: 2,
  },
  // ─── Description ───
  descriptionText: {
    fontSize: 15,
    color: "#D4D4D8",
    fontFamily: "Inter",
    lineHeight: 24,
  },
  // ─── Attendees ───
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  attendeeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#121214",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  attendeeAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontWeight: "600",
  },
  attendeeStatus: {
    fontSize: 12,
    fontFamily: "Inter",
    fontWeight: "500",
    marginTop: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  // ─── Metadata ───
  metaText: {
    fontSize: 12,
    color: "#52525B",
    fontFamily: "Inter",
    marginBottom: 2,
  },
  // ─── Bottom Action Bar ───
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    backgroundColor: "#09090B",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  actionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  actionLabel: {
    fontSize: 11,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "600",
  },
  destructiveLabel: {
    color: "#EF4444",
  },
  addToCalendarButton: {
    flex: 1.5,
  },
});
