"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Event, CalendarView } from "@novacal/shared";
import {
  SLOT_INCREMENT_MINUTES,
  SPRING_FLUID,
} from "@novacal/shared";
import { Skeleton } from "@novacal/ui/skeleton";
import { EventBlock } from "./EventBlock";
import { TimeLineIndicator } from "./TimeLineIndicator";
import { GhostSlot } from "./GhostSlot";

// ═══════════════════════════════════════════════════════════════
//  Grid Constants
// ═══════════════════════════════════════════════════════════════

const HOUR_HEIGHT_PX = 60;
const VISIBLE_START_HOUR = 0;
const VISIBLE_HOURS = 24;
const GRID_TOTAL_HEIGHT = VISIBLE_HOURS * HOUR_HEIGHT_PX;
const TIME_GUTTER_WIDTH = 60; // px — left column for time labels
const MINUTE_HEIGHT = HOUR_HEIGHT_PX / 60; // px per minute

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

interface GridCanvasProps {
  view: CalendarView;
  date: Date;
  events: Event[];
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventEdit?: (eventId: string) => void;
  onEventDelete?: (eventId: string) => void;
  /** Callback fired when the user clicks an empty slot to create an event. */
  onSlotClick?: (start: Date, end: Date) => void;
  /** Whether the grid is in a loading state. */
  loading?: boolean;
}

interface ComputedEventLayout {
  event: Event;
  top: number;
  height: number;
  left: number;
  width: number;
}

interface HoverSlot {
  dayIndex: number;
  minutes: number; // minutes from midnight
  top: number;
  left: number;
  width: number;
}

// ═══════════════════════════════════════════════════════════════
//  Date Helpers
// ═══════════════════════════════════════════════════════════════

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7)); // Monday start
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function daysInMonth(date: Date): number {
  return endOfMonth(date).getDate();
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// ═══════════════════════════════════════════════════════════════
//  Compute Days for View
// ═══════════════════════════════════════════════════════════════

function getDaysForView(view: CalendarView, date: Date): Date[] {
  switch (view) {
    case "day":
      return [new Date(date)];

    case "3-day": {
      const days: Date[] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(date);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
      return days;
    }

    case "week": {
      const start = startOfWeek(date);
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
      return days;
    }

    case "month": {
      const start = startOfMonth(date);
      const total = daysInMonth(date);
      const days: Date[] = [];
      for (let i = 0; i < total; i++) {
        const d = new Date(start);
        d.setDate(i + 1);
        days.push(d);
      }
      return days;
    }

    case "year":
      // Year view: show first day of each month as a column header
      return [new Date(date)];

    default:
      return [new Date(date)];
  }
}

// ═══════════════════════════════════════════════════════════════
//  Overlap Detection — Greedy Column Assignment
// ═══════════════════════════════════════════════════════════════

/**
 * Groups overlapping events into columns so they display side-by-side
 * rather than stacked on top of one another.
 *
 * Algorithm:
 *   1. Sort events by start time (then end time).
 *   2. For each event, find the first column whose last event ends before
 *      or at this event's start time.
 *   3. If none found, start a new column.
 *
 * Returns a Map of event-id → { column, totalColumns }.
 */
function assignOverlapColumns(
  eventSlots: { id: string; startMinutes: number; endMinutes: number }[],
): Map<string, { column: number; totalColumns: number }> {
  const sorted = [...eventSlots].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );

  const columnEnds: number[] = [];
  const result = new Map<string, { column: number; totalColumns: number }>();

  for (const evt of sorted) {
    let assigned = false;
    for (let col = 0; col < columnEnds.length; col++) {
      if (columnEnds[col]! <= evt.startMinutes) {
        columnEnds[col] = evt.endMinutes;
        result.set(evt.id, { column: col, totalColumns: columnEnds.length });
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      columnEnds.push(evt.endMinutes);
      result.set(evt.id, {
        column: columnEnds.length - 1,
        totalColumns: columnEnds.length,
      });
    }
  }

  // If no overlap detected, all events span the full column width
  if (columnEnds.length <= 1) {
    for (const id of result.keys()) {
      result.set(id, { column: 0, totalColumns: 1 });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
//  Compute Event Layout
// ═══════════════════════════════════════════════════════════════

function computeEventLayout(
  events: Event[],
  days: Date[],
): ComputedEventLayout[] {
  const layout: ComputedEventLayout[] = [];

  // Group events by day
  const eventsByDay = new Map<string, Event[]>();
  for (const event of events) {
    const eventDate = new Date(event.startTime);
    const key = formatDateKey(eventDate);
    const group = eventsByDay.get(key) ?? [];
    group.push(event);
    eventsByDay.set(key, group);
  }

  const dayColumnWidthFraction = 1 / days.length;

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx];
    const dayKey = formatDateKey(day);
    const dayEvents = eventsByDay.get(dayKey);

    if (!dayEvents || dayEvents.length === 0) continue;

    // Compute slot data for overlap detection
    const slotData = dayEvents.map((evt) => {
      const start = new Date(evt.startTime);
      const end = new Date(evt.endTime);
      const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
      const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
      return { id: evt.id, startMinutes, endMinutes };
    });

    const columnMap = assignOverlapColumns(slotData);

    for (const event of dayEvents) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);

      const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
      const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
      const durationMinutes = Math.max(endMinutes - startMinutes, SLOT_INCREMENT_MINUTES);

      const top = startMinutes * MINUTE_HEIGHT;
      const height = durationMinutes * MINUTE_HEIGHT;

      const colInfo = columnMap.get(event.id);
      const col = colInfo?.column ?? 0;
      const totalCols = colInfo?.totalColumns ?? 1;

      // Distribute within the day column
      const colWidth = dayColumnWidthFraction / totalCols;
      const left = dayIdx * dayColumnWidthFraction + col * colWidth;
      const width = colWidth;

      layout.push({ event, top, height, left, width });
    }
  }

  return layout;
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

/** Renders horizontal grid lines at 30-minute intervals. */
function GridLines() {
  const lines: React.ReactNode[] = [];
  for (let i = 0; i <= VISIBLE_HOURS * 2; i++) {
    const minutes = i * 30;
    const top = (minutes / 60) * HOUR_HEIGHT_PX;
    const isHour = i % 2 === 0;

    lines.push(
      <div
        key={i}
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top,
          height: 1,
          backgroundColor: isHour
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(255, 255, 255, 0.03)",
        }}
      />,
    );
  }
  return <>{lines}</>;
}

