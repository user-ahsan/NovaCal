"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Global Error Boundary
//
// Catches unhandled errors in the React tree and displays a
// developer-friendly error page with:
//   - Error type detection (API, Auth, Network, Render)
//   - Collapsible stack trace for debugging
//   - "Reload" button to recover
//   - Red accent styling for error states
//
// Source: docs/05-route-map-web-mobile.md §8
//         docs/06-design-specification.md
//         AGENTS.md Rule 25 (error boundaries)
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";

// ─── Error Categories ───

type ErrorCategory =
  | "NETWORK"
  | "API"
  | "AUTH"
  | "RENDER"
  | "UNKNOWN";

function categorizeError(error: Error): ErrorCategory {
  const msg = error.message.toLowerCase();

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("abort")
  ) {
    return "NETWORK";
  }

  if (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("session") ||
    msg.includes("token")
  ) {
    return "AUTH";
  }

  if (
    msg.includes("api") ||
    msg.includes("400") ||
    msg.includes("403") ||
    msg.includes("404") ||
    msg.includes("500")
  ) {
    return "API";
  }

  if (
    msg.includes("cannot read") ||
    msg.includes("undefined") ||
    msg.includes("null") ||
    msg.includes("typeerror") ||
    msg.includes("referenceerror")
  ) {
    return "RENDER";
  }

  return "UNKNOWN";
}

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  NETWORK: "Network Error",
  API: "API Error",
  AUTH: "Authentication Error",
  RENDER: "Render Error",
  UNKNOWN: "Unexpected Error",
};

// ─── Types ───

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// ─── Component ───

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [stackExpanded, setStackExpanded] = useState(false);
  const category = categorizeError(error);

  // Log the error for observability
  useEffect(() => {
    console.error("[NovaCal Error Boundary]", {
      category,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error, category]);

  // ── Helper: Clean stack trace ──
  // Strips webpack/next.js internal frames for readability
  const cleanStack = (stack: string | undefined): string[] => {
    if (!stack) return ["No stack trace available."];
    return stack
      .split("\n")
      .filter(
        (line) =>
          !line.includes("node_modules") &&
          !line.includes("webpack") &&
          !line.includes("next/dist") &&
          !line.includes("(<anonymous>)") &&
          line.trim() !== "" &&
          !line.includes("Error:"),
      )
      .slice(0, 15);
  };

  const stackLines = cleanStack(error.stack);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
        className="w-full max-w-lg"
      >
        {/* Error card */}
        <div className="rounded-[--radius-lg] border border-[--border-subtle] bg-[--surface-elevated] p-8 shadow-[--shadow-modal]">
          {/* Error category badge */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-[--destructive]" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-[--destructive]">
                {CATEGORY_LABELS[category]}
              </p>
              <p className="text-xs text-[--text-muted]">
                {error.digest
                  ? `Error ID: ${error.digest}`
                  : "An unexpected error occurred"}
              </p>
            </div>
          </div>

          {/* Main message */}
          <h1 className="text-lg font-semibold text-[--text-primary]">
            Something broke.
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Here&apos;s what happened:
          </p>

          {/* Error message */}
          <div className="mt-4 rounded-[--radius-base] border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="font-mono text-xs leading-relaxed text-[--destructive]">
              {error.message || "No error message available"}
            </p>
          </div>

          {/* Collapsible stack trace */}
          {stackLines.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setStackExpanded((prev) => !prev)}
                className="flex items-center gap-2 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary] transition-colors"
              >
                <motion.div
                  animate={{ rotate: stackExpanded ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  <ChevronDown className="h-3 w-3" />
                </motion.div>
                {stackExpanded ? "Hide details" : "Show details"}
              </button>

              <AnimatePresence>
                {stackExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    className="mt-2 overflow-hidden"
                  >
                    <pre className="overflow-auto rounded-[--radius-base] border border-[--border-subtle] bg-[--surface] p-4 font-mono text-xs leading-relaxed text-[--text-secondary]">
                      {stackLines.map((line, i) => (
                        <div key={i} className="whitespace-nowrap">
                          {line}
                        </div>
                      ))}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-[--radius-base] bg-[--primary-accent] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </button>

            <Link
              href="/calendar"
              className="inline-flex items-center justify-center rounded-[--radius-base] border border-[--border-subtle] bg-transparent px-5 py-2.5 text-sm font-medium text-[--text-primary] transition-colors hover:bg-[--ghost-hover]"
            >
              Go to Calendar
            </Link>
          </div>
        </div>

        {/* Prompt for users to report the error */}
        <p className="mt-4 text-center text-xs text-[--text-muted]">
          If this keeps happening, please share the error ID with your
          instance administrator.
        </p>
      </motion.div>
    </div>
  );
}
