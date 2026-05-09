"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Search Page
//
// Full-page PostgreSQL FTS search interface.
//   - Search bar autofocuses on mount.
//   - Results stream via GET /api/search?q=...
//   - Skeleton shimmer while loading.
//   - Keyboard navigation: ↑↓ to select, Enter to open.
//   - AnimatePresence for smooth result transitions.
//
// Source: docs/05-route-map-web-mobile.md §2 (Core Application)
//         docs/07-component-animation-guide.md §2 (Command Palette)
//         AGENTS.md Rule 66 (no spinners — skeletons only)
//         AGENTS.md Rule 67 (beautiful empty states)
// ═══════════════════════════════════════════════════════════════

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Calendar,
  MapPin,
  Clock,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Sparkles,
  FileText,
} from "lucide-react";
import { Input, Skeleton, Badge, ScrollArea } from "@novacal/ui";
import { cn } from "@novacal/ui/lib/utils";
import { SPRING_FLUID, SPRING_SWIFT } from "@novacal/shared";
import type { Event } from "@novacal/shared";

// ─── Constants ───

const DEBOUNCE_MS = 300;
const SEARCH_PLACEHOLDER = "Search events, people, and more…";

// ─── Helpers ───

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, tomorrow)) return "Tomorrow";

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Highlight matching text ───

function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-[--primary-accent-muted] text-[--primary-accent] rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ─── Skeleton Loading ───

function SearchSkeleton() {
  return (
    <div className="space-y-3 px-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="flex gap-3 p-3 rounded-[--radius-lg] border border-[--border-elevated]"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-[--radius-base]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ───

function SearchEmptyState({
  hasQuery,
  query,
}: {
  hasQuery: boolean;
  query: string;
}) {
  if (!hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center text-center select-none py-16">
        <Search className="h-8 w-8 text-[--text-muted] opacity-30 mb-4" />
        <p className="text-sm font-medium text-[--text-secondary]">
          Search your calendar
        </p>
        <p className="text-xs text-[--text-muted] mt-1 max-w-xs">
          Type to search events, titles, descriptions, and locations across all
          your calendars.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center select-none py-16">
      <FileText className="h-8 w-8 text-[--text-muted] opacity-30 mb-4" />
      <p className="text-sm font-medium text-[--text-secondary]">
        No results for &ldquo;{query}&rdquo;
      </p>
      <p className="text-xs text-[--text-muted] mt-1 max-w-xs">
        Try different keywords, check your spelling, or search for dates.
      </p>
    </div>
  );
}

// ─── Result Item ───

function SearchResultItem({
  event,
  query,
  isSelected,
  index,
  onSelect,
}: {
  event: Event;
  query: string;
  isSelected: boolean;
  index: number;
  onSelect: (eventId: string) => void;
}) {
  const accentColor = event.color ?? "#6366F1";

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ ...SPRING_FLUID, delay: index * 0.02 }}
      className={cn(
        "flex items-start gap-3 w-full text-left p-3 rounded-[--radius-lg] border transition-none cursor-pointer",
        isSelected
          ? "border-[--primary-accent]/40 bg-[--primary-accent-muted]"
          : "border-[--border-elevated] bg-[--surface] hover:bg-[--surface-hover]",
      )}
      onClick={() => onSelect(event.id)}
      onMouseDown={(e) => e.preventDefault()}
      aria-selected={isSelected}
      role="option"
    >
      {/* Color icon */}
      <div
        className="h-9 w-9 rounded-[--radius-base] flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <Calendar className="h-4 w-4" style={{ color: accentColor }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[--text-primary] truncate">
          <HighlightText text={event.title} query={query} />
        </h3>

        <div className="flex items-center gap-2 mt-1 text-xs text-[--text-secondary]">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(event.startTime)} &middot; {formatTime(event.startTime)}
          </span>
        </div>

        {event.location && (
          <p className="text-xs text-[--text-muted] mt-1 truncate flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <HighlightText text={event.location} query={query} />
          </p>
        )}

        {event.description && (
          <p className="text-xs text-[--text-muted] mt-1 line-clamp-1">
            <HighlightText text={event.description} query={query} />
          </p>
        )}
      </div>

      {/* Quick-open hint */}
      <kbd className="hidden group-hover:flex items-center gap-0.5 text-[10px] text-[--text-muted] shrink-0 self-center">
        <CornerDownLeft className="h-3 w-3" />
      </kbd>
    </motion.button>
  );
}

