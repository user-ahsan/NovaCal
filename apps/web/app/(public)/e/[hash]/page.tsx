"use client";

// ═══════════════════════════════════════════════════════════════
// NovaCal — Single Event Landing Page (/e/[hash])
//
// Standalone shareable page for a single event.
// Shows: title, time, description, location, attendee list.
// "Add to Calendar" button generates a downloadable .ics file.
//
// Features:
//   - Fetches event data from GET /api/e/:hash
//   - Clean minimal layout — no sidebar, no nav
//   - .ics download with proper VCALENDAR formatting
//   - No auth required — public-by-design
//
// Source: docs/05-route-map-web-mobile.md §7
//         docs/06-design-specification.md
//         docs/03-api-websocket-contract.md §7
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Users,
  Download,
  AlertTriangle,
} from "lucide-react";
import type { PublicEventDetail } from "@novacal/shared";

// ─── Types ───
type PageState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "not-found" }
  | { phase: "ready"; data: PublicEventDetail };

// ─── Helpers ───

/**
 * Formats an ISO-8601 string to a human-readable date/time string.
 * e.g., "Saturday, May 10, 2026 at 9:00 AM"
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Formats an ISO-8601 string to a short time string.
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
 * Formats an ISO-8601 string to a date-only string.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Generates a downloadable .ics file content for the given event.
 * Follows the iCalendar RFC 5545 specification.
 */
function generateICS(event: PublicEventDetail["event"]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${event.id}@novacal`;

  const startFormatted = event.start
    .replace(/[-:]/g, "")
    .split(".")[0] + "Z";
  const endFormatted = event.end
    .replace(/[-:]/g, "")
    .split(".")[0] + "Z";

  const escapedDescription = (event.description ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

  const escapedLocation = (event.location ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NovaCal//NovaCal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${startFormatted}`,
    `DTEND:${endFormatted}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${escapedDescription}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapedLocation}`);
  }

  // Add attendees
  for (const attendee of event.attendees) {
    lines.push(
      `ATTENDEE;CN=${attendee.name};PARTSTAT=${attendee.response}:mailto:${attendee.email}`,
    );
  }

  lines.push(`DTSTAMP:${now}`);
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

/**
 * Triggers a browser download of the .ics file.
 */
function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───

/**
 * Loading skeleton for the event detail page.
 */
function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="space-y-4">
        <div className="skeleton-shimmer h-8 w-3/4 rounded-[--radius-base]" />
        <div className="skeleton-shimmer h-4 w-1/2 rounded-[--radius-base]" />
        <div className="skeleton-shimmer h-24 w-full rounded-[--radius-base]" />
        <div className="skeleton-shimmer h-4 w-1/3 rounded-[--radius-base]" />
      </div>
    </div>
  );
}

/**
 * Attendee badge showing their name, email, and RSVP status.
 */
