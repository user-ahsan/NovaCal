"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";

// ─── Types ───
interface TimeLineIndicatorProps {
  /** Total scrollable height of the grid container. */
  containerHeight: number;
  /** The first visible hour on the grid (e.g., 0 for midnight). */
  visibleStartHour?: number;
  /** Pixels per hour of grid height. */
  hourHeight?: number;
}

// ─── Constants ───
const ACCENT_COLOR = "#6366F1";

// ─── Component ───
/**
 * A glowing "Now" line that stretches across the calendar grid at the
 * current time position. Its opacity pulses every 2 seconds and it
 * recalculates its Y-position every 60 seconds via a `useEffect` interval.
 */
export function TimeLineIndicator({
  containerHeight,
  visibleStartHour = 0,
  hourHeight = 60,
}: TimeLineIndicatorProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  // Recalculate current time every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Compute the Y-position of the indicator based on current time
  const top = useMemo(() => {
    const hours = now.getHours() + now.getMinutes() / 60;
    const offsetHours = hours - visibleStartHour;
    // Clamp between 0 and containerHeight
    return Math.max(0, Math.min(offsetHours * hourHeight, containerHeight));
  }, [now, visibleStartHour, hourHeight, containerHeight]);

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ top }}
    >
      {/* Neon line — 2px thick, accent color */}
      <motion.div
        className="absolute left-0 right-0"
        style={{
          height: 2,
          backgroundColor: ACCENT_COLOR,
          boxShadow: `0 0 6px ${ACCENT_COLOR}, 0 0 12px ${ACCENT_COLOR}40`,
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Pulsing dot at the left edge of the line */}
      <motion.div
        className="absolute"
        style={{
          left: -4,
          top: -4,
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: ACCENT_COLOR,
          boxShadow: `0 0 8px ${ACCENT_COLOR}, 0 0 16px ${ACCENT_COLOR}60`,
        }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
