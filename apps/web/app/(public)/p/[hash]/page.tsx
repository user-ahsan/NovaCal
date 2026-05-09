"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Public Calendar View (/p/[hash])
//
// Read-only public calendar page that renders events from a
// cryptographically secure share link.
//
// Features:
//   - Fetches calendar data from GET /api/share/lookup/:hash
//   - Optional password challenge if the link is password-protected
//   - Expiration detection (shows "This link has expired")
//   - Clean minimal date-grouped event list
//   - No auth required — public-by-design
//
// Source: docs/05-route-map-web-mobile.md §7
//         docs/06-design-specification.md §2
//         docs/03-api-websocket-contract.md §7
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Lock, AlertTriangle, Eye } from "lucide-react";
import type { PublicCalendarData, PublicEvent } from "@novacal/shared";

// ─── Constants ───
const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Types ───
type PageState =
  | { phase: "loading" }
  | { phase: "password" }
  | { phase: "expired" }
  | { phase: "error"; message: string }
  | { phase: "not-found" }
  | { phase: "ready"; data: PublicCalendarData };

// ─── Helpers ───

/**
 * Formats an ISO-8601 string into a human-readable date header.
 * e.g., "Saturday, May 10"
 */
function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Formats an ISO-8601 string into a short time string.
 * e.g., "9:00 AM"
 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Groups events by their calendar date (YYYY-MM-DD).
 */
function groupEventsByDate(events: PublicEvent[]): Map<string, PublicEvent[]> {
  const groups = new Map<string, PublicEvent[]>();

  for (const event of events) {
    const dateKey = event.start.slice(0, 10); // "2026-05-10"
    const existing = groups.get(dateKey) ?? [];
    existing.push(event);
    groups.set(dateKey, existing);
  }

  // Sort events within each day by start time
  for (const [, dayEvents] of groups) {
    dayEvents.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }

  return groups;
}

// ─── Sub-components ───

/**
 * Password challenge form shown when a public link has password protection.
 */
