// ─── (tabs)/notifications.tsx ───
// Notification feed: team invites + AI scheduling confirmations.
// Cards with type icon, message, timestamp.
// Invite cards: slide-up accept/decline sheet.
// AI confirmation cards: tap to open created event.
// Pull-to-refresh. Empty state.
// ─── Complexity: 🟡 Medium ───

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import type { ApiError } from "@novacal/shared/types";

// ─── Types ───

type NotificationType = "invite" | "ai_confirm";

type NotificationItem = {
  id: string;
  type: NotificationType;
  /** Primary message displayed in the card. */
  message: string;
  /** ISO timestamp of when this notification was created. */
  createdAt: string;
  /** Whether the notification has been read. */
  isRead: boolean;
  /** For invites: the workspace name being joined. */
  workspaceName?: string;
  /** For AI confirmations: the event ID that was created. */
  eventId?: string;
  /** For invites: pending / accepted / declined. */
  inviteStatus?: "pending" | "accepted" | "declined";
};

// ─── Mock Data (placeholder — replaced by API in production) ───

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    type: "invite",
    message: "You've been invited to join the Engineering team.",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    isRead: false,
    workspaceName: "Engineering",
    inviteStatus: "pending",
  },
  {
    id: "n2",
    type: "ai_confirm",
    message: "AI scheduled 'Sprint Review' for tomorrow at 10:00 AM.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    isRead: false,
    eventId: "evt-123",
  },
  {
    id: "n3",
    type: "invite",
    message: "You've been invited to join the Design team.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isRead: true,
    workspaceName: "Design",
    inviteStatus: "pending",
  },
];

// ─── Helpers ───

/**
 * Returns a human-readable relative timestamp.
 */
function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/** Icon name mapping per type (Ionicons). */
const TYPE_ICON: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  invite: "people-outline",
  ai_confirm: "sparkles-outline",
};

/** Icon color per type. */
const TYPE_COLOR: Record<NotificationType, string> = {
  invite: "#6366F1", // Electric Indigo
  ai_confirm: "#22C55E", // green-500
};

// ─── Component ───

/**
 * Notifications tab screen. Shows a feed of team invites and AI scheduling
 * confirmations. Supports accept/decline for invites and tap-to-open for
 * AI-confirmed events.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch notifications ───
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      // In production:
      //   GET /api/v1/notifications
      //   Headers: { Authorization: `Bearer ${token}` }

      // Placeholder — use mock data for now
      setNotifications(MOCK_NOTIFICATIONS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchNotifications(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─── Invite Actions ───
  const handleAcceptInvite = (item: NotificationItem) => {
    impactAsync(ImpactFeedbackStyle.Light);

    // In production: POST /api/v1/workspaces/{workspaceName}/accept
    Alert.alert(
      "Accept Invite",
      `Join the ${item.workspaceName ?? "workspace"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: () => {
            // Optimistic update
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === item.id ? { ...n, inviteStatus: "accepted" as const } : n
              )
            );
            impactAsync(ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const handleDeclineInvite = (item: NotificationItem) => {
    impactAsync(ImpactFeedbackStyle.Light);

    Alert.alert(
      "Decline Invite",
      `Decline the invitation to ${item.workspaceName ?? "workspace"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === item.id ? { ...n, inviteStatus: "declined" as const } : n
              )
            );
          },
        },
      ]
    );
  };

  // ─── AI Confirm Action ───
  const handleOpenEvent = (item: NotificationItem) => {
    impactAsync(ImpactFeedbackStyle.Light);
    // Navigate to event detail modal
    // router.push(`/event/${item.eventId}`);
  };

  // ─── Render Notification Card ───
  const renderNotification = useCallback(
    ({ item }: ListRenderItemInfo<NotificationItem>) => {
      const isInvite = item.type === "invite";
      const isAiConfirm = item.type === "ai_confirm";
      const hasAction = isInvite && item.inviteStatus === "pending";
      const isHandled = isInvite && item.inviteStatus !== "pending";

      return (
        <TouchableOpacity
          style={[
            styles.card,
            !item.isRead && styles.unreadCard,
          ]}
          onPress={() => {
            if (isAiConfirm) handleOpenEvent(item);
          }}
          activeOpacity={isAiConfirm ? 0.7 : 1}
        >
          {/* Type icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${TYPE_COLOR[item.type]}20` },
            ]}
          >
            <Ionicons
              name={TYPE_ICON[item.type]}
              size={20}
              color={TYPE_COLOR[item.type]}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.message} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={styles.timestamp}>{timeAgo(item.createdAt)}</Text>

            {/* Invite actions */}
            {hasAction && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptInvite(item)}
                >
                  <Ionicons name="checkmark" size={16} color="#22C55E" />
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => handleDeclineInvite(item)}
                >
                  <Ionicons name="close" size={16} color="#EF4444" />
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Handled state */}
            {isHandled && (
              <View style={styles.handledRow}>
                <Text style={styles.handledText}>
                  {item.inviteStatus === "accepted" ? "✓ Accepted" : "✕ Declined"}
                </Text>
              </View>
            )}
          </View>

          {/* Unread indicator */}
          {!item.isRead && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      );
    },
    []
  );

  const keyExtractor = useCallback((item: NotificationItem) => item.id, []);

  // ─── Render: Loading ───
  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  // ─── Render: Error ───
  if (error && notifications.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Could not load notifications</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text
          style={styles.retryLink}
          onPress={() => fetchNotifications()}
        >
          Tap to retry
        </Text>
      </View>
    );
  }

  // ─── Render: Empty State ───
  if (!isLoading && notifications.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.15)" />
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptySubtitle}>
          No new notifications.
        </Text>
      </View>
    );
  }

  // ─── Render: List ───
  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      />
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
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
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    fontFamily: "Inter",
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Inter",
    fontStyle: "italic",
  },
  // ─── Notification Card ───
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#121214", // Depth 2
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    position: "relative",
  },
  unreadCard: {
    borderColor: "rgba(99,102,241,0.3)",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    fontFamily: "Inter",
    lineHeight: 20,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: "#52525B", // zinc-600
    fontFamily: "Inter",
  },
  // ─── Invite Actions ───
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  acceptText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22C55E",
    fontFamily: "Inter",
  },
  declineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  declineText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#EF4444",
    fontFamily: "Inter",
  },
  handledRow: {
    marginTop: 8,
  },
  handledText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#52525B",
    fontFamily: "Inter",
  },
  // ─── Unread Dot ───
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    position: "absolute",
    top: 12,
    right: 12,
  },
});
