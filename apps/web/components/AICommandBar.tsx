"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@novacal/ui"
import { Skeleton } from "@novacal/ui"
import { cn } from "@novacal/ui/lib/utils"
import { TRANSITION_ENTER, TRANSITION_EXIT } from "@novacal/shared"
import { Sparkles, CornerDownLeft } from "lucide-react"

// ─── Types ───

interface AICommandBarProps {
  /** Called when the user submits natural language text to the MCP server */
  onSubmit: (text: string) => Promise<void> | void
  /** Placeholder text in the input field */
  placeholder?: string
  /** Optional className for styling */
  className?: string
  /** Whether the command bar is disabled */
  disabled?: boolean
}

interface Suggestion {
  id: string
  label: string
  icon?: React.ReactNode
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { id: "create-event", label: "Schedule a meeting tomorrow at 2pm" },
  { id: "find-time", label: "Find common free time this week" },
  { id: "search", label: "Search for 'design review' events" },
  { id: "agenda", label: "Show my agenda for today" },
]

// ─── Component ───

const AICommandBar: React.FC<AICommandBarProps> = ({
  onSubmit,
  placeholder = "Ask AI to schedule, search, or manage your calendar…",
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Keyboard shortcut: Cmd+K / Ctrl+K to toggle ───

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        if (!disabled) {
          setIsOpen((prev) => !prev)
        }
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [disabled, isOpen])

  // ─── Focus input when opened ───

  useEffect(() => {
    if (isOpen) {
      // Small delay to let the animation start before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setQuery("")
      setFilteredSuggestions(DEFAULT_SUGGESTIONS)
    }
  }, [isOpen])

  // ─── Filter suggestions as user types ───

  useEffect(() => {
    if (!query.trim()) {
      setFilteredSuggestions(DEFAULT_SUGGESTIONS)
      return
    }

    const lower = query.toLowerCase()
    setFilteredSuggestions(
      DEFAULT_SUGGESTIONS.filter((s) => s.label.toLowerCase().includes(lower))
    )
  }, [query])

  // ─── Handle submit ───

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessing) return
      setIsProcessing(true)

      try {
        await onSubmit(text.trim())
      } finally {
        setIsProcessing(false)
        setIsOpen(false)
        setQuery("")
      }
    },
    [onSubmit, isProcessing]
  )

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      handleSubmit(suggestion.label)
    },
    [handleSubmit]
  )

  // ─── Click outside to close ───

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {/* Sticky bottom bar — always visible trigger */}
      <motion.button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-[--radius-lg] border border-[--border-subtle] bg-[--surface-elevated] px-4 py-3 text-sm text-[--text-muted] transition-none",
          "hover:border-[--primary-accent]/40 hover:text-[--text-secondary]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-accent]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        whileHover={!disabled ? { scale: 1.01, borderColor: "rgba(99, 102, 241, 0.4)" } : undefined}
        whileTap={!disabled ? { scale: 0.99 } : undefined}
        transition={TRANSITION_ENTER}
        aria-label="Open AI command bar"
      >
        <Sparkles className="h-4 w-4 text-[--primary-accent] shrink-0" />
        <span className="flex-1 text-left truncate">{placeholder}</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded-[--radius-base] border border-[--border-subtle] bg-[--surface] px-1.5 py-0.5 text-[10px] font-medium text-[--text-muted]">
          <span className="text-xs">⌘</span>K
        </kbd>
      </motion.button>

      {/* ─── Command Palette Overlay ─── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[24px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />

            {/* Command palette */}
            <motion.div
              className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2"
              initial={{ scale: 0.95, y: -10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: -10, opacity: 0 }}
              transition={TRANSITION_ENTER}
            >
              <Command
                className="border border-[--border-elevated] shadow-[--shadow-modal]"
                shouldFilter={false}
              >
                <CommandInput
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  placeholder={placeholder}
                  disabled={isProcessing}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" && query.trim()) {
                      e.preventDefault()
                      handleSubmit(query)
                    }
                  }}
                />

                <CommandList>
                  {isProcessing ? (
                    /* Skeleton shimmer while MCP is processing */
                    <div className="p-3 space-y-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : (
                    <>
                      <CommandEmpty className="py-6 text-sm text-[--text-muted]">
                        No matching commands
                      </CommandEmpty>

                      <CommandGroup heading="Suggestions">
                        {filteredSuggestions.map((suggestion) => (
                          <CommandItem
                            key={suggestion.id}
                            onSelect={() => handleSuggestionClick(suggestion)}
                            className="group cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-[--primary-accent] mr-2 shrink-0" />
                            <span className="flex-1 text-sm">{suggestion.label}</span>
                            <kbd className="hidden group-hover:inline-flex items-center gap-0.5 text-[10px] text-[--text-muted]">
                              <CornerDownLeft className="h-3 w-3" />
                            </kbd>
                          </CommandItem>
                        ))}
                      </CommandGroup>

                      {query.trim() && (
                        <CommandGroup heading="Actions">
                          <CommandItem
                            onSelect={() => handleSubmit(query)}
                            className="group cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-[--primary-accent] mr-2 shrink-0" />
                            <span className="flex-1 text-sm">
                              Send: <span className="font-medium">&ldquo;{query}&rdquo;</span>
                            </span>
                            <kbd className="hidden group-hover:inline-flex items-center gap-0.5 text-[10px] text-[--text-muted]">
                              ⏎
                            </kbd>
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export { AICommandBar }
export type { AICommandBarProps }