function PasswordChallenge({
  hash,
  onVerified,
}: {
  hash: string;
  onVerified: (token: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);

      try {
        const res = await fetch(`/api/share/verify/${hash}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error?.message ?? "Incorrect password");
          return;
        }

        onVerified(data.tempToken as string);
      } catch {
        setError("Could not verify password. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [hash, password, onVerified],
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
        className="w-full max-w-sm"
      >
        <div className="rounded-[--radius-lg] border border-[--border-subtle] bg-[--surface-elevated] p-8 shadow-[--shadow-modal]">
          {/* Lock icon */}
          <div className="flex justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--primary-accent-muted]">
              <Lock className="h-5 w-5 text-[--primary-accent]" />
            </div>
          </div>

          <h1 className="mb-1 text-center text-xl font-semibold text-[--text-primary]">
            This calendar is password-protected
          </h1>
          <p className="mb-6 text-center text-sm text-[--text-secondary]">
            Enter the password to view this shared calendar.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="share-password" className="sr-only">
                Password
              </label>
              <input
                id="share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full rounded-[--radius-base] border border-[--border-subtle] bg-[--background] px-3 py-2.5 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--primary-accent] focus:outline-none focus:ring-1 focus:ring-[--primary-accent]"
              />
            </div>

            {error && (
              <p className="text-xs text-[--destructive]">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full rounded-[--radius-base] bg-[--primary-accent] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Verifying…" : "View Calendar"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Expired link state.
 */
function ExpiredState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
        className="max-w-sm text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-[--destructive]" />
          </div>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-[--text-primary]">
          This link has expired
        </h1>
        <p className="mb-6 text-sm text-[--text-secondary]">
          The shared calendar link you&apos;re trying to access is no longer
          available. Please ask the owner to generate a new share link.
        </p>
      </motion.div>
    </div>
  );
}

/**
 * Error state for when the link is invalid.
 */
function NotFoundState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-6">
      <div className="max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold text-[--text-primary]">
          Share link not found
        </h1>
        <p className="text-sm text-[--text-secondary]">
          This share link doesn&apos;t exist or has been revoked.
        </p>
      </div>
    </div>
  );
}

/**
 * Single event card rendered in the public calendar list.
 */
function EventCard({ event }: { event: PublicEvent }) {
  const accentColor = event.color ?? "#6366F1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 250, damping: 25 }}
      className="group rounded-[--radius-base] border border-[--border-subtle] bg-[--surface-elevated] p-4 transition-colors hover:border-[--border-elevated]"
    >
      <div className="flex items-start gap-3">
        {/* Color accent bar */}
        <div
          className="mt-0.5 h-full min-h-[3rem] w-1 shrink-0 rounded-full"
          style={{ backgroundColor: accentColor }}
        />

        <div className="flex-1 min-w-0">
          {/* Time */}
          <p className="font-mono text-xs font-medium text-[--primary-accent]">
            {formatTime(event.start)} – {formatTime(event.end)}
          </p>

          {/* Title */}
          <h3 className="mt-0.5 text-sm font-semibold text-[--text-primary] truncate">
            {event.title}
          </h3>

          {/* Location */}
          {event.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-[--text-secondary]">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───

export default function PublicCalendarPage() {
  const params = useParams();
  const hash = params.hash as string;

  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // ── Data Fetching ──
  const fetchCalendar = useCallback(async () => {
    setState({ phase: "loading" });

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) {
        headers["X-Access-Token"] = accessToken;
      }

      const res = await fetch(`/api/share/lookup/${hash}`, { headers });

      if (res.status === 404) {
        setState({ phase: "not-found" });
        return;
      }

      if (res.status === 401) {
        setState({ phase: "password" });
        return;
      }

      if (res.status === 410) {
        setState({ phase: "expired" });
        return;
      }

      if (!res.ok) {
        setState({ phase: "error", message: "Failed to load calendar data" });
        return;
      }

      const data = (await res.json()) as PublicCalendarData;
      setState({ phase: "ready", data });
    } catch {
      // Fallback: attempt inline rendering from mock data
      // This allows the page to work even if the API is not yet built.
      setState({
        phase: "error",
        message: "Unable to connect to the server. Please try again later.",
      });
    }
  }, [hash, accessToken]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // ── Password verified ──
  const handlePasswordVerified = useCallback((token: string) => {
    setAccessToken(token);
  }, []);

  // Trigger re-fetch once we have the access token
  useEffect(() => {
    if (accessToken) {
      fetchCalendar();
    }
  }, [accessToken, fetchCalendar]);

  // ── Render by State ──

  // Loading
  if (state.phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--background]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[--surface-elevated]">
            <motion.div
              className="h-full rounded-full bg-[--primary-accent]"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                ease: "easeInOut",
              }}
            />
          </div>
          <p className="text-xs text-[--text-muted]">Loading calendar…</p>
        </div>
      </div>
    );
  }

  // Password challenge
  if (state.phase === "password") {
    return <PasswordChallenge hash={hash} onVerified={handlePasswordVerified} />;
  }

  // Expired
  if (state.phase === "expired") {
    return <ExpiredState />;
  }

  // Not found
  if (state.phase === "not-found") {
    return <NotFoundState />;
  }

  // Error
  if (state.phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--background] px-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-xl font-semibold text-[--text-primary]">
            Something went wrong
          </h1>
          <p className="mb-6 text-sm text-[--text-secondary]">
            {state.message}
          </p>
          <button
            type="button"
            onClick={fetchCalendar}
            className="rounded-[--radius-base] bg-[--primary-accent] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Ready: Render Calendar ──
  const { data } = state;
  const eventGroups = groupEventsByDate(data.events);
  const sortedDates = Array.from(eventGroups.keys()).sort();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Calendar header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
        className="mb-8 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Eye className="h-4 w-4 text-[--text-muted]" />
          <span className="text-xs font-medium uppercase tracking-wider text-[--text-muted]">
            Shared Calendar
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-[--text-primary]">
          {data.calendar.name}
        </h1>
        {data.calendar.description && (
          <p className="mt-1 text-sm text-[--text-secondary]">
            {data.calendar.description}
          </p>
        )}
      </motion.div>

      {/* Event list */}
      {sortedDates.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[--text-muted]">
            No events in this calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((dateKey) => {
            const dayEvents = eventGroups.get(dateKey)!;
            const firstEvent = dayEvents[0]!;

            return (
              <motion.section
                key={dateKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: "spring", stiffness: 250, damping: 25 }}
              >
                {/* Date header */}
                <h2 className="mb-3 text-sm font-semibold text-[--text-primary]">
                  {formatDateHeader(firstEvent.start)}
                </h2>

                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </motion.section>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 border-t border-[--border-subtle] pt-6 text-center">
        <p className="text-xs text-[--text-muted]">
          Powered by{" "}
          <Link
            href="/"
            className="text-[--primary-accent] hover:underline"
          >
            NovaCal
          </Link>
        </p>
      </div>
    </div>
  );
}