// ─── Page Component ───

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Autofocus input on mount
  useEffect(() => {
    // Small delay to ensure the DOM is ready
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // If there's an initial query from URL, search immediately
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Perform Search ──
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setSelectedIndex(-1);

    try {
      const params = new URLSearchParams({ q: trimmed });
      const res = await fetch(`/api/search?${params.toString()}`);

      if (res.ok) {
        const data = await res.json();
        setResults(data.data ?? data ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Debounced Search ──
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Update URL query param
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.replace(`/search?${params.toString()}`, { scroll: false });

      // Debounce the API call
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, DEBOUNCE_MS);
    },
    [performSearch, router, searchParams],
  );

  // ── Clear Search ──
  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
    router.replace("/search", { scroll: false });
  }, [router]);

  // ── Navigate to Event ──
  const openEvent = useCallback(
    (eventId: string) => {
      router.push(`/event/${eventId}`);
    },
    [router],
  );

  // ── Keyboard Navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0,
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1,
          );
          break;

        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            openEvent(results[selectedIndex]!.id);
          }
          break;

        case "Escape":
          e.preventDefault();
          clearSearch();
          break;
      }
    },
    [results, selectedIndex, openEvent, clearSearch],
  );

  // ── Scroll selected item into view ──
  useEffect(() => {
    if (selectedIndex < 0 || !resultsContainerRef.current) return;

    const items = resultsContainerRef.current.querySelectorAll(
      '[role="option"]',
    );
    const selectedEl = items[selectedIndex];
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // ── Cleanup debounce on unmount ──
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ── Search Input ── */}
      <div className="px-4 pt-3 pb-2 border-b border-[--border-elevated]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted] pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={SEARCH_PLACEHOLDER}
            className={cn(
              "w-full h-11 pl-10 pr-10 bg-[--surface] border border-[--border-subtle] rounded-[--radius-lg]",
              "text-sm text-[--text-primary] placeholder:text-[--text-muted]",
              "focus:outline-none focus:border-[--primary-accent]/50 focus:ring-1 focus:ring-[--primary-accent]/20",
              "transition-none",
            )}
            aria-label="Search events"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-muted] hover:text-[--text-primary] transition-none"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      <ScrollArea className="flex-1">
        <div ref={resultsContainerRef} className="p-4" role="listbox">
          {isLoading ? (
            <SearchSkeleton />
          ) : hasSearched && results.length === 0 ? (
            <SearchEmptyState hasQuery={true} query={query} />
          ) : !hasSearched ? (
            <SearchEmptyState hasQuery={false} query="" />
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {/* Results count */}
                <div className="flex items-center justify-between px-1 mb-3">
                  <p className="text-xs text-[--text-muted]">
                    {results.length}{" "}
                    {results.length === 1 ? "result" : "results"}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[--text-muted]">
                    <span className="flex items-center gap-0.5">
                      <ArrowUp className="h-3 w-3" />
                      <ArrowDown className="h-3 w-3" />
                      Navigate
                    </span>
                    <span className="flex items-center gap-0.5">
                      <CornerDownLeft className="h-3 w-3" />
                      Open
                    </span>
                  </div>
                </div>

                {results.map((event, index) => (
                  <SearchResultItem
                    key={event.id}
                    event={event}
                    query={query}
                    isSelected={index === selectedIndex}
                    index={index}
                    onSelect={openEvent}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
