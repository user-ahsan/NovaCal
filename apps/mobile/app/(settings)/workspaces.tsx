// ─── Settings: Workspaces ───
// List of workspaces the user belongs to. Current workspace highlighted.
// Tap → sets active workspace context, triggers haptic, navigates back.
// ─── Complexity: 🟢 Low ───

import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

// ─── Mock data — replaced with real API fetch ───
type Workspace = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" | "FREE_BUSY";
};

const MOCK_WORKSPACES: Workspace[] = [
  { id: "ws-1", name: "Personal", slug: "personal", memberCount: 1, role: "OWNER" },
  { id: "ws-2", name: "Acme Corp", slug: "acme-corp", memberCount: 12, role: "ADMIN" },
  { id: "ws-3", name: "Side Project", slug: "side-proj", memberCount: 3, role: "EDITOR" },
];

const ACTIVE_WORKSPACE_ID = "ws-2"; // in production, from global context

const ROLE_BADGE_COLORS: Record<Workspace["role"], string> = {
  OWNER: "#6366F1",
  ADMIN: "#22C55E",
  EDITOR: "#F59E0B",
  VIEWER: "#A1A1AA",
  FREE_BUSY: "#52525B",
};

export default function WorkspacesSettingsScreen() {
  const router = useRouter();
  const [workspaces] = useState<Workspace[]>(MOCK_WORKSPACES);
  const [activeId, setActiveId] = useState(ACTIVE_WORKSPACE_ID);

  const handleSelect = useCallback(
    (ws: Workspace) => {
      if (ws.id === activeId) {
        router.back();
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // In production: dispatch to workspace context provider
      setActiveId(ws.id);

      Alert.alert(
        "Workspace Switched",
        `Active context is now "${ws.name}".`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    },
    [activeId, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Workspace }) => {
      const isActive = item.id === activeId;

      return (
        <TouchableOpacity
          style={[styles.row, isActive && styles.rowActive]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          {/* Accent indicator */}
          {isActive && <View style={styles.activeIndicator} />}

          {/* Icon */}
          <View style={[styles.iconCircle, { borderColor: ROLE_BADGE_COLORS[item.role] }]}>
            <Text style={styles.iconLetter}>{item.name[0].toUpperCase()}</Text>
          </View>

          {/* Details */}
          <View style={styles.details}>
            <Text style={[styles.name, isActive && styles.nameActive]}>
              {item.name}
            </Text>
            <Text style={styles.meta}>
              {item.memberCount} member{item.memberCount !== 1 ? "s" : ""}
              {"  ·  "}
              {item.role.replace("_", " ")}
            </Text>
          </View>

          {/* Role badge */}
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: ROLE_BADGE_COLORS[item.role] + "20" },
            ]}
          >
            <Text
              style={[styles.roleText, { color: ROLE_BADGE_COLORS[item.role] }]}
            >
              {item.role === "FREE_BUSY" ? "F/B" : item.role.slice(0, 1)}
            </Text>
          </View>

          {/* Checkmark for active */}
          {isActive && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      );
    },
    [activeId, handleSelect],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Workspaces",
          headerLargeTitle: true,
        }}
      />

      <View style={styles.container}>
        <Text style={styles.sectionHint}>
          Tap a workspace to set it as your active context. Your calendar and events
          will reflect the selected workspace.
        </Text>

        <FlatList
          data={workspaces}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
  },
  sectionHint: {
    fontSize: 13,
    color: "#52525B",
    lineHeight: 18,
    marginBottom: 20,
    marginTop: 8,
    fontFamily: "Inter",
  },
  list: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    position: "relative",
    overflow: "hidden",
  },
  rowActive: {
    borderColor: "#6366F1",
    borderWidth: 1,
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#6366F1",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconLetter: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },
  nameActive: {
    color: "#6366F1",
  },
  meta: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 2,
    fontFamily: "Inter",
    textTransform: "capitalize",
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  checkmark: {
    fontSize: 16,
    color: "#6366F1",
    fontWeight: "700",
  },
});
