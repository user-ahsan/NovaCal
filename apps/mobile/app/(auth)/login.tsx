// ─── Login Screen ───
// Email/password form. POSTs to {instanceUrl}/api/auth/login.
// Stores session token in SecureStore. Navigates to tabs on success.
// Error state for invalid credentials.
// ─── Complexity: 🟡 Medium ───

import React, { useState, useCallback, useEffect } from "react";
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

/**
 * Login screen — email/password authentication against the user's instance.
 *
 * Flow:
 * 1. Loads instanceUrl from SecureStore (redirects to /connect if missing)
 * 2. User enters email + password
 * 3. POSTs to {instanceUrl}/api/auth/login
 * 4. On success: stores token in SecureStore, navigates to tabs
 * 5. On 401: shows "Invalid email or password"
 * 6. On network error: shows descriptive failure message
 */
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);
  const [urlLoaded, setUrlLoaded] = useState(false);

  // Load instance URL from SecureStore on mount
  useEffect(() => {
    SecureStore.getItemAsync("instanceUrl")
      .then((url) => {
        if (url) {
          setInstanceUrl(url);
        } else {
          // No instance URL → go back to connect screen
          router.replace("/(auth)/connect");
        }
      })
      .finally(() => {
        setUrlLoaded(true);
      });
  }, [router]);

  /**
   * POSTs credentials to the instance auth endpoint.
   * Expects { token: "..." } or { session: { token: "..." } } response.
   */
  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setErrorMessage("Please enter email and password.");
      return;
    }

    if (!instanceUrl) {
      setErrorMessage("No instance URL configured.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${instanceUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid email or password.");
        }
        throw new Error(`Login failed (${response.status}).`);
      }

      const data = await response.json();

      // Extract session token — supports multiple response shapes
      const token =
        data.token ||
        data.session?.token ||
        data.sessionToken ||
        data.accessToken;

      if (!token) {
        throw new Error("No session token received from server.");
      }

      // Persist session token in SecureStore
      await SecureStore.setItemAsync("sessionToken", token);

      // Navigate to main tabs on success
      router.replace("/(tabs)/calendar");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Login failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [email, password, instanceUrl, router]);

  // Show nothing while loading instance URL (avoids flash)
  if (!urlLoaded) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        {/* ── Header ── */}
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>
          Sign in to your NovaCal instance
        </Text>

        {/* ── Instance URL badge (read-only reference) ── */}
        {instanceUrl && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{instanceUrl}</Text>
          </View>
        )}

        {/* ── Email field ── */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#52525B" // zinc-600
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!loading}
            returnKeyType="next"
          />
        </View>

        {/* ── Password field ── */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#52525B" // zinc-600
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            editable={!loading}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
        </View>

        {/* ── Error message ── */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* ── Login button ── */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        {/* ── QR fallback navigation ── */}
        <TouchableOpacity
          style={styles.qrLink}
          onPress={() => router.push("/(auth)/scanner")}
          activeOpacity={0.7}
        >
          <Text style={styles.qrLinkText}>Scan QR Code Instead</Text>
        </TouchableOpacity>
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
    fontSize: 28,
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
    marginBottom: 24,
  },
  badge: {
    backgroundColor: "#09090B", // Depth 1
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "center",
    marginBottom: 32,
  },
  badgeText: {
    fontSize: 12,
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
  errorContainer: {
    backgroundColor: "rgba(239,68,68,0.1)", // red-500 @ 10%
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#EF4444", // red-500
    fontFamily: "Inter",
    textAlign: "center",
  },
  button: {
    backgroundColor: "#6366F1", // Electric Indigo
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginBottom: 16,
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
  qrLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  qrLinkText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6366F1", // Electric Indigo
    fontFamily: "Inter",
  },
});
