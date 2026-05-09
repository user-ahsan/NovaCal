"use client";

import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import type { Event } from "@novacal/shared";
import { SLOT_INCREMENT_MINUTES } from "@novacal/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@novacal/ui/tooltip";
import { Edit2, Trash2 } from "lucide-react";

// ─── Constants ───
const HOUR_HEIGHT_PX = 60;

// ─── Types ───
interface EventBlockProps {
  event: Event;
  top: number;
  height: number;
  left: number;
  width: number;
  visibleStartHour?: number;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEdit?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
}

// ─── Helpers ───
/**
 * Rounds a Date to the nearest SLOT_INCREMENT_MINUTES.
 * Used to snap dragged events to the grid.
 */
function roundToSlot(date: Date): Date {
  const ms = date.getTime();
  const slotMs = SLOT_INCREMENT_MINUTES * 60 * 1000;
  return new Date(Math.round(ms / slotMs) * slotMs);
}

/**
 * Formats an ISO date string to a short time string (e.g. "10:30").
 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── Component ───
export function EventBlock({
  event,
  top,
  height,
  left,
  width,
  visibleStartHour = 0,
  onEventDrop,
  onEdit,
  onDelete,
}: EventBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const accentColor = event.color ?? "#6366F1";

  const handleDragEnd = useCallback(
    (
      _: MouseEvent | TouchEvent | PointerEvent,
      info: { offset: { x: number; y: number } },
    ) => {
      if (!onEventDrop) return;

      // Compute new top based on drag offset
      const newTopRaw = top + info.offset.y;
      const slotHeightPx = (SLOT_INCREMENT_MINUTES * HOUR_HEIGHT_PX) / 60;

      // Snap to nearest 15-min increment
      const snappedTop = Math.round(newTopRaw / slotHeightPx) * slotHeightPx;

      // Convert snapped Y position to minutes from midnight
      const snappedMinutesFromMidnight =
        snappedTop / (HOUR_HEIGHT_PX / 60) + visibleStartHour * 60;

      // Compute new start time keeping the original date
      const startDate = new Date(event.startTime);
      const originalDurationMs =
        new Date(event.endTime).getTime() - startDate.getTime();

      const newStart = new Date(
        Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate(),
          0,
          snappedMinutesFromMidnight,
          0,
          0,
        ),
      );
      const newEnd = new Date(newStart.getTime() + originalDurationMs);

      // Round both to nearest slot for clean times
      onEventDrop(event.id, roundToSlot(newStart), roundToSlot(newEnd));
    },
    [top, event, onEventDrop, visibleStartHour],
  );

  return (
    <motion.div
      ref={blockRef}
      layoutId={`event-${event.id}`}
      className="absolute rounded-[--radius-base] cursor-pointer select-none group z-10"
      style={{
        top,
        left,
        width,
        height,
        // 15% opacity accent background
        backgroundColor: `${accentColor}26`,
        // 2px left border in full accent
        borderLeft: `2px solid ${accentColor}`,
      }}
      drag="x,y"
      dragElastic={0.1}
      dragMomentum={false}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0px 20px 40px rgba(0,0,0,0.2)",
        cursor: "grabbing",
      }}
      onDragEnd={handleDragEnd}
    >
      {/* Event content */}
      <div className="p-2 overflow-hidden h-full flex flex-col justify-center">
        <p className="text-sm font-semibold text-[--text-primary] truncate leading-tight">
          {event.title}
        </p>
        <p className="text-xs text-[--text-secondary] truncate mt-0.5">
          {formatTime(event.startTime)} – {formatTime(event.endTime)}
        </p>
      </div>

      {/* Quick-action icons — appear on hover */}
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {onEdit && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(event.id);
                  }}
                  className="p-1 rounded bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white transition-colors"
                  aria-label="Edit event"
                >
                  <Edit2 size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Edit</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onDelete && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(event.id);
                  }}
                  className="p-1 rounded bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-[--destructive] transition-colors"
                  aria-label="Delete event"
                >
                  <Trash2 size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Delete</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </motion.div>
  );
}