/** Renders the time labels gutter on the left side. */
function TimeGutter() {
  const labels: React.ReactNode[] = [];
  for (let i = 0; i < VISIBLE_HOURS; i++) {
    const hour = i + VISIBLE_START_HOUR;
    const top = i * HOUR_HEIGHT_PX;
    labels.push(
      <div
        key={i}
        className="absolute right-2 flex items-start justify-end text-[11px] font-mono text-[--text-muted] leading-none pointer-events-none select-none"
        style={{ top: top - 6, height: HOUR_HEIGHT_PX, width: TIME_GUTTER_WIDTH - 8 }}
      >
        {hour === 0
          ? "12 AM"
          : hour < 12
            ? `${hour} AM`
            : hour === 12
              ? "12 PM"
              : `${hour - 12} PM`}
      </div>,
    );
  }
  return <>{labels}</>;
}

/** Renders the sticky day header row above each column. */
function DayHeaders({ days }: { days: Date[] }) {
  const dayColumnWidth = `calc((100% - ${TIME_GUTTER_WIDTH}px) / ${days.length})`;
  return (
    <div
      className="sticky top-0 z-30 flex bg-[--background]/90 backdrop-blur-[12px] border-b border-[--border-subtle]"
      style={{ marginLeft: TIME_GUTTER_WIDTH }}
    >
      {days.map((day) => (
        <div
          key={formatDateKey(day)}
          className="flex flex-col items-center py-2"
          style={{ width: dayColumnWidth, minWidth: 0 }}
        >
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isToday(day)
                ? "text-[--primary-accent]"
                : "text-[--text-secondary]"
            }`}
          >
            {formatDayHeader(day)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Skeleton placeholder that matches the grid shape during loading. */
function GridSkeleton({ days }: { days: Date[] }) {
  const dayColumnWidth = `calc((100% - ${TIME_GUTTER_WIDTH}px) / ${days.length})`;
  return (
    <div style={{ height: GRID_TOTAL_HEIGHT }} className="relative">
      <GridLines />
      <TimeGutter />
      {days.map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 px-1"
          style={{
            left: `calc(${TIME_GUTTER_WIDTH}px + ${i} * ${dayColumnWidth})`,
            width: dayColumnWidth,
          }}
        >
          {/* 3 skeleton blocks scattered across the day */}
          {Array.from({ length: 3 }, (_, j) => (
            <Skeleton
              key={j}
              className="mb-2 rounded-[--radius-base]"
              style={{
                height: `${40 + j * 20}px`,
                width: "85%",
                marginTop: `${60 + j * 120}px`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Empty state shown when a day has no events. */
function EmptyGrid({ days }: { days: Date[] }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center select-none"
      style={{ height: GRID_TOTAL_HEIGHT / 2, marginTop: GRID_TOTAL_HEIGHT / 4 }}
    >
      <div className="text-3xl mb-4 text-[--text-muted] opacity-30">
        ✦ &nbsp;✧ &nbsp;✦
      </div>
      <p className="text-lg font-semibold text-[--text-secondary]">
        Your day is clear.
      </p>
      <p className="text-sm text-[--text-muted] mt-1">Breathe.</p>
    </div>
  );
}

/** Month-view renderer: day boxes without hourly time slots. */
function MonthGrid({ days, events }: { days: Date[]; events: Event[] }) {
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const evt of events) {
      const key = formatDateKey(new Date(evt.startTime));
      const group = map.get(key) ?? [];
      group.push(evt);
      map.set(key, group);
    }
    return map;
  }, [events]);

  const cols = 7;
  const rows = Math.ceil(days.length / cols);

  return (
    <div className="grid grid-cols-7 h-full border-l border-t border-[--border-subtle]">
      {days.map((day) => {
        const key = formatDateKey(day);
        const dayEvents = eventsByDay.get(key) ?? [];
        return (
          <div
            key={key}
            className="border-r border-b border-[--border-subtle] p-1 min-h-[80px]"
          >
            <span
              className={`text-xs font-semibold ${
                isToday(day) ? "text-[--primary-accent]" : "text-[--text-secondary]"
              }`}
            >
              {day.getDate()}
            </span>
            <div className="mt-1 space-y-0.5">
              {dayEvents.slice(0, 3).map((evt) => (
                <div
                  key={evt.id}
                  className="text-[10px] truncate rounded px-1 py-0.5"
                  style={{
                    backgroundColor: `${evt.color ?? "#6366F1"}20`,
                    borderLeft: `2px solid ${evt.color ?? "#6366F1"}`,
                  }}
                >
                  {evt.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <span className="text-[10px] text-[--text-muted]">
                  +{dayEvents.length - 3} more
                </span>
              )}
            </div>
          </div>
        );
      })}
      {/* Fill remaining cells */}
      {Array.from({ length: cols * rows - days.length }, (_, i) => (
        <div
          key={`empty-${i}`}
          className="border-r border-b border-[--border-subtle] bg-[--surface]/30"
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GridCanvas — Main Component
// ═══════════════════════════════════════════════════════════════

/**
 * The edge-to-edge calendar grid — NovaCal's most complex component.
 *
 * - Computes event positions (top, height, left, width) based on start time
 *   and duration.
 * - Detects overlapping concurrent events and distributes them into columns.
 * - Renders fixed grid lines (30/60-min intervals), absolutely positioned
 *   EventBlocks, a TimeLineIndicator overlay, and a GhostSlot on hover.
 * - Supports day, 3-day, week, month, and year views.
 * - View switching uses a slide left/right spring animation.
 */
export function GridCanvas({
  view,
  date,
  events,
  onEventDrop,
  onEventEdit,
  onEventDelete,
  onSlotClick,
  loading = false,
}: GridCanvasProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [hoverSlot, setHoverSlot] = useState<HoverSlot | null>(null);

  const isTimeView = view === "day" || view === "3-day" || view === "week";
  const days = useMemo(() => getDaysForView(view, date), [view, date]);

  const computedLayout = useMemo(
    () => (isTimeView ? computeEventLayout(events, days) : []),
    [events, days, isTimeView],
  );

  // Key for AnimatePresence — changes on view/date switch
  const animationKey = `${view}-${formatDateKey(days[0] ?? date)}`;

  // ── Mouse tracking for ghost slot ──
  const handleGridMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isTimeView || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Determine which day column
      const gridContentWidth = rect.width - TIME_GUTTER_WIDTH;
      const colWidth = gridContentWidth / days.length;
      const dayIndex = Math.floor((x - TIME_GUTTER_WIDTH) / colWidth);

      if (dayIndex < 0 || dayIndex >= days.length) {
        setHoverSlot(null);
        return;
      }

      // 15-min snap for Y position
      const slotHeightPx = (SLOT_INCREMENT_MINUTES * HOUR_HEIGHT_PX) / 60;
      const snappedY = Math.round(y / slotHeightPx) * slotHeightPx;
      const snappedMinutes =
        snappedY / (HOUR_HEIGHT_PX / 60) + VISIBLE_START_HOUR * 60;

      setHoverSlot({
        dayIndex,
        minutes: snappedMinutes,
        top: snappedY,
        left: TIME_GUTTER_WIDTH + dayIndex * colWidth,
        width: colWidth,
      });
    },
    [days, isTimeView],
  );

  const handleGridMouseLeave = useCallback(() => {
    setHoverSlot(null);
  }, []);

  const handleGhostSlotClick = useCallback(() => {
    if (!hoverSlot || !days[hoverSlot.dayIndex]) return;

    const day = days[hoverSlot.dayIndex];
    const start = new Date(day);
    start.setHours(0, hoverSlot.minutes, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + SLOT_INCREMENT_MINUTES);

    onSlotClick?.(start, end);
    setHoverSlot(null);
  }, [hoverSlot, days, onSlotClick]);

  // ── Loading state ──
  if (loading) {
    return (
      <div ref={gridRef} className="relative w-full overflow-auto">
        <DayHeaders days={days} />
        <GridSkeleton days={days} />
      </div>
    );
  }

  // ── Month / Year view ──
  if (!isTimeView) {
    return (
      <div ref={gridRef} className="relative w-full h-full overflow-auto">
        {view === "month" ? (
          <MonthGrid days={days} events={events} />
        ) : (
          <div className="flex items-center justify-center h-full text-[--text-muted] text-sm">
            Year view
          </div>
        )}
      </div>
    );
  }

  // ── Day / 3-day / Week view — Time-grid ──
  const hasEvents = computedLayout.length > 0;

  return (
    <div
      ref={gridRef}
      className="relative w-full overflow-auto select-none"
      onMouseMove={handleGridMouseMove}
      onMouseLeave={handleGridMouseLeave}
    >
      {/* Sticky day headers */}
      <DayHeaders days={days} />

      {/* Grid body with AnimatePresence for view switching */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={animationKey}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={SPRING_FLUID}
          className="relative"
          style={{ height: GRID_TOTAL_HEIGHT }}
        >
          {/* Horizontal grid lines */}
          <GridLines />

          {/* Time gutter */}
          <TimeGutter />

          {/* Day columns — vertical dividers */}
          {days.map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-[--border-subtle]/50 pointer-events-none"
              style={{
                left: `calc(${TIME_GUTTER_WIDTH}px + ${i} * (100% - ${TIME_GUTTER_WIDTH}px) / ${days.length})`,
              }}
            />
          ))}

          {/* Event blocks */}
          {hasEvents &&
            computedLayout.map((item) => (
              <EventBlock
                key={item.event.id}
                event={item.event}
                top={item.top}
                height={item.height}
                left={`calc(${TIME_GUTTER_WIDTH}px + ${item.left * 100}%)`}
                width={`${item.width * 100}%`}
                visibleStartHour={VISIBLE_START_HOUR}
                onEventDrop={onEventDrop}
                onEdit={onEventEdit}
                onDelete={onEventDelete}
              />
            ))}

          {/* Time indicator — "Now" line */}
          <TimeLineIndicator
            containerHeight={GRID_TOTAL_HEIGHT}
            visibleStartHour={VISIBLE_START_HOUR}
            hourHeight={HOUR_HEIGHT_PX}
          />

          {/* Ghost slot on hover */}
          {hoverSlot && (
            <div
              className="absolute"
              style={{
                left: hoverSlot.left,
                top: hoverSlot.top,
                width: hoverSlot.width,
                height: (SLOT_INCREMENT_MINUTES * HOUR_HEIGHT_PX) / 60,
              }}
            >
              <GhostSlot
                top={0}
                left={0}
                width="100%"
                height={(SLOT_INCREMENT_MINUTES * HOUR_HEIGHT_PX) / 60}
                onClick={handleGhostSlotClick}
              />
            </div>
          )}

          {/* Empty state */}
          {!hasEvents && (
            <EmptyGrid days={days} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
