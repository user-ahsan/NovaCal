"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@novacal/ui/lib/utils";
import { Copy, Check } from "lucide-react";

// ─── Types ───
interface CodeBlockCopyProps {
  /** The source code or configuration text to display. */
  code: string;
  /** Language label for syntax identification (e.g., "json", "typescript"). */
  language?: string;
}

// ─── Component ───
/**
 * A monospace code block with a copy-to-clipboard button.
 *
 * - Copy icon animates with a quick pop `scale: [1, 1.2, 1]` (200ms).
 * - On success the icon swaps from Copy to Checkmark for 2s.
 * - Uses JetBrains Mono (project standard for monospace).
 */
export function CodeBlockCopy({ code, language }: CodeBlockCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      // Reset icon after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in insecure contexts — silently ignore
    }
  }, [code]);

  return (
    <div className="relative group rounded-[--radius-base] overflow-hidden border border-[--border-subtle] bg-[--surface-elevated]">
      {/* Language badge & copy button header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[--border-subtle] bg-[--surface]">
        {language ? (
          <span className="text-xs font-mono text-[--text-muted] uppercase tracking-wide">
            {language}
          </span>
        ) : (
          <span />
        )}

        {/* Copy button */}
        <motion.button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded",
            "transition-none",
            copied
              ? "text-[--success]"
              : "text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--ghost-hover]",
          )}
          whileTap={{ scale: 0.95 }}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          <motion.span
            key={copied ? "check" : "copy"}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </motion.span>
          <span>{copied ? "Copied" : "Copy"}</span>
        </motion.button>
      </div>

      {/* Code content */}
      <pre className="p-4 overflow-x-auto">
        <code
          className="text-sm leading-relaxed font-mono text-[--text-primary] whitespace-pre"
          style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}
