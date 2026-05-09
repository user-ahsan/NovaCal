// ─── Firebase Cloud Messaging ───
// Push notification configuration for NovaCal mobile app.
// Manages FCM token lifecycle, notification routing, and permission requests.
// Per docs/09-master-technical-specification.md: FCM for meeting reminders,
// invite notifications, and AI confirmation alerts.
// ─── Complexity: 🟡 Medium ───

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { apiClient, STORAGE_KEYS } from "./api";

// ─── Constants ───

const STORAGE_KEYS_FCM = {
  FCM_TOKEN: "novacal_fcm_token",
  NOTIFICATION_PREFERENCES: "novacal_notification_prefs",
} as const;

// ─── Notification Types (from docs/08-user-flows-requirements.md) ───

export type NotificationType =
  | "event_reminder"
  | "team_invite"
  | "ai_confirmation";

export interface NovaCalNotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationPreferences {
  eventReminders: boolean;
  teamInvites: boolean;
  aiConfirmations: boolean;
  reminderTiming: "10min" | "30min" | "1hr" | "1day";
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  eventReminders: true,
  teamInvites: true,
  aiConfirmations: true,
  reminderTiming: "30min",
};

// ─── FCM Service ───

class FCMService {
  private fcmToken: string | null = null;

  /**
   * Request notification permissions and register for push notifications.
   * Returns the FCM token if successful, null otherwise.
   *
   * Flow:
   * 1. Request user permission via expo-notifications
   * 2. Get FCM token via expo-notifications.getDevicePushTokenAsync()
   * 3. Register token with NovaCal server
   * 4. Persist token locally
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Dynamically import expo-notifications to avoid crashes if not configured
      const Notifications = await import("expo-notifications");

      // ── Step 1: Request permission ──
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("FCM: Push notification permission not granted");
        return null;
      }

      // ── Step 2: Configure notification handler ──
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // ── Step 3: Get device push token ──
      // For Expo managed workflow, this returns an Expo push token.
      // For bare workflow with FCM configured, returns FCM token directly.
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;

      if (!token || typeof token !== "string") {
        console.warn("FCM: Failed to get device push token");
        return null;
      }

      this.fcmToken = token;

      // ── Step 4: Persist token locally ──
      await SecureStore.setItemAsync(STORAGE_KEYS_FCM.FCM_TOKEN, token);

      // ── Step 5: Register with server ──
      await this.registerTokenWithServer(token);

      // ── Step 6: Android channel configuration ──
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("event-reminders", {
          name: "Event Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 100, 50, 100],
          lightColor: "#6366F1",
          sound: "default",
        });

        await Notifications.setNotificationChannelAsync("team-invites", {
          name: "Team Invites",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 100, 200],
          lightColor: "#22C55E",
          sound: "default",
        });

        await Notifications.setNotificationChannelAsync("ai-confirmations", {
          name: "AI Confirmations",
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 100, 50, 100],
          lightColor: "#6366F1",
          sound: "default",
        });
      }

      return token;
    } catch (err) {
      console.warn("FCM: Registration failed:", err);
      return null;
    }
  }

  /**
   * Register the FCM token with the NovaCal server.
   * Endpoint: POST /api/notifications/register (or similar).
   * Silently fails if server is unreachable — token will be sent on next sync.
   */
  private async registerTokenWithServer(token: string): Promise<void> {
    try {
      await fetch(
        `${await this.getBaseUrl()}/api/notifications/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await this.getAuthToken()}`,
          },
          body: JSON.stringify({
            token,
            platform: Platform.OS,
            deviceName: Platform.select({
              ios: "iOS Device",
              android: "Android Device",
              default: "Unknown",
            }),
          }),
        }
      );
    } catch {
      // Non-critical — will retry on next app launch or sync
      console.warn("FCM: Server registration deferred");
    }
  }

  private async getBaseUrl(): Promise<string> {
    try {
      return (await SecureStore.getItemAsync(STORAGE_KEYS.INSTANCE_URL)) || "";
    } catch {
      return "";
    }
  }

  private async getAuthToken(): Promise<string> {
    try {
      return (await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN)) || "";
    } catch {
      return "";
    }
  }

  /**
   * Handle an incoming push notification.
   * Routes to the correct screen based on notification type.
   *
   * @param notification - The expo-notifications Notification object
   * @returns The route path to navigate to, or null if no navigation needed
   */
  async handleNotification(notification: {
    request: {
      content: {
        data?: Record<string, unknown>;
        title?: string;
        body?: string;
      };
    };
  }): Promise<string | null> {
    const data = notification.request.content.data || {};
    const type = (data.type as NotificationType) || "event_reminder";

    switch (type) {
      case "event_reminder": {
        // Navigate to the event detail screen
        const eventId = data.eventId as string;
        if (eventId) {
          return `/(modals)/event/${eventId}`;
        }
        return "/(tabs)/calendar";
      }

      case "team_invite": {
        // Navigate to notifications tab to show/accept invite
        const workspaceId = data.workspaceId as string;
        if (workspaceId) {
          return `/(tabs)/notifications?workspaceId=${workspaceId}`;
        }
        return "/(tabs)/notifications";
      }

      case "ai_confirmation": {
        // Navigate to the created event or notifications
        const eventId = data.eventId as string;
        if (eventId) {
          return `/(modals)/event/${eventId}`;
        }
        return "/(tabs)/notifications";
      }

      default:
        return null;
    }
  }

  /**
   * Get a human-readable message for a notification type.
   * Used for displaying notification-related UI.
   */
  getNotificationDescription(type: NotificationType): string {
    switch (type) {
      case "event_reminder":
        return "Event reminders and upcoming meeting alerts";
      case "team_invite":
        return "Workspace invitations from team members";
      case "ai_confirmation":
        return "AI scheduling confirmations and updates";
    }
  }

  // ─── Preferences ───

  /**
   * Load notification preferences from secure storage.
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const stored = await SecureStore.getItemAsync(
        STORAGE_KEYS_FCM.NOTIFICATION_PREFERENCES
      );
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // Fall through to defaults
    }
    return { ...DEFAULT_PREFERENCES };
  }

  /**
   * Save notification preferences to secure storage.
   */
  async savePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    const current = await this.getPreferences();
    const updated = { ...current, ...prefs };
    await SecureStore.setItemAsync(
      STORAGE_KEYS_FCM.NOTIFICATION_PREFERENCES,
      JSON.stringify(updated)
    );
  }

  /**
   * Get the currently stored FCM token.
   */
  async getStoredToken(): Promise<string | null> {
    if (this.fcmToken) return this.fcmToken;
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS_FCM.FCM_TOKEN);
    } catch {
      return null;
    }
  }

  /**
   * Clear the FCM token (used on logout).
   */
  async clearToken(): Promise<void> {
    this.fcmToken = null;
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS_FCM.FCM_TOKEN);
    } catch {
      // Silently fail
    }
  }

  /**
   * Schedule a local notification for testing or offline reminders.
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, string>,
    triggerSeconds?: number
  ): Promise<void> {
    try {
      const Notifications = await import("expo-notifications");

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: "default",
        },
        trigger: triggerSeconds
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds }
          : null,
      });
    } catch (err) {
      console.warn("FCM: Failed to schedule local notification:", err);
    }
  }

  /**
   * Cancel all scheduled local notifications.
   */
  async cancelAllScheduled(): Promise<void> {
    try {
      const Notifications = await import("expo-notifications");
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Silently fail
    }
  }
}

// Singleton
export const fcmService = new FCMService();
