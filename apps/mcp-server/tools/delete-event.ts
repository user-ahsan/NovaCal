// ─── Tool: delete_event ───
// Soft-delete an event (sets deletedAt timestamp).
// Requires explicit confirmDestructive: true flag.
// Supports recurrence scope: single | this_and_future | all.
// RBAC: EDITOR minimum.
// Rate limited: max 5 destructive calls per minute.

import { z } from "zod";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@novacal/db";
import { events, calendars } from "@novacal/db/schema";
import { assertMinimumRole } from "../rbac.js";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const DeleteEventSchema = z.object({
  eventId: z.string().describe("Event ID to delete (required)"),
  confirmDestructive: z
    .boolean()
    .describe("Must be true to execute deletion (required)"),
  scope: z
    .enum(["single", "this_and_future", "all"])
    .optional()
    .default("single")
    .describe("Recurrence scope (default: single)"),
});

export type DeleteEventParams = z.infer<typeof DeleteEventSchema>;

// ─── Handler ───
export async function handleDeleteEvent(
  params: DeleteEventParams,
  auth: AuthResult,
) {
  // Safety gate: confirmDestructive MUST be true
  if (!params.confirmDestructive) {
    return {
      content: [
        {
          type: "text" as const,
          text: "❌ Deletion requires confirmDestructive: true. This is a destructive operation.",
        },
      ],
    };
  }

  // Fetch event to verify existence and resolve workspace
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, params.eventId))
    .limit(1);

  if (!event) {
    throw new Error(`Event not found: ${params.eventId}`);
  }

  // Resolve workspace from calendar for RBAC
  const [cal] = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, event.calendarId))
    .limit(1);

  if (!cal) {
    throw new Error(`Calendar not found for event: ${params.eventId}`);
  }

  await assertMinimumRole(auth.userId, cal.workspaceId, "EDITOR");

  const now = new Date();

  switch (params.scope) {
    case "single":
      // Soft-delete just this event (or override)
      await db
        .update(events)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(events.id, params.eventId));
      break;

    case "this_and_future":
      // Soft-delete this event and all future occurrences in the series
      if (event.rrule || event.baseEventId) {
        const seriesId = event.baseEventId || event.id;
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(
            and(
              inArray(events.id, [seriesId]),
              gte(events.startTime, event.startTime),
            ),
          );
        // Also delete overrides for this series from now on
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(
            and(
              eq(events.baseEventId, seriesId),
              gte(events.startTime, event.startTime),
            ),
          );
      } else {
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(events.id, params.eventId));
      }
      break;

    case "all":
      // Soft-delete the entire series including all overrides
      if (event.rrule || event.baseEventId) {
        const seriesId = event.baseEventId || event.id;
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(
            inArray(events.id, [seriesId]),
          );
        // Also delete all overrides
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(events.baseEventId, seriesId));
      } else {
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(events.id, params.eventId));
      }
      break;
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ Event ${params.eventId} deleted (scope: ${params.scope}).`,
      },
    ],
  };
}