function AttendeeBadge({
  attendee,
}: {
  attendee: {
    name: string;
    email: string;
    response: string;
  };
}) {
  const statusColors: Record<string, string> = {
    ACCEPTED: "text-[--success]",
    DECLINED: "text-[--destructive]",
    TENTATIVE: "text-[--warning]",
    PENDING: "text-[--text-muted]",
  };

  const statusLabel: Record<string, string> = {
    ACCEPTED: "Accepted",
    DECLINED: "Declined",
    TENTATIVE: "Maybe",
    PENDING: "Pending",
  };

  return (
    <div className="flex items-center gap-3 rounded-[--radius-base] border border-[--border-subtle] bg-[--surface] px-3 py-2">
      {/* Avatar placeholder */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[--surface-elevated] text-xs font-semibold text-[--text-secondary]">
        {attendee.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[--text-primary] truncate">
          {attendee.name}
        </p>
        <p className="text-xs text-[--text-muted] truncate">
          {attendee.email}
        </p>
      </div>

      <span
        className={`shrink-0 text-xs font-medium ${
          statusColors[attendee.response] ?? "text-[--text-muted]"
        }`}
      >
        {statusLabel[attendee.response] ?? attendee.response}
      </span>
    </div>
  );
}

// ─── Main Component ───

export default function SingleEventPage() {
  const params = useParams();
  const hash = params.hash as string;

  const [state, setState] = useState<PageState>({ phase: "loading" });

  // ── Data Fetching ──
  const fetchEvent = useCallback(async () => {
    setState({ phase: "loading" });

    try {
      const res = await fetch(`/api/e/${hash}`);

      if (res.status === 404) {
        setState({ phase: "not-found" });
        return;
      }

      if (!res.ok) {
        setState({ phase: "error", message: "Failed to load event" });
        return;
      }

      const data = (await res.json()) as PublicEventDetail;
      setState({ phase: "ready", data });
    } catch {
      setState({
        phase: "error",
        message: "Unable to connect to the server. Please try again later.",
      });
    }
  }, [hash]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // ── ICS Download ──
  const icsContent = useMemo(() => {
    if (state.phase !== "ready") return "";
    return generateICS(state.data.event);
  }, [state]);

  const handleDownloadICS = useCallback(() => {
    if (state.phase !== "ready") return;
    const safeName = state.data.event.title.replace(/[^a-zA-Z0-9]/g, "_");
    downloadICS(icsContent, `${safeName}.ics`);
  }, [state, icsContent]);

  // ── Render by State ──

  // Loading
  if (state.phase === "loading") {
    return (
      <div className="min-h-screen bg-[--background]">
        <LoadingSkeleton />
      </div>
    );
  }

  // Not found
  if (state.phase === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--background] px-6">
        <div className="max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-[--destructive]" />
            </div>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-[--text-primary]">
            Event not found
          </h1>
          <p className="text-sm text-[--text-secondary]">
            This event doesn&apos;t exist or the share link has been revoked.
          </p>
        </div>
      </div>
    );
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
            onClick={fetchEvent}
            className="rounded-[--radius-base] bg-[--primary-accent] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Ready: Render Event ──
  const { event } = state.data.event;
  const isAllDay = event.isAllDay;
  const sameDay =
    event.start.slice(0, 10) === event.end.slice(0, 10);

  return (
    <div className="min-h-screen bg-[--background]">
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 lg:py-20">
        {/* Breadcrumb hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
          className="mb-6 text-xs text-[--text-muted]"
        >
          Shared event
        </motion.p>

        {/* Event card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
          className="rounded-[--radius-lg] border border-[--border-subtle] bg-[--surface-elevated] p-6 shadow-[--shadow-modal] sm:p-8"
        >
          {/* Title */}
          <h1 className="text-2xl font-semibold text-[--text-primary] sm:text-3xl">
            {event.title}
          </h1>

          {/* Meta info */}
          <div className="mt-6 space-y-3">
            {/* Date/time */}
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[--primary-accent]" />
              <div>
                {isAllDay ? (
                  <p className="text-sm text-[--text-primary]">
                    {formatDate(event.start)}
                  </p>
                ) : sameDay ? (
                  <div>
                    <p className="text-sm text-[--text-primary]">
                      {formatDate(event.start)}
                    </p>
                    <p className="text-sm font-mono text-[--text-secondary]">
                      {formatTime(event.start)} – {formatTime(event.end)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-[--text-primary]">
                      Starts: {formatDateTime(event.start)}
                    </p>
                    <p className="text-sm text-[--text-primary]">
                      Ends: {formatDateTime(event.end)}
                    </p>
                  </div>
                )}
                {event.timezone && (
                  <p className="mt-0.5 text-xs text-[--text-muted]">
                    Timezone: {event.timezone}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[--primary-accent]" />
                <p className="text-sm text-[--text-primary]">
                  {event.location}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mt-6 border-t border-[--border-subtle] pt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                Description
              </h2>
              <div className="prose prose-sm prose-invert max-w-none text-[--text-secondary]">
                {event.description.split("\n").map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees.length > 0 && (
            <div className="mt-6 border-t border-[--border-subtle] pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-[--primary-accent]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                  Attendees ({event.attendees.length})
                </h2>
              </div>

              <div className="space-y-2">
                {event.attendees.map((attendee) => (
                  <AttendeeBadge key={attendee.id} attendee={attendee} />
                ))}
              </div>
            </div>
          )}

          {/* Created by */}
          {event.createdBy && (
            <p className="mt-6 text-xs text-[--text-muted]">
              Created by {event.createdBy.name}
            </p>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadICS}
              className="inline-flex items-center justify-center gap-2 rounded-[--radius-base] bg-[--primary-accent] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Add to Calendar
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-8 text-center">
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
    </div>
  );
}
