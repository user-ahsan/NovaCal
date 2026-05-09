// ─── Tool: search_events ───
// Full-text search across event titles, descriptions, and locations
// using PostgreSQL tsvector/tsquery with GIN prefix matching.
// Returns ranked results with snippets.
// RBAC: VIEWER minimum.

import { z } from "zod";
import { and, eq, sql, inArray } from "drizzle-orm";
import { db } from "@novacal/db";
import { events, calendars } from "@novacal/db/schema";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const SearchEventsSchema = z.object({
  query: z.string().min(1).describe("Search term (required)"),
  workspaceId: z.string().optional().describe("Filter by workspace"),
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Max results (default: 20)"),
});

export type SearchEventsParams = z.infer<typeof SearchEventsSchema>;

// ─── Handler ───
export async function handleSearchEvents(
  params: SearchEventsParams,
  _auth: AuthResult,
) {
  const conditions: ReturnType<typeof and>[] = [
    sql`${events.deletedAt} IS NULL`,
  ];

  // Build FTS query with prefix matching for typo tolerance
  const ftsQuery = params.query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word}:*`)
    .join(" & ");

  conditions.push(
    sql`to_tsvector('english', coalesce(${events.title}, '') || ' ' || coalesce(${events.description}, '') || ' ' || coalesce(${events.location}, '')) @@ to_tsquery('english', ${ftsQuery})`,
  );

  // Filter by workspace if specified
  if (params.workspaceId) {
    const workspaceCalendars = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(eq(calendars.workspaceId, params.workspaceId));

    if (workspaceCalendars.length > 0) {
      conditions.push(
        inArray(
          events.calendarId,
          workspaceCalendars.map((c) => c.id),
        ),
      );
    }
  }

  const results = await db
    .select({
      id: events.id,
      title: events.title,
      startTime: events.startTime,
      endTime: events.endTime,
      description: events.description,
      location: events.location,
      snippet: sql`ts_headline('english', coalesce(${events.description}, ${events.title}), to_tsquery('english', ${ftsQuery}), 'MaxWords=30, MinWords=10, StartSel=<mark>, StopSel=</mark>')`,
      rank: sql`ts_rank(to_tsvector('english', coalesce(${events.title}, '') || ' ' || coalesce(${events.description}, '')), to_tsquery('english', ${ftsQuery}))`,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(sql`rank DESC`)
    .limit(params.limit);

  const response = {
    results: results.map((r) => ({
      id: r.id,
      title: r.title,
      snippet: r.snippet,
      start: r.startTime,
      end: r.endTime,
    })),
    total: results.length,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}
