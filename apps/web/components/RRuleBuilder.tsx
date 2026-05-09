"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@novacal/ui"
import { cn } from "@novacal/ui/lib/utils"
import { SPRING_SWIFT, SPRING_FLUID } from "@novacal/shared"

// ─── Types ───

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
type EndType = "never" | "count" | "date"

const FREQUENCIES: Frequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]
const DAY_KEYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
}

interface RRuleBuilderProps {
  /** Current RRule string value (RFC 5545), e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR" */
  value: string
  /** Called with the new RRule string whenever the configuration changes */
  onChange: (rrule: string) => void
  className?: string
}

interface RRuleConfig {
  frequency: Frequency
  interval: number
  byDay: Set<(typeof DAY_KEYS)[number]>
  byMonthDay: number | null
  endType: EndType
  count: number
  untilDate: string // YYYY-MM-DD
}

// ─── Parser: RRule string → RRuleConfig ───

function parseRRule(rrule: string): Partial<RRuleConfig> {
  const config: Partial<RRuleConfig> = {}

  if (!rrule) return config

  const parts = rrule.split(";")
  for (const part of parts) {
    const [key, val] = part.split("=")
    if (!key || !val) continue

    switch (key) {
      case "FREQ":
        if (FREQUENCIES.includes(val as Frequency)) {
          config.frequency = val as Frequency
        }
        break
      case "INTERVAL":
        config.interval = parseInt(val, 10) || 1
        break
      case "BYDAY":
        config.byDay = new Set(
          val.split(",").filter((d): d is (typeof DAY_KEYS)[number] =>
            DAY_KEYS.includes(d as (typeof DAY_KEYS)[number])
          )
        )
        break
      case "BYMONTHDAY":
        config.byMonthDay = parseInt(val, 10) || null
        break
      case "COUNT":
        config.count = parseInt(val, 10) || 1
        config.endType = "count"
        break
      case "UNTIL":
        config.untilDate = val
        config.endType = "date"
        break
    }
  }

  return config
}

// ─── Serializer: RRuleConfig → RRule string ───

function serializeRRule(config: RRuleConfig): string {
  const parts: string[] = [`FREQ=${config.frequency}`]

  if (config.interval > 1) {
    parts.push(`INTERVAL=${config.interval}`)
  }

  if (config.frequency === "WEEKLY" && config.byDay.size > 0) {
    parts.push(`BYDAY=${Array.from(config.byDay).join(",")}`)
  }

  if ((config.frequency === "MONTHLY" || config.frequency === "YEARLY") && config.byMonthDay !== null) {
    parts.push(`BYMONTHDAY=${config.byMonthDay}`)
  }

  if (config.endType === "count" && config.count > 0) {
    parts.push(`COUNT=${config.count}`)
  } else if (config.endType === "date" && config.untilDate) {
    parts.push(`UNTIL=${config.untilDate.replace(/-/g, "")}T235959Z`)
  }

  return parts.join(";")
}

// ─── Default Config ───

function defaultConfig(): RRuleConfig {
  return {
    frequency: "WEEKLY",
    interval: 1,
    byDay: new Set(),
    byMonthDay: null,
    endType: "never",
    count: 10,
    untilDate: "",
  }
}

// ─── Component ───

