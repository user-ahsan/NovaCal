// ─── Tool: get_availability ───
// Get a user's availability (free/busy) blocks for a given time range.
// RBAC: FREE_BUSY minimum.
// FREE_BUSY users see only "Busy" time blocks (no event details).
// VIEWER+ users see event titles and details.

import { z } from "zod";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { db } from "@novacal/db";
import { events } from "@novacal/db/schema";
import { ROLE_HIERARCHY } from "@novacal/shared";
import type { WorkspaceRole } from "@novacal/shared";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const GetAvailabilitySchema = z.object({
  userId: z.string().describe("User ID (required)"),
  dateFrom: z.string().describe("ISO-8601 start date (required)"),
  dateTo: z.string().describe("ISO-8601 end date (required)"),
});

export type GetAvailabilityParams = z.infer<typeof GetAvailabilitySchema>;

// ─── Handler ───
export async function handleGetAvailability(
  params: GetAvailabilityParams,
  auth: AuthResult,
) {
  // Fetch all non-deleted events for the user in the range
  const userEvents = await db
    .select({
      id: events.id,
      title: events.title,
      startTime: events.startTime,
      endTime: events.endTime,
      description: events.description,
      location: events.location,
    })
    .from(events)
    .where(
      and(
        eq(events.creatorId, params.userId),
        sql`${events.deletedAt} IS NULL`,
        gte(events.endTime, new Date(params.dateFrom)),
        lte(events.startTime, new Date(params.dateTo)),
      ),
    )
    .orderBy(events.startTime);

  // Determine caller's visibility level
  const callerRoleLevel =
    ROLE_HIERARCHY[auth.role as WorkspaceRole] ?? 0;
  const viewerLevel = ROLE_HIERARCHY["VIEWER"];

  const isFreeBusy = callerRoleLevel < viewerLevel;

  if (isFreeBusy) {
    // Return only "Busy" blocks — no titles or details
    const busyBlocks = userEvents.map((e) => ({
      start: e.startTime,
      end: e.endTime,
      status: "Busy" as const,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ busyBlocks }, null, 2),
        },
      ],
    };
  }

  // Return full event data for VIEWER+ callers
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ events: userEvents }, null, 2),
      },
    ],
  };
}
