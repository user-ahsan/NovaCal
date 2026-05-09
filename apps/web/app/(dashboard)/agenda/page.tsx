"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Agenda Page
//
// Infinite scroll list view of all upcoming chronological events.
//   - Sticky date headers with backdrop-filter: blur(12px).
//   - Event cards: time, title, location, color dot.
//   - ScrollArea with IntersectionObserver for infinite scroll.
//   - Skeleton shimmer while loading.
//   - Beautiful empty state when no events exist.
//
// Source: docs/05-route-map-web-mobile.md §2 (Core Application)
//         docs/06-design-specification.md §3-C (The Agenda View)
//         AGENTS.md Rule 66 (no spinners — skeletons only)
//         AGENTS.md Rule 67 (beautiful empty states)
//         AGENTS.md Rule 70 (glassmorphism blur)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ScrollArea, Skeleton, Badge } from "@novacal/ui";
import { cn } from "@novacal/ui/lib/utils";
import { SPRING_FLUID, AGENDA_PAGE_SIZE } from "@novacal/shared";
import type { Event } from "@novacal/shared";

// ─── Helpers ───

function formatDateHeader(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ─── Group Events by Date ───

interface DateGroup {
  date: Date;
  label: string;
  events: Event[];
}

function groupEventsByDate(events: Event[]): DateGroup[] {
  const groups = new Map<string, Event[]>();

  for (const event of events) {
    const d = new Date(event.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, evts]) => {
      const [year, month, day] = key.split("-").map(Number);
      const date = new Date(year!, month! - 1, day!);
      return { date, label: formatDateHeader(date), events: evts };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ─── Skeleton Loading ───

function AgendaSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 3 }, (_, groupIdx) => (
        <div key={groupIdx}>
          <Skeleton className="h-5 w-40 mb-3" />
          {Array.from({ length: 2 + groupIdx }, (_, cardIdx) => (
            <div
              key={cardIdx}
              className="flex gap-3 mb-3 p-3 rounded-[--radius-lg] border border-[--border-elevated]"
            >
              <Skeleton className="h-10 w-14 shrink-0 rounded-[--radius-base]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ───

function AgendaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center select-none px-6">
      <div className="text-4xl mb-6 text-[--text-muted] opacity-20">
        ✦ &nbsp;✧ &nbsp;✦
      </div>
      <p className="text-lg font-semibold text-[--text-secondary]">
        Nothing coming up
      </p>
      <p className="text-sm text-[--text-muted] mt-2 max-w-xs">
        Your schedule is wide open. Use the AI command bar (⌘K) to create your
        first event, or click the grid to add one.
      </p>
    </div>
  );
}

// ─── Event Card ───

function AgendaEventCard({
  event,
  index,
}: {
  event: Event;
  index: number;
}) {
  const router = useRouter();
  const accentColor = event.color ?? "#6366F1";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_FLUID, delay: index * 0.03 }}
      className="flex items-start gap-3 w-full text-left p-3 rounded-[--radius-lg] border border-[--border-elevated] bg-[--surface] hover:bg-[--surface-hover] transition-none cursor-pointer group"
      onClick={() => router.push(`/event/${event.id}`)}
    >
      {/* Time column */}
      <div className="flex flex-col items-end shrink-0 w-14 pt-0.5">
        <span className="text-xs font-mono font-semibold text-[--text-primary] leading-none">
          {formatTime(event.startTime)}
        </span>
        <span className="text-[10px] font-mono text-[--text-muted] mt-1 leading-none">
          {formatDuration(event.startTime, event.endTime)}
        </span>
      </div>

      {/* Color indicator */}
      <div
        className="w-0.5 shrink-0 rounded-full mt-1"
        style={{ backgroundColor: accentColor, height: 32 }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <h3 className="text-sm font-semibold text-[--text-primary] truncate">
            {event.title}
          </h3>
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-[--text-secondary]">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(event.startTime)} – {formatTime(event.endTime)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-xs text-[--text-muted] mt-1.5 line-clamp-1">
            {event.description}
          </p>
        )}
      </div>
    </motion.button>
  );
}

// ─── Date Group ───

function AgendaDateGroup({
  group,
  groupIndex,
}: {
  group: DateGroup;
  groupIndex: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: groupIndex * 0.05 }}
    >
      {/* Sticky Date Header */}
      <div
        className="sticky top-0 z-10 py-2 px-4 backdrop-blur-[12px] bg-[--background]/80 border-b border-[--border-elevated]"
        style={{ WebkitBackdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-[--primary-accent]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-secondary]">
            {group.label}
          </h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {group.events.length}
          </Badge>
        </div>
      </div>

      {/* Event Cards */}
      <div className="px-4 py-2 space-y-2">
        {group.events.map((event, idx) => (
          <AgendaEventCard key={event.id} event={event} index={idx} />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Page Component ───

export default function AgendaPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Initial Fetch ──
  useEffect(() => {
    async function fetchAgenda() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(AGENDA_PAGE_SIZE),
          sort: "startTime",
          direction: "asc",
          start: new Date().toISOString(), // Only upcoming events
        });

        const res = await fetch(`/api/events?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.data ?? data ?? []);
          setCursor(data.nextCursor ?? null);
          setHasMore(!!data.nextCursor);
        }
      } catch {
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAgenda();
  }, []);

  // ── Load More (Infinite Scroll) ──
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !cursor) return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(AGENDA_PAGE_SIZE),
        sort: "startTime",
        direction: "asc",
        start: new Date().toISOString(),
        cursor,
      });

      const res = await fetch(`/api/events?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents((prev) => [...prev, ...(data.data ?? data ?? [])]);
        setCursor(data.nextCursor ?? null);
        setHasMore(!!data.nextCursor);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, cursor]);

  // ── IntersectionObserver for infinite scroll ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoadingMore]);

  // ── Group events ──
  const groupedEvents = groupEventsByDate(events);

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* ── Page Header ── */}
      <div className="sticky top-0 z-20 px-4 py-3 border-b border-[--border-elevated] bg-[--background]/80 backdrop-blur-[12px]">
        <h1 className="text-sm font-semibold text-[--text-primary]">
          Agenda
        </h1>
        <p className="text-xs text-[--text-muted] mt-0.5">
          Upcoming events in chronological order
        </p>
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <AgendaSkeleton />
        ) : groupedEvents.length === 0 ? (
          <AgendaEmptyState />
        ) : (
          <div className="py-2">
            <AnimatePresence mode="popLayout">
              {groupedEvents.map((group, groupIdx) => (
                <AgendaDateGroup
                  key={group.date.toISOString()}
                  group={group}
                  groupIndex={groupIdx}
                />
              ))}
            </AnimatePresence>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[--primary-accent] animate-pulse" />
                  Loading more events…
                </div>
              </div>
            )}

            {/* End of list */}
            {!hasMore && events.length > 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-2 text-xs text-[--text-muted]">
                  <Sparkles className="h-4 w-4 text-[--primary-accent]/60" />
                  <span>You&rsquo;re all caught up!</span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
