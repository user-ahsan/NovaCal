"use client";

import { useState, useCallback, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@novacal/ui/lib/utils";

// ─── Types ───
interface MagneticButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  disabled?: boolean;
}

// ─── Component ───
/**
 * A button with a subtle radial glow that tracks the mouse position
 * relative to the button bounds. Uses Framer Motion spring physics
 * for hover/tap scale transforms.
 *
 * - `whileHover` → scale 1.02
 * - `whileTap`   → scale 0.98
 * - Radial gradient glow centers on the pointer position
 */
export function MagneticButton({
  children,
  onClick,
  variant = "primary",
  className,
  disabled = false,
}: MagneticButtonProps) {
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  /** Track mouse position relative to the button element. */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPointerPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setPointerPos(null);
  }, []);

  const isPrimary = variant === "primary";

  return (
    <motion.div
      className={cn(
        "relative inline-flex overflow-hidden rounded-[--radius-base] cursor-pointer",
        "transition-none",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
    >
      {/* Radial glow overlay tracking the pointer */}
      {pointerPos && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${pointerPos.x}px ${pointerPos.y}px, rgba(99, 102, 241, 0.25) 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Base button styling */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
          isPrimary
            ? "bg-[--primary-accent] text-white"
            : "bg-transparent text-[--text-primary] hover:bg-[--ghost-hover]",
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
