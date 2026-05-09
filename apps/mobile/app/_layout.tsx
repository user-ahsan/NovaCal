// ─── Root Layout ───
// SQLiteProvider (initializes local DB on mount).
// Toast container. Network status listener (NetInfo). Deep link handler. GestureHandlerRootView.
// ─── Complexity: 🔴 High ───

import React, { useEffect, useRef, useState, useCallback } from "react";
import { StyleSheet, View, Text } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import NetInfo from "@react-native-community/netinfo";
import * as Linking from "expo-linking";
import { openDatabaseAsync } from "expo-sqlite";

// ─── Global toast type ───
export type ToastMessage = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
};

// ─── Initialize local SQLite database (offline-first) ───
async function initializeDatabase(): Promise<void> {
  const db = await openDatabaseAsync("novacal.db");

  // Create local tables mirroring server schema for offline support.
  // Uses IF NOT EXISTS so re-runs are safe.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_events (
      id TEXT PRIMARY KEY,
      calendar_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      all_day INTEGER DEFAULT 0,
      recurrence_rule TEXT,
      timezone TEXT DEFAULT 'UTC',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      retry_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_local_events_sync
      ON local_events(updated_at);

    CREATE INDEX IF NOT EXISTS idx_local_events_time
      ON local_events(start_time, end_time);

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status
      ON sync_queue(status);
  `);
}

/**
 * Root layout wrapping the entire mobile app.
 *
 * Responsibilities:
 * - GestureHandlerRootView for gesture support (bottom sheets, drag, etc.)
 * - SQLite init on first mount (offline-first local cache)
 * - NetInfo listener to track online/offline state
 * - Deep link handler for universal links (e.g., event deep links)
 * - Global toast container (accessible via imperative ref or context)
 */
export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const dbInitRef = useRef(false);
  const toastIdRef = useRef(0);

  // ─── SQLite initialization on mount ───
  useEffect(() => {
    if (dbInitRef.current) return;
    dbInitRef.current = true;

    initializeDatabase()
      .then(() => {
        setIsDbReady(true);
      })
      .catch((err) => {
        console.error("Failed to initialize local DB:", err);
        // App can still function in online-only mode without local cache.
        setIsDbReady(true);
      });
  }, []);

  // ─── Network status listener ───
  // Triggers sync engine when transitioning from offline → online.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !isOnline;
      const nowOnline = state.isConnected ?? true;

      setIsOnline(nowOnline);

      if (wasOffline && nowOnline) {
        // Connection restored — trigger sync (stub for future sync engine)
        addToast("Connection restored", "success");
      }
    });

    return () => unsubscribe();
  }, [isOnline]);

  // ─── Deep link handler ───
  useEffect(() => {
    const handleDeepLink = (event: Linking.EventType) => {
      // Expo Router handles deep link routing automatically.
      // This listener enables any side-effects (logging, analytics, etc.)
      const url = event.url;
      if (url) {
        // Deep link received — Expo Router handles routing automatically
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => subscription.remove();
  }, []);

  // ─── Toast helpers ───
  const addToast = useCallback(
    (message: string, type: ToastMessage["type"] = "info") => {
      const id = String(++toastIdRef.current);
      const toast: ToastMessage = { id, message, type };
      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    []
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Auth group: connect, login, scanner */}
          <Stack.Screen name="(auth)" />

          {/* Main tabs: calendar, agenda, notifications, settings */}
          <Stack.Screen name="(tabs)" />

          {/* Full-screen modals: event creation, search */}
          <Stack.Screen
            name="(modals)"
            options={{ presentation: "modal" }}
          />

          {/* Settings pages */}
          <Stack.Screen name="(settings)" />
        </Stack>
      </View>

      {/* ─── Global toast container ─── */}
      {toasts.length > 0 && (
        <View style={styles.toastContainer} pointerEvents="none">
          {toasts.map((toast) => (
            <View
              key={toast.id}
              style={[
                styles.toast,
                toast.type === "error" && styles.toastError,
                toast.type === "success" && styles.toastSuccess,
              ]}
            >
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          ))}
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000", // OLED black — Depth 0
  },
  container: {
    flex: 1,
  },
  toastContainer: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    gap: 8,
  },
  toast: {
    backgroundColor: "#18181B", // Depth 3
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  toastError: {
    borderColor: "#EF4444", // red-500
  },
  toastSuccess: {
    borderColor: "#22C55E", // green-500
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter",
    fontWeight: "500",
  },
});
