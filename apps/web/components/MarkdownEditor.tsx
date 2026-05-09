"use client"

import React, { useCallback, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { Textarea } from "@novacal/ui"
import { cn } from "@novacal/ui/lib/utils"
import { SPRING_SWIFT } from "@novacal/shared"

// ─── Types ───

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onAIFormat?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  minHeight?: number
  maxHeight?: number
}

// ─── Simple Markdown Syntax Highlighter ───
// Splits text into tokens and determines rendering style per token.
// This is a lightweight approach — for production consider `marked` + `react-markdown`.

interface MarkdownToken {
  type:
    | "heading1"
    | "heading2"
    | "heading3"
    | "bold"
    | "italic"
    | "strikethrough"
    | "code"
    | "codeBlock"
    | "link"
    | "list"
    | "blockquote"
    | "hr"
    | "plain"
  text: string
}

function tokenizeMarkdown(text: string): MarkdownToken[] {
  const tokens: MarkdownToken[] = []
  const lines = text.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Empty line
    if (!line.trim()) {
      tokens.push({ type: "plain", text: "\n" })
      continue
    }

    // HR — three or more dashes/asterisks
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      tokens.push({ type: "hr", text: line })
      tokens.push({ type: "plain", text: "\n" })
      continue
    }

    // Heading 1-3
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1]!.length as 1 | 2 | 3
      const type = level === 1 ? "heading1" : level === 2 ? "heading2" : "heading3"
      tokens.push({ type, text: headingMatch[2]! })
      tokens.push({ type: "plain", text: "\n" })
      continue
    }

    // Blockquote
    if (line.startsWith("> ")) {
      tokens.push({ type: "blockquote", text: line.slice(2) })
      tokens.push({ type: "plain", text: "\n" })
      continue
    }

    // List item
    if (/^(\s*)[-*+]\s/.test(line) || /^(\s*)\d+\.\s/.test(line)) {
      tokens.push({ type: "list", text: line })
      tokens.push({ type: "plain", text: "\n" })
      continue
    }

    // Inline code block
    if (/^```/.test(line)) {
      let codeContent = ""
      i++
      while (i < lines.length && !/^```/.test(lines[i]!)) {
        codeContent += lines[i] + "\n"
        i++
      }
      tokens.push({ type: "codeBlock", text: codeContent.trimEnd() })
      if (i < lines.length) {
        // skip closing ```
      }
      tokens.push({ type: "plain", text: "\n" })
      continue
    }

    // Process inline elements in the line
    let remaining = line
    while (remaining) {
      // Bold (**text**)
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      // Italic (*text*)
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
      // Strikethrough (~~text~~)
      const strikeMatch = remaining.match(/~~(.+?)~~/)
      // Inline code (`text`)
      const codeMatch = remaining.match(/`(.+?)`/)
      // Link [text](url)
      const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/)

      // Find the earliest match
      const matches = [
        { m: codeMatch, type: "code" as const },
        { m: linkMatch, type: "link" as const },
        { m: boldMatch, type: "bold" as const },
        { m: strikeMatch, type: "strikethrough" as const },
        { m: italicMatch, type: "italic" as const },
      ]
        .filter(({ m }) => m)
        .sort((a, b) => (a.m?.index ?? Infinity) - (b.m?.index ?? Infinity))

      if (matches.length === 0) {
        tokens.push({ type: "plain", text: remaining })
        break
      }

      const { m, type } = matches[0]!

      // Text before match
      if (m!.index! > 0) {
        tokens.push({ type: "plain", text: remaining.slice(0, m!.index) })
      }

      if (type === "link" && linkMatch) {
        tokens.push({ type: "link", text: linkMatch[1]! })
      } else {
        tokens.push({ type, text: m![1]! })
      }

      remaining = remaining.slice(m!.index! + m![0].length)
    }
  }

  return tokens
}

// ─── Token Style Map ───