const RRuleBuilder: React.FC<RRuleBuilderProps> = ({ value, onChange, className }) => {
  const [config, setConfig] = useState<RRuleConfig>(() => {
    const parsed = parseRRule(value)
    return { ...defaultConfig(), ...parsed }
  })
  const [dirty, setDirty] = useState(false)

  // Initialize from value prop on first render
  useEffect(() => {
    if (!dirty && value) {
      const parsed = parseRRule(value)
      setConfig((prev) => ({ ...prev, ...parsed }))
    }
  }, [value, dirty])

  // Emit onChange whenever config changes (after initial sync)
  useEffect(() => {
    if (dirty || value) {
      const serialized = serializeRRule(config)
      if (serialized !== value) {
        onChange(serialized)
      }
    }
  }, [config, dirty, value, onChange])

  const update = useCallback(
    <K extends keyof RRuleConfig>(key: K, val: RRuleConfig[K]) => {
      setDirty(true)
      setConfig((prev) => ({ ...prev, [key]: val }))
    },
    []
  )

  const toggleDay = useCallback((day: (typeof DAY_KEYS)[number]) => {
    setDirty(true)
    setConfig((prev) => {
      const next = new Set(prev.byDay)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return { ...prev, byDay: next }
    })
  }, [])

  const rruleDisplay = useMemo(() => serializeRRule(config), [config])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary display */}
      <div className="rounded-[--radius-base] bg-[--surface-hover] px-3 py-2">
        <code className="text-xs font-mono text-[--primary-accent] break-all">
          {rruleDisplay || "FREQ=WEEKLY;BYDAY=MO,WE,FR"}
        </code>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs font-medium text-[--text-secondary] mb-1.5">Frequency</label>
        <div className="flex gap-1">
          {FREQUENCIES.map((freq) => (
            <motion.button
              key={freq}
              type="button"
              onClick={() => {
                update("frequency", freq)
                // Reset day/month-day specific settings when switching frequency type
                if (freq !== "WEEKLY") {
                  // Keep byDay but it only matters for WEEKLY
                }
                if (freq === "DAILY") {
                  update("byDay", new Set())
                  update("byMonthDay", null)
                }
              }}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs rounded-[--radius-base] border transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-accent]",
                config.frequency === freq
                  ? "border-[--primary-accent] bg-[--primary-accent]/15 text-[--primary-accent] font-medium"
                  : "border-[--border-subtle] text-[--text-secondary] hover:border-[--border-elevated] hover:text-[--text-primary]"
              )}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_SWIFT}
            >
              {freq.charAt(0) + freq.slice(1).toLowerCase()}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Interval */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-[--text-secondary] shrink-0">Every</label>
        <Input
          type="number"
          min={1}
          max={999}
          value={config.interval}
          onChange={(e) => update("interval", Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-16 h-8 text-xs text-center"
        />
        <span className="text-xs text-[--text-secondary]">
          {config.frequency === "DAILY" && "day(s)"}
          {config.frequency === "WEEKLY" && "week(s)"}
          {config.frequency === "MONTHLY" && "month(s)"}
          {config.frequency === "YEARLY" && "year(s)"}
        </span>
      </div>

      {/* By-Day (only show for WEEKLY) */}
      <AnimatePresence mode="wait">
        {config.frequency === "WEEKLY" && (
          <motion.div
            key="byday"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING_FLUID}
          >
            <label className="block text-xs font-medium text-[--text-secondary] mb-1.5">On days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_KEYS.map((day) => (
                <motion.button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-[--radius-base] border transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-accent]",
                    config.byDay.has(day)
                      ? "border-[--primary-accent] bg-[--primary-accent]/15 text-[--primary-accent] font-medium"
                      : "border-[--border-subtle] text-[--text-secondary] hover:border-[--border-elevated] hover:text-[--text-primary]"
                  )}
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING_SWIFT}
                >
                  {DAY_LABELS[day]}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* By-Month-Day (only for MONTHLY/YEARLY) */}
      <AnimatePresence mode="wait">
        {(config.frequency === "MONTHLY" || config.frequency === "YEARLY") && (
          <motion.div
            key="bymonthday"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING_FLUID}
          >
            <label className="block text-xs font-medium text-[--text-secondary] mb-1.5">Day of month</label>
            <Input
              type="number"
              min={1}
              max={31}
              placeholder="1"
              value={config.byMonthDay ?? ""}
              onChange={(e) =>
                update(
                  "byMonthDay",
                  e.target.value ? Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)) : null
                )
              }
              className="w-16 h-8 text-xs text-center"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* End condition */}
      <div>
        <label className="block text-xs font-medium text-[--text-secondary] mb-1.5">End</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={config.endType === "never"}
              onChange={() => update("endType", "never")}
              className="accent-[--primary-accent]"
            />
            <span className="text-xs text-[--text-primary]">Never</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={config.endType === "count"}
              onChange={() => update("endType", "count")}
              className="accent-[--primary-accent]"
            />
            <span className="text-xs text-[--text-primary]">After</span>
            <Input
              type="number"
              min={1}
              max={9999}
              value={config.count}
              onChange={(e) => update("count", Math.max(1, parseInt(e.target.value, 10) || 1))}
              disabled={config.endType !== "count"}
              className="w-16 h-7 text-xs text-center"
            />
            <span className="text-xs text-[--text-secondary]">occurrence(s)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="endType"
              checked={config.endType === "date"}
              onChange={() => update("endType", "date")}
              className="accent-[--primary-accent]"
            />
            <span className="text-xs text-[--text-primary]">By date</span>
            <Input
              type="date"
              value={config.untilDate}
              onChange={(e) => update("untilDate", e.target.value)}
              disabled={config.endType !== "date"}
              className="w-auto h-7 text-xs flex-1 min-w-[130px]"
            />
          </label>
        </div>
      </div>
    </div>
  )
}

export { RRuleBuilder }
export type { RRuleBuilderProps, Frequency, RRuleConfig }
