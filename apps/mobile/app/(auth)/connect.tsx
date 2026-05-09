// ─── Connect Screen ───
// First screen. Single "Instance URL" input. "Connect" button validates
// reachability via GET /api/health. StatusDot grey→orange→green transition.
// Persists URL in SecureStore. Navigates to /login on success.
// ─── Complexity: 🟡 Medium ───

import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import StatusDot from "../../components/StatusDot";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Connect screen — the very first screen a user sees.
 *
 * Flow:
 * 1. User enters their self-hosted instance URL
 * 2. Taps "Connect" → StatusDot turns orange (connecting)
 * 3. Validates via GET {instanceUrl}/api/health
 * 4. On success: dot turns green, URL persisted in SecureStore,
 *    navigates to /login after a brief animation delay
 * 5. On failure: dot turns red with error message, resets after 2.5s
 */
export default function ConnectScreen() {
  const router = useRouter();
  const [instanceUrl, setInstanceUrl] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Validates and connects to the user's NovaCal instance.
   * Prepends https:// if no protocol is given. Strips trailing slash.
   */
  const handleConnect = useCallback(async () => {
    let url = instanceUrl.trim();
    if (!url) {
      setErrorMessage("Please enter an instance URL.");
      return;
    }

    // Prepend https:// if no protocol provided (common user error)
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    // Normalise: remove trailing slash
    url = url.replace(/\/+$/, "");

    setStatus("connecting");
    setErrorMessage(null);
    setLoading(true);

    try {
      // Validate reachability via health endpoint (per API contract §6)
      const response = await fetch(`${url}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Expect { status: "ok", postgres: ..., redis: ..., uptime: ..., version: ... }
      const data = await response.json();
      if (!data || data.status !== "ok") {
        throw new Error("Server is not reporting healthy status.");
      }

      // Connected — StatusDot transitions to green via withSpring
      setStatus("connected");
      setLoading(false);

      // Persist instance URL in SecureStore for subsequent screens
      await SecureStore.setItemAsync("instanceUrl", url);

      // Brief delay to let the StatusDot spring animation complete
      // before navigating to the login screen
      setTimeout(() => {
        router.push("/(auth)/login");
      }, 600);
    } catch (err) {
      setStatus("error");
      setLoading(false);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to connect to the instance.";
      setErrorMessage(message);

      // Reset back to disconnected after showing the error state
      setTimeout(() => {
        setStatus("disconnected");
      }, 2500);
    }
  }, [instanceUrl, router]);

  const handleUrlChange = useCallback((text: string) => {
    setInstanceUrl(text);
    // Reset status whenever user edits the URL
    setStatus("disconnected");
    setErrorMessage(null);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        {/* ── Brand header ── */}
        <Text style={styles.title}>NovaCal</Text>
        <Text style={styles.subtitle}>Enter Node Address</Text>

        {/* ── Connection status indicator ── */}
        <View style={styles.statusRow}>
          <StatusDot status={status} size={12} />
          <Text style={styles.statusLabel}>
            {status === "disconnected" && "Not Connected"}
            {status === "connecting" && "Connecting..."}
            {status === "connected" && "Connected"}
            {status === "error" && "Connection Failed"}
          </Text>
        </View>

        {/* ── Instance URL input ── */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="https://cal.yourdomain.com"
            placeholderTextColor="#52525B" // zinc-600
            value={instanceUrl}
            onChangeText={handleUrlChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            editable={!loading}
            returnKeyType="go"
            onSubmitEditing={handleConnect}
          />
        </View>

        {/* ── Error message ── */}
        {errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        {/* ── Connect button ── */}
        <TouchableOpacity
          style={[
            styles.button,
            (loading || status === "connected") && styles.buttonDisabled,
          ]}
          onPress={handleConnect}
          disabled={loading || status === "connected"}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>

        {/* ── Help text ── */}
        <Text style={styles.helpText}>
          Self-Hosted Root. Point the app to your personal NovaCal instance.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000", // OLED black — Depth 0
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: "#A1A1AA", // zinc-400
    fontFamily: "Inter",
    textAlign: "center",
    marginBottom: 32,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#A1A1AA",
    fontFamily: "Inter",
  },
  inputContainer: {
    backgroundColor: "#121214", // Depth 2
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 12,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: "400",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#EF4444", // red-500
    fontFamily: "Inter",
    textAlign: "center",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#6366F1", // Electric Indigo
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  helpText: {
    fontSize: 13,
    fontWeight: "400",
    color: "#52525B", // zinc-600
    fontFamily: "Inter",
    textAlign: "center",
    lineHeight: 18,
  },
});
