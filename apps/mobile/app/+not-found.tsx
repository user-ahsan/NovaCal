// ─── Not Found Screen ───
// Fallback for broken deep links. "Screen not found." + "Go Home" button.
// ─── Complexity: 🟢 Low ───

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

/**
 * Fallback screen for broken or unrecognised deep links.
 * Shows a clean "Screen not found." message with a "Go Home" button
 * that navigates to the main calendar tab.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  const handleGoHome = () => {
    router.replace("/(tabs)/calendar");
  };

  return (
    <View style={styles.container}>
      {/* Status code */}
      <Text style={styles.code}>404</Text>

      {/* Message */}
      <Text style={styles.message}>Screen not found.</Text>
      <Text style={styles.hint}>
        The link you followed may be broken or the page has been removed.
      </Text>

      {/* Navigation */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleGoHome}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000", // OLED black
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  code: {
    fontSize: 72,
    fontWeight: "800",
    color: "#6366F1", // Electric Indigo accent
    fontFamily: "Inter",
    marginBottom: 8,
  },
  message: {
    fontSize: 22,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
    textAlign: "center",
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    fontWeight: "400",
    color: "#A1A1AA", // zinc-400
    fontFamily: "Inter",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  button: {
    backgroundColor: "#6366F1", // Electric Indigo
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 160,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
});
