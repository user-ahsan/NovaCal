// ─── Tool: get_upcoming_events ───
// Fast summary of upcoming events for the next N days.
// Ideal for "What's on my calendar today?" queries.
// RBAC: VIEWER minimum.

import { z } from "zod";
import { and, gte, lte, eq, sql, inArray } from "drizzle-orm";
import { db } from "@novacal/db";
import { events, calendars } from "@novacal/db/schema";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const GetUpcomingEventsSchema = z.object({
  days: z
    .number()
    .min(1)
    .max(365)
    .optional()
    .default(1)
    .describe("Number of days to look ahead (default: 1)"),
  workspaceId: z
    .string()
    .optional()
    .describe("Filter by workspace"),
});

export type GetUpcomingEventsParams = z.infer<typeof GetUpcomingEventsSchema>;

// ─── Handler ───
export async function handleGetUpcomingEvents(
  params: GetUpcomingEventsParams,
  auth: AuthResult,
) {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + (params.days ?? 1));

  const conditions: ReturnType<typeof and>[] = [
    eq(events.creatorId, auth.userId),
    sql`${events.deletedAt} IS NULL`,
    gte(events.startTime, now),
    lte(events.startTime, endDate),
  ];

  // Filter by workspace if specified
  const workspaceId = params.workspaceId || auth.activeWorkspaceId;
  const workspaceCalendars = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(eq(calendars.workspaceId, workspaceId));

  if (workspaceCalendars.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { events: [], summary: "No events upcoming." },
            null,
            2,
          ),
        ],
      },
    ];
  }

  conditions.push(
    inArray(
      events.calendarId,
      workspaceCalendars.map((c) => c.id),
    ),
  );

  const upcomingEvents = await db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(events.startTime)
    .limit(50);

  // Format into a readable summary grouped by day
  if (upcomingEvents.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { events: [], summary: "No events upcoming in the next " + (params.days ?? 1) + " day(s)." },
            null,
            2,
          ),
        },
      ],
    };
  }

  const groupedByDay: Record<string, typeof upcomingEvents> = {};
  for (const ev of upcomingEvents) {
    const dayKey = ev.startTime.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!groupedByDay[dayKey]) {
      groupedByDay[dayKey] = [];
    }
    groupedByDay[dayKey]!.push(ev);
  }

  const summary = Object.entries(groupedByDay)
    .map(([day, dayEvents]) => {
      const lines = dayEvents
        .map(
          (e) =>
            `  • ${e.startTime.toISOString().slice(11, 16)} — ${e.endTime.toISOString().slice(11, 16)}: ${e.title}`,
        )
        .join("\n");
      return `📅 ${day}\n${lines}`;
    })
    .join("\n\n");

  return {
    content: [
      {
        type: "text" as const,
        text: summary,
      },
      {
        type: "text" as const,
        text: JSON.stringify({ events: upcomingEvents, total: upcomingEvents.length }, null, 2),
      },
    ],
  };
}
