// ─── Scanner Screen (QR Bridge) ───
// CameraScanner with TargetingReticle overlay.
// On QR detect: neon snap + green. ApprovalBottomSheet: "Approve Login?"
// On approve: POST to {instanceUrl}/api/auth/qr/approve. Navigates to tabs.
// ─── Complexity: 🟡 Medium ───

import React, { useState, useCallback, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import CameraScanner from "../../components/CameraScanner";
import ApprovalBottomSheet from "../../components/ApprovalBottomSheet";

/**
 * QR Bridge scanner screen.
 *
 * Flow (per docs/06-design-specification.md §3B):
 * 1. Camera opens — darkened overlay with glowing brackets
 * 2. QR detected — CameraScanner shows neon bounding box → turns green
 * 3. ApprovalBottomSheet slides up: "Approve Login for this browser?"
 * 4. User taps Approve → double-pulse haptic → POST to QR approve endpoint
 * 5. On success: stores token if returned, navigates to tabs
 *
 * If no instance URL is found in SecureStore, shows an error message
 * instructing the user to go back to the Connect screen.
 */
export default function ScannerScreen() {
  const router = useRouter();
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Load instance URL on mount
  useEffect(() => {
    SecureStore.getItemAsync("instanceUrl")
      .then((url) => {
        if (url) {
          setInstanceUrl(url);
        } else {
          setError(
            "No instance URL configured. Go back to the Connect screen."
          );
        }
      })
      .finally(() => {
        setUrlLoaded(true);
      });
  }, []);

  /**
   * Called by CameraScanner when a valid QR code is detected.
   * Stores the scanned data and shows the approval bottom sheet.
   */
  const handleDetected = useCallback((data: string) => {
    setScannedData(data);
    setShowApproval(true);
  }, []);

  /**
   * Called when user taps "Approve" on the bottom sheet.
   * POSTs the QR challenge to the server for verification.
   */
  const handleApprove = useCallback(async () => {
    if (!instanceUrl || !scannedData || processing) return;
    setProcessing(true);
    setShowApproval(false);

    try {
      // Parse QR data — it may be JSON { challenge: "uuid" } or a plain string
      let challengeId: string;
      try {
        const parsed = JSON.parse(scannedData);
        challengeId = parsed.challenge || parsed.id || scannedData;
      } catch {
        challengeId = scannedData;
      }

      const response = await fetch(
        `${instanceUrl}/api/auth/qr/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge: challengeId }),
        }
      );

      if (!response.ok) {
        throw new Error(`QR approval failed (${response.status}).`);
      }

      const data = await response.json();

      // Extract session token from response (supports multiple shapes)
      const token =
        data.token ||
        data.session?.token ||
        data.sessionToken ||
        data.accessToken;

      if (token) {
        await SecureStore.setItemAsync("sessionToken", token);
      }

      // Navigate to main tabs
      router.replace("/(tabs)/calendar");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete QR login."
      );
    } finally {
      setProcessing(false);
    }
  }, [instanceUrl, scannedData, processing, router]);

  /**
   * Called when user dismisses the approval bottom sheet.
   * Resets scanner state so they can scan again.
   */
  const handleDismiss = useCallback(() => {
    setShowApproval(false);
    setScannedData(null);
  }, []);

  // Show nothing while loading instance URL
  if (!urlLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Initialising...</Text>
        </View>
      </View>
    );
  }

  // Error state (no instance URL or approval failed)
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header bar ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>QR Login</Text>
        <Text style={styles.headerSubtitle}>
          Scan the QR code on your browser
        </Text>
      </View>

      {/* ── Camera scanner with targeting reticle ── */}
      <CameraScanner
        onDetected={handleDetected}
        isActive={!showApproval && !processing}
      />

      {/* ── Approval bottom sheet (slides up on QR detect) ── */}
      <ApprovalBottomSheet
        visible={showApproval}
        onApprove={handleApprove}
        onDismiss={handleDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000", // OLED black — Depth 0
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 15,
    color: "#A1A1AA",
    fontFamily: "Inter",
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
    color: "#EF4444", // red-500
    fontFamily: "Inter",
    textAlign: "center",
    lineHeight: 20,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    textAlign: "center",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "#A1A1AA", // zinc-400
    fontFamily: "Inter",
    textAlign: "center",
  },
});
