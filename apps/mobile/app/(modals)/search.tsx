// ─── Full-Screen Search Modal ───
// Search bar autofocuses on mount (keyboard visible). Results stream:
// local SQLite FTS first (instant) → server PG FTS fallback.
// SkeletonRow shimmer placeholder while loading. Tap result → opens event/[id].
// withSpring from top on mount animation (stiffness: 300).
// ─── Complexity: 🟡 Medium ───

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ───
type SearchResult = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  description: string | null;
  color: string | null;
  /** Which source produced this result. */
  source: "local" | "server";
};

// ─── Mock search implementation ───
// TODO: Replace with actual SQLite FTS query + API call to /api/v1/events/search
const MOCK_EVENTS: SearchResult[] = [
  {
    id: "1",
    title: "Sprint Review",
    startTime: new Date(Date.now() + 3600000).toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(),
    location: "Room 204",
    description: "Review sprint items and plan next sprint",
    color: "#6366F1",
    source: "local",
  },
  {
    id: "2",
    title: "Standup",
    startTime: new Date(Date.now() + 1800000).toISOString(),
    endTime: new Date(Date.now() + 2700000).toISOString(),
    location: "Virtual",
    description: "Daily team standup",
    color: "#22C55E",
    source: "local",
  },
  {
    id: "3",
    title: "Design Review",
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    location: "Design Lab",
    description: "Review new mockups and prototypes",
    color: "#F59E0B",
    source: "local",
  },
  {
    id: "4",
    title: "1:1 with Manager",
    startTime: new Date(Date.now() + 172800000).toISOString(),
    endTime: new Date(Date.now() + 172800000 + 1800000).toISOString(),
    location: null,
    description: "Weekly catch-up",
    color: "#EC4899",
    source: "local",
  },
];

// ─── Skeleton Row Component ───
function SkeletonRow() {
  const shimmerOpacity = useSharedValue(1);

  useEffect(() => {
    shimmerOpacity.value = withRepeat(
      withTiming(0.3, { duration: 800 }),
      -1, // infinite
      true // reverse
    );
  }, [shimmerOpacity]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.skeletonRow, shimmerStyle]}>
      <View style={styles.skeletonColorBar} />
      <View style={styles.skeletonContent}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonMeta} />
      </View>
    </Animated.View>
  );
}

