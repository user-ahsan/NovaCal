// ─── Tool: list_events ───
// Query calendar events within a date range.
// Supports filtering by workspace, team member, and FTS search.
// RBAC: VIEWER minimum.

import { z } from "zod";
import { and, gte, lte, eq, sql, inArray } from "drizzle-orm";
import { db } from "@novacal/db";
import { events, calendars } from "@novacal/db/schema";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const ListEventsSchema = z.object({
  dateFrom: z.string().describe("ISO-8601 start date (required)"),
  dateTo: z.string().describe("ISO-8601 end date (required)"),
  workspaceId: z
    .string()
    .optional()
    .describe("Filter by workspace ID"),
  userId: z
    .string()
    .optional()
    .describe("Filter by specific user's events"),
  query: z
    .string()
    .optional()
    .describe("FTS search term for title/description/location"),
  limit: z
    .number()
    .max(200)
    .optional()
    .default(50)
    .describe("Max results (default: 50, max: 200)"),
});

export type ListEventsParams = z.infer<typeof ListEventsSchema>;

// ─── Handler ───
export async function handleListEvents(
  params: ListEventsParams,
  _auth: AuthResult,
) {
  const conditions: ReturnType<typeof and>[] = [
    gte(events.startTime, new Date(params.dateFrom)),
    lte(events.endTime, new Date(params.dateTo)),
  ];

  // Filter by workspace via calendars join
  if (params.workspaceId) {
    const workspaceCalendars = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(eq(calendars.workspaceId, params.workspaceId));

    if (workspaceCalendars.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ events: [], message: "No calendars found in workspace" }, null, 2),
          },
        ],
      };
    }

    conditions.push(
      inArray(
        events.calendarId,
        workspaceCalendars.map((c: { id: string }) => c.id),
      ),
    );
  }

  // Filter by creator
  if (params.userId) {
    conditions.push(eq(events.creatorId, params.userId));
  }

  // Full-text search
  if (params.query) {
    conditions.push(
      sql`to_tsvector('english', coalesce(${events.title}, '') || ' ' || coalesce(${events.description}, '')) @@ plainto_tsquery('english', ${params.query})`,
    );
  }

  // Exclude soft-deleted events
  conditions.push(sql`${events.deletedAt} IS NULL`);

  const results = await db
    .select()
    .from(events)
    .where(and(...conditions))
    .limit(params.limit)
    .orderBy(events.startTime);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
}
