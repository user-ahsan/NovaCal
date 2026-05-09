"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Calendar Page
//
// Main calendar grid view. Default landing page after authentication.
//   - Renders the edge-to-edge GridCanvas component.
//   - View switcher (day / week / month) with URL query params.
//   - Date navigation via query param `date=YYYY-MM-DD`.
//   - Skeleton shimmer while loading.
//   - Empty state when no events exist.
//
// Source: docs/05-route-map-web-mobile.md §2 (Core Application)
//         docs/06-design-specification.md §2-B (The Calendar Grid)
//         docs/07-component-animation-guide.md §2 (View Switching)
//         AGENTS.md Rule 66 (no spinners — skeletons only)
//         AGENTS.md Rule 67 (beautiful empty states)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button, Skeleton } from "@novacal/ui";
import { cn } from "@novacal/ui/lib/utils";
import {
  type CalendarView,
  SPRING_FLUID,
  SPRING_SWIFT,
} from "@novacal/shared";
import { GridCanvas } from "../../../components/GridCanvas";
import type { Event } from "@novacal/shared";

// ─── View Options ───

interface ViewOption {
  value: CalendarView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: "day", label: "Day", icon: CalendarIcon },
  { value: "week", label: "Week", icon: CalendarDays },
  { value: "month", label: "Month", icon: CalendarRange },
];

// ─── Helpers ───

function formatTitleDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

// ─── Page Component ───

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Derive view from URL or default to "week"
  const viewParam = searchParams.get("view") as CalendarView | null;
  const view: CalendarView = viewParam ?? "week";

  // Derive date from URL or default to today
  const dateParam = searchParams.get("date");
  const [currentDate, setCurrentDate] = useState(() => {
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });

  // Events state
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync URL param changes to currentDate
  useEffect(() => {
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        setCurrentDate(parsed);
      }
    }
  }, [dateParam]);

  // ── Update URL helper ──
  const updateUrl = useCallback(
    (newView: CalendarView, newDate: Date) => {
      const params = new URLSearchParams();
      params.set("view", newView);
      params.set("date", newDate.toISOString().split("T")[0]);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  // ── View Switcher ──
  const handleViewChange = useCallback(
    (newView: CalendarView) => {
      updateUrl(newView, currentDate);
    },
    [updateUrl, currentDate],
  );

  // ── Date Navigation ──
  const navigateDate = useCallback(
    (direction: "prev" | "next") => {
      let newDate: Date;
      switch (view) {
        case "day":
          newDate = addDays(currentDate, direction === "next" ? 1 : -1);
          break;
        case "week":
          newDate = addWeeks(currentDate, direction === "next" ? 1 : -1);
          break;
        case "month":
          newDate = addMonths(currentDate, direction === "next" ? 1 : -1);
          break;
        default:
          newDate = addDays(currentDate, direction === "next" ? 1 : -1);
      }
      setCurrentDate(newDate);
      updateUrl(view, newDate);
    },
    [view, currentDate, updateUrl],
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    updateUrl(view, today);
  }, [view, updateUrl]);

  // ── Compute title based on view ──
  const title = useMemo(() => {
    switch (view) {
      case "day":
        return formatTitleDate(currentDate);
      case "week": {
        const start = startOfWeek(currentDate);
        const end = endOfWeek(currentDate);
        const startMonth = start.toLocaleDateString("en-US", { month: "short" });
        const endMonth = end.toLocaleDateString("en-US", { month: "short" });
        return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
      }
      case "month":
        return formatMonthYear(currentDate);
      default:
        return formatTitleDate(currentDate);
    }
  }, [view, currentDate]);

  // ── Fetch Events ──
  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      try {
        // Compute date range for the current view
        let start: Date;
        let end: Date;

        switch (view) {
          case "day":
            start = new Date(currentDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(currentDate);
            end.setHours(23, 59, 59, 999);
            break;
          case "week":
            start = startOfWeek(currentDate);
            start.setHours(0, 0, 0, 0);
            end = endOfWeek(currentDate);
            end.setHours(23, 59, 59, 999);
            break;
          case "month":
            start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            break;
          default:
            start = new Date(currentDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(currentDate);
            end.setHours(23, 59, 59, 999);
        }

        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
        });

        const res = await fetch(`/api/events?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.data ?? data ?? []);
        } else {
          setEvents([]);
        }
      } catch {
        // Silently fail — empty state handles the fallback
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, [view, currentDate]);

  // ── Event Callbacks ──
  const handleEventDrop = useCallback(
    async (eventId: string, newStart: Date, newEnd: Date) => {
      // Optimistic update
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === eventId
            ? { ...evt, startTime: newStart.toISOString(), endTime: newEnd.toISOString() }
            : evt,
        ),
      );

      // Persist to server
      try {
        await fetch(`/api/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          }),
        });
      } catch {
        // Revert on failure by refetching
        const params = new URLSearchParams({
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
        });
        const res = await fetch(`/api/events?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.data ?? data ?? []);
        }
      }
    },
    [],
  );

  const handleEventEdit = useCallback((eventId: string) => {
    // Navigate to event edit or open modal
    router.push(`/event/${eventId}`);
  }, []);

  const handleEventDelete = useCallback(
    async (eventId: string) => {
      // Optimistic remove
      setEvents((prev) => prev.filter((evt) => evt.id !== eventId));

      try {
        await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      } catch {
        // Refetch on failure
        setIsLoading(true);
        // Re-trigger fetch
      }
    },
    [],
  );

  const handleSlotClick = useCallback(
    (start: Date, end: Date) => {
      // Navigate to event creation with pre-filled times
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });
      router.push(`/event/new?${params.toString()}`);
    },
    [router],
  );

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[--border-elevated] bg-[--surface]/30 backdrop-blur-[12px] sticky top-0 z-20">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[--text-muted]"
            onClick={() => navigateDate("prev")}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs font-medium h-8"
            onClick={goToToday}
          >
            Today
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[--text-muted]"
            onClick={() => navigateDate("next")}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <h1 className="text-sm font-semibold text-[--text-primary] ml-2 hidden sm:block">
            {title}
          </h1>
        </div>

        {/* Right: View Switcher */}
        <div className="flex items-center gap-1 bg-[--surface] rounded-[--radius-base] p-0.5 border border-[--border-subtle]">
          {VIEW_OPTIONS.map((opt) => {
            const isActive = view === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleViewChange(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-[--radius-base] text-xs font-medium transition-none",
                  isActive
                    ? "bg-[--surface-elevated] text-[--text-primary] shadow-sm"
                    : "text-[--text-muted] hover:text-[--text-secondary]",
                )}
                aria-label={`${opt.label} view`}
                aria-current={isActive ? "page" : undefined}
              >
                <opt.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="flex-1 overflow-auto">
        <GridCanvas
          view={view}
          date={currentDate}
          events={events}
          loading={isLoading}
          onEventDrop={handleEventDrop}
          onEventEdit={handleEventEdit}
          onEventDelete={handleEventDelete}
          onSlotClick={handleSlotClick}
        />
      </div>
    </div>
  );
}