const TOKEN_STYLES: Record<MarkdownToken["type"], string> = {
  heading1: "block text-xl font-bold text-[--text-primary] mt-2 mb-1",
  heading2: "block text-lg font-semibold text-[--text-primary] mt-1.5 mb-0.5",
  heading3: "block text-base font-semibold text-[--text-primary] mt-1 mb-0.5",
  bold: "font-bold text-[--text-primary]",
  italic: "italic text-[--text-primary]",
  strikethrough: "line-through text-[--text-muted]",
  code: "font-mono text-xs bg-[--surface-hover] px-1 py-0.5 rounded-[--radius-base] text-[--primary-accent]",
  codeBlock:
    "block font-mono text-xs bg-[--surface-hover] p-3 rounded-[--radius-lg] text-[--text-primary] whitespace-pre my-1 border border-[--border-elevated]",
  link: "text-[--primary-accent] underline underline-offset-2 cursor-pointer",
  list: "block text-sm text-[--text-primary] ml-4",
  blockquote: "block text-sm text-[--text-secondary] italic border-l-2 border-[--border-subtle] pl-3 my-1",
  hr: "block border-t border-[--border-elevated] my-2",
  plain: "text-sm text-[--text-primary]",
}

// ─── Component ───

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onAIFormat,
  placeholder = "Description…",
  className,
  disabled = false,
  minHeight = 120,
  maxHeight = 400,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPreview, setShowPreview] = useState(false)

  const tokens = React.useMemo(() => tokenizeMarkdown(value), [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab inserts 2 spaces
      if (e.key === "Tab") {
        e.preventDefault()
        const ta = textareaRef.current
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const newValue = value.slice(0, start) + "  " + value.slice(end)
        onChange(newValue)
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2
        })
      }
    },
    [value, onChange]
  )

  return (
    <div className={cn("relative flex flex-col", className)}>
      {/* Toggle: edit / preview */}
      <div className="flex items-center justify-end gap-2 mb-1">
        <button
          type="button"
          onClick={() => setShowPreview(false)}
          className={cn(
            "text-xs transition-none rounded-[--radius-base] px-2 py-0.5",
            !showPreview
              ? "bg-[--primary-accent]/20 text-[--primary-accent]"
              : "text-[--text-muted] hover:text-[--text-secondary]"
          )}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className={cn(
            "text-xs transition-none rounded-[--radius-base] px-2 py-0.5",
            showPreview
              ? "bg-[--primary-accent]/20 text-[--primary-accent]"
              : "text-[--text-muted] hover:text-[--text-secondary]"
          )}
        >
          Preview
        </button>
      </div>

      {/* Editor */}
      <div
        className="relative"
        style={{ minHeight, maxHeight }}
      >
        {showPreview ? (
          /* Live markdown preview */
          <div
            className={cn(
              "w-full h-full overflow-y-auto rounded-[--radius-base] border border-[--border-subtle] bg-transparent px-3 py-2 transition-none",
              "focus-visible:outline-none"
            )}
            style={{ minHeight }}
          >
            {tokens.length === 0 || (tokens.length === 1 && tokens[0]?.text === "\n") ? (
              <span className="text-sm text-[--text-muted]">{placeholder}</span>
            ) : (
              tokens.map((token, i) => (
                <span key={i} className={TOKEN_STYLES[token.type]}>
                  {token.text}
                </span>
              ))
            )}
          </div>
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "resize-y min-h-[80px] border-0 bg-transparent p-0 text-sm text-[--text-primary]",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-[--text-muted]",
              "scrollbar-thin"
            )}
            style={{ minHeight, maxHeight }}
          />
        )}

        {/* AI Sparkle Button — bottom-right, glowing gradient */}
        {onAIFormat && !disabled && (
          <motion.button
            type="button"
            onClick={onAIFormat}
            className={cn(
              "absolute bottom-2 right-2 flex items-center justify-center",
              "h-8 w-8 rounded-full",
              "bg-gradient-to-br from-[--primary-accent] via-purple-500 to-pink-500",
              "text-white shadow-lg",
              "focus:outline-none focus:ring-2 focus:ring-[--primary-accent] focus:ring-offset-2 focus:ring-offset-[--background]"
            )}
            whileHover={{ scale: 1.1, boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING_SWIFT}
            title="AI Format"
          >
            <Sparkles className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  )
}

export { MarkdownEditor }
export type { MarkdownEditorProps }