// ─── Search Result Row ───
function SearchResultRow({
  item,
  onPress,
}: {
  item: SearchResult;
  onPress: (id: string) => void;
}) {
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => onPress(item.id)}
      activeOpacity={0.7}
    >
      {/* Color indicator */}
      <View style={[styles.resultColorBar, { backgroundColor: item.color || "#6366F1" }]} />

      <View style={styles.resultContent}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.title}
        </Text>

        <View style={styles.resultMeta}>
          <Text style={styles.resultTime}>
            {formatTime(item.startTime)} – {formatTime(item.endTime)}
          </Text>
          {!!item.location && (
            <>
              <Text style={styles.metaDivider}>·</Text>
              <Text style={styles.resultLocation} numberOfLines={1}>
                {item.location}
              </Text>
            </>
          )}
        </View>

        {!!item.description && (
          <Text style={styles.resultDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Source badge */}
        <View
          style={[
            styles.sourceBadge,
            item.source === "local" ? styles.sourceLocal : styles.sourceServer,
          ]}
        >
          <Text
            style={[
              styles.sourceBadgeText,
              item.source === "local" ? styles.sourceLocalText : styles.sourceServerText,
            ]}
          >
            {item.source === "local" ? "Local" : "Server"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Full-screen search overlay.
 * Search bar autofocuses on mount. Results from local SQLite FTS + server PG FTS fallback.
 * Skeleton shimmer while loading. Tap navigates to event/[id].
 */
export default function SearchScreen() {
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── State ───
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isServerSearching, setIsServerSearching] = useState(false);

  // ─── Entry Animation (spring from top) ───
  const translateY = useSharedValue(-300);

  useEffect(() => {
    // Spring down from top edge
    translateY.value = withSpring(0, {
      stiffness: 300,
      damping: 25,
      mass: 0.8,
    });

    // Autofocus keyboard on mount
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  }, [translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ─── Dismiss ───
  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, [router]);

  // ─── Search ───
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // ─── Phase 1: Local SQLite FTS (instant) ───
      // TODO: Replace with actual SQLite FTS query
      // const localResults = await localDb.events
      //   .where("fts")
      //   .matches(trimmed)
      //   .toArray();
      const localResults = MOCK_EVENTS.filter(
        (e) =>
          e.title.toLowerCase().includes(trimmed) ||
          (e.description && e.description.toLowerCase().includes(trimmed)) ||
          (e.location && e.location.toLowerCase().includes(trimmed))
      ).map((e) => ({ ...e, source: "local" as const }));

      setResults(localResults);

      // ─── Phase 2: Server PG FTS fallback ───
      // Run in parallel — if local results are sufficient, server results augment
      setIsServerSearching(true);
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`${instanceUrl}/api/v1/events/search?q=${encodeURIComponent(trimmed)}`);
        // const serverResults: SearchResult[] = await response.json();

        // Mock server delay
        await new Promise((resolve) => setTimeout(resolve, 600));

        // Merge server results (avoid duplicates by id)
        setResults((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const serverResults: SearchResult[] = MOCK_EVENTS.filter(
            (e) =>
              !existingIds.has(e.id) &&
              (e.title.toLowerCase().includes(trimmed) ||
                (e.description && e.description.toLowerCase().includes(trimmed)) ||
                (e.location && e.location.toLowerCase().includes(trimmed)))
          ).map((e) => ({ ...e, source: "server" as const }));

          return [...prev, ...serverResults];
        });
      } catch {
        // Server fallback is best-effort; don't surface errors to user
      } finally {
        setIsServerSearching(false);
      }
    } catch {
      // Local search error
    } finally {
      setIsSearching(false);
    }
  }, []);

  // ─── Debounced search ───
  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(text);
      }, 150); // 150ms debounce
    },
    [performSearch]
  );

  // ─── Tap result → open event detail ───
  const handleResultPress = useCallback(
    (eventId: string) => {
      Keyboard.dismiss();
      router.push(`/event/${eventId}`);
    },
    [router]
  );

  // ─── Cleanup debounce ───
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ─── Render helpers ───
  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <SearchResultRow item={item} onPress={handleResultPress} />
    ),
    [handleResultPress]
  );

  const renderSkeleton = useCallback(
    (_: unknown, index: number) => <SkeletonRow key={`skel-${index}`} />,
    []
  );

  const keyExtractor = useCallback((item: SearchResult) => item.id, []);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "none",
        }}
      />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor="#52525B"
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                setResults([]);
                setHasSearched(false);
                searchInputRef.current?.focus();
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleDismiss} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Results ─── */}
      {!hasSearched && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>Search Events</Text>
          <Text style={styles.emptySubtitle}>
            Type to search across all your events
          </Text>
        </View>
      )}

      {hasSearched && isSearching && results.length === 0 && (
        <FlatList
          data={[1, 2, 3, 4, 5]}
          renderItem={renderSkeleton}
          keyExtractor={(_, i) => `skeleton-${i}`}
          style={styles.resultList}
          contentContainerStyle={styles.resultListContent}
          scrollEnabled={false}
        />
      )}

      {hasSearched && !isSearching && results.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No Events Found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search term
          </Text>
        </View>
      )}

      {results.length > 0 && (
        <>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            style={styles.resultList}
            contentContainerStyle={styles.resultListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isServerSearching ? (
                <View style={styles.serverSearchingRow}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.serverSearchingText}>
                    Searching server for more results...
                  </Text>
                </View>
              ) : null
            }
          />
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: Platform.OS === "ios" ? 54 : 24,
  },
  // ─── Header ───
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    backgroundColor: "#09090B",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontWeight: "500",
    paddingVertical: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    fontSize: 11,
    color: "#A1A1AA",
    fontWeight: "700",
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 15,
    color: "#6366F1",
    fontFamily: "Inter",
    fontWeight: "600",
  },
  // ─── Empty State ───
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    fontFamily: "Inter",
    textAlign: "center",
    lineHeight: 20,
  },
  // ─── Results ───
  resultList: {
    flex: 1,
  },
  resultListContent: {
    paddingBottom: 40,
  },
  // ─── Result Row ───
  resultRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    backgroundColor: "#09090B",
  },
  resultColorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: "stretch",
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
    marginBottom: 3,
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  resultTime: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "JetBrains Mono",
    fontWeight: "500",
  },
  metaDivider: {
    fontSize: 13,
    color: "#52525B",
    marginHorizontal: 6,
    fontFamily: "Inter",
  },
  resultLocation: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "500",
    flexShrink: 1,
  },
  resultDescription: {
    fontSize: 13,
    color: "#52525B",
    fontFamily: "Inter",
    lineHeight: 18,
    marginBottom: 4,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  sourceLocal: {
    backgroundColor: "rgba(99,102,241,0.1)",
  },
  sourceServer: {
    backgroundColor: "rgba(34,197,94,0.1)",
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "JetBrains Mono",
  },
  sourceLocalText: {
    color: "#6366F1",
  },
  sourceServerText: {
    color: "#22C55E",
  },
  // ─── Skeleton ───
  skeletonRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    backgroundColor: "#09090B",
  },
  skeletonColorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
    backgroundColor: "rgba(99,102,241,0.2)",
    alignSelf: "stretch",
  },
  skeletonContent: {
    flex: 1,
    gap: 8,
  },
  skeletonTitle: {
    height: 16,
    width: "60%",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  skeletonMeta: {
    height: 12,
    width: "40%",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  // ─── Server Searching ───
  serverSearchingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  serverSearchingText: {
    fontSize: 13,
    color: "#A1A1AA",
    fontFamily: "Inter",
    fontWeight: "500",
  },
});
