"use client";

import { motion } from "framer-motion";

// ─── Types ───
interface GhostSlotProps {
  /** Y-position from the top of the grid (px). */
  top: number;
  /** X-position from the left of the day column (px). */
  left: number;
  /** Width of the ghost block (px or CSS string). */
  width: number | string;
  /** Height of the ghost block (px) — always a single slot increment. */
  height: number;
  /** Called when the user clicks on the ghost slot. */
  onClick?: () => void;
}

// ─── Component ───
/**
 * A faded, dashed-border placeholder block that appears on the grid when
 * the cursor hovers over an empty time slot. It snaps to 15-minute
 * increments and indicates exactly where a click would create a new event.
 *
 * Animation: `initial={{ opacity: 0 }}` → `animate={{ opacity: 0.4 }}`
 * with a spring transition.
 */
export function GhostSlot({
  top,
  left,
  width,
  height,
  onClick,
}: GhostSlotProps) {
  return (
    <motion.button
      type="button"
      className="absolute rounded-[--radius-base] cursor-pointer z-10"
      style={{
        top,
        left,
        width,
        height,
        // Dashed border + very low opacity fill
        border: "2px dashed rgba(99, 102, 241, 0.5)",
        backgroundColor: "rgba(99, 102, 241, 0.06)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.4 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 30 }}
      onClick={onClick}
      aria-label="Click to create event"
    >
      {/* Centered hint text */}
      <span className="flex items-center justify-center h-full text-xs text-[--primary-accent]/60 select-none">
        Click to add event
      </span>
    </motion.button>
  );
}
