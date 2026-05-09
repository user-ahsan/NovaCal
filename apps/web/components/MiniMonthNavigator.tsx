"use client"

import React, { useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@novacal/ui/lib/utils"
import { Button } from "@novacal/ui"
import { SPRING_SWIFT, DEFAULT_START_OF_WEEK } from "@novacal/shared"

// ─── Types ───

interface MiniMonthNavigatorProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  minDate?: Date
  maxDate?: Date
  className?: string
}

const DAY_NAMES_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// ─── Helpers ───

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function getMonthGrid(year: number, month: number, startOfWeek: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Adjust first day index based on startOfWeek (1 = Monday in our system)
  let firstDow = firstDay.getDay() // 0=Sun, 1=Mon, ...
  // Convert so that startOfWeek=1 (Monday) maps day 0 (Sun) to position 6
  const offset = (firstDow - startOfWeek + 7) % 7

  const days: Date[] = []

  // Fill leading blanks from previous month
  for (let i = offset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push(d)
  }

  // Fill current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }

  // Fill trailing blanks (to complete the last row)
  const remaining = 7 - (days.length % 7 === 0 ? 7 : days.length % 7)
  for (let d = 1; d <= (remaining === 7 ? 0 : remaining); d++) {
    days.push(new Date(year, month + 1, d))
  }

  return days
}

// ─── Component ───

const MiniMonthNavigator: React.FC<MiniMonthNavigatorProps> = ({
  selectedDate,
  onDateSelect,
  minDate,
  maxDate,
  className,
}) => {
  const [viewYear, setViewYear] = React.useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = React.useState(selectedDate.getMonth())

  // Sync view to selectedDate when it changes externally
  React.useEffect(() => {
    setViewYear(selectedDate.getFullYear())
    setViewMonth(selectedDate.getMonth())
  }, [selectedDate])

  const days = useMemo(
    () => getMonthGrid(viewYear, viewMonth, DEFAULT_START_OF_WEEK),
    [viewYear, viewMonth]
  )

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }, [viewMonth])

  const goToNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }, [viewMonth])

  const isDisabled = useCallback(
    (date: Date) => {
      if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true
      if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true
      return false
    },
    [minDate, maxDate]
  )

  const handleDateClick = useCallback(
    (date: Date) => {
      if (isDisabled(date)) return
      onDateSelect(date)
    },
    [onDateSelect, isDisabled]
  )

  // Split days into weeks
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  return (
    <div className={cn("select-none", className)}>
      {/* Month/year header with navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[--text-muted] hover:text-[--text-primary]"
          onClick={goToPrevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-xs font-semibold text-[--text-primary] tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[--text-muted] hover:text-[--text-primary]"
          onClick={goToNextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAY_NAMES_SHORT.map((name) => (
          <div
            key={name}
            className="text-center text-[10px] font-medium text-[--text-muted] uppercase tracking-wider py-1"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0">
        {days.map((date, i) => {
          const isCurrentMonth = date.getMonth() === viewMonth
          const isSelected = isSameDay(date, selectedDate)
          const today = isToday(date)
          const disabled = isDisabled(date)

          return (
            <motion.button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => handleDateClick(date)}
              className={cn(
                "relative flex items-center justify-center h-7 w-full text-xs rounded-[--radius-base] transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-accent] focus-visible:ring-offset-1 focus-visible:ring-offset-[--background]",
                isSelected && "bg-[--primary-accent] text-white font-semibold",
                !isSelected &&
                  isCurrentMonth &&
                  !disabled &&
                  "text-[--text-primary] hover:bg-[--ghost-hover]",
                !isSelected &&
                  !isCurrentMonth &&
                  !disabled &&
                  "text-[--text-muted] hover:bg-[--ghost-hover]",
                disabled && "opacity-30 cursor-not-allowed"
              )}
              whileTap={!disabled ? { scale: 0.9 } : undefined}
              transition={SPRING_SWIFT}
              aria-label={date.toLocaleDateString()}
            >
              {date.getDate()}
              {today && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-1.5 rounded-full bg-[--primary-accent]" />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export { MiniMonthNavigator }
export type { MiniMonthNavigatorProps }
