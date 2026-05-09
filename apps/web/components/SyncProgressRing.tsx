"use client"

import React from "react"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { cn } from "@novacal/ui/lib/utils"

// ─── Types ───

type SyncStatus = "syncing" | "idle" | "offline"

interface SyncProgressRingProps {
  /** Progress value from 0 to 100 */
  progress: number
  /** Current sync status */
  status: SyncStatus
  /** Size of the ring in pixels (default: 40) */
  size?: number
  /** Stroke width in pixels (default: 3) */
  strokeWidth?: number
  /** Optional className */
  className?: string
  /** Optional label text shown below the ring */
  label?: string
}

// ─── Constants ───

const STATE_COLORS: Record<SyncStatus, string> = {
  syncing: "var(--primary-accent, #6366F1)",
  idle: "#22C55E",
  offline: "#F59E0B",
}

const STATE_LABELS: Record<SyncStatus, string> = {
  syncing: "Syncing…",
  idle: "Synced",
  offline: "Offline",
}

// ─── SVG Arc Path Helper ───

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180
  const endRad = ((endAngle - 90) * Math.PI) / 180

  const x1 = cx + radius * Math.cos(startRad)
  const y1 = cy + radius * Math.sin(startRad)
  const x2 = cx + radius * Math.cos(endRad)
  const y2 = cy + radius * Math.sin(endRad)

  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
}

// ─── Component ───

const SyncProgressRing: React.FC<SyncProgressRingProps> = ({
  progress,
  status,
  size = 40,
  strokeWidth = 3,
  className,
  label,
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  // Motion value for animating strokeDashoffset
  const progressValue = useMotionValue(0)
  const strokeDashoffset = useTransform(
    progressValue,
    [0, 100],
    [circumference, 0]
  )

  // Animate progress changes smoothly
  React.useEffect(() => {
    const controls = animate(progressValue, Math.min(progress, 100), {
      type: "spring",
      stiffness: 100,
      damping: 20,
      mass: 0.5,
    })
    return controls.stop
  }, [progress, progressValue])

  // Pulse animation for offline state
  const pulseOpacity = useMotionValue(1)

  React.useEffect(() => {
    if (status === "offline") {
      const controls = animate(pulseOpacity, [1, 0.4, 1], {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      })
      return controls.stop
    } else {
      pulseOpacity.set(1)
    }
  }, [status, pulseOpacity])

  const ringColor = STATE_COLORS[status]

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      {/* SVG Ring */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block"
        aria-label={`${STATE_LABELS[status]} — ${progress}%`}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface-hover, #18181B)"
          strokeWidth={strokeWidth}
        />

        {/* Progress arc */}
        <motion.path
          d={describeArc(center, center, radius, 0, 359.9)}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          opacity={pulseOpacity}
        />

        {/* Complete ring glow (when idle/100%) */}
        {status === "idle" && progress >= 100 && (
          <motion.circle
            cx={center}
            cy={center}
            r={radius - strokeWidth / 2}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth * 0.5}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.15, 1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </svg>

      {/* Percentage / status text */}
      <motion.span
        className="text-[10px] font-medium"
        animate={
          status === "offline"
            ? { color: "#F59E0B" }
            : status === "idle"
              ? { color: "#22C55E" }
              : { color: "var(--primary-accent, #6366F1)" }
        }
      >
        {label ?? (status === "syncing" ? `${Math.round(progress)}%` : STATE_LABELS[status])}
      </motion.span>
    </div>
  )
}

export { SyncProgressRing }
export type { SyncProgressRingProps, SyncStatus }
