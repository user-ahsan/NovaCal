// ─── Tool: update_event ───
// Modify an existing event. For recurring events with singleInstance:true,
// creates a child override (baseEventId) rather than modifying the master.
// RBAC: EDITOR minimum.

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@novacal/db";
import { events, calendars } from "@novacal/db/schema";
import { assertMinimumRole } from "../rbac.js";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const UpdateEventSchema = z.object({
  eventId: z.string().describe("Event ID to update (required)"),
  title: z.string().optional().describe("New title"),
  startTime: z.string().optional().describe("New ISO-8601 start datetime"),
  endTime: z.string().optional().describe("New ISO-8601 end datetime"),
  description: z.string().optional().describe("New description"),
  location: z.string().optional().describe("New location"),
  singleInstance: z
    .boolean()
    .optional()
    .describe("Modify only this occurrence of a recurring event"),
});

export type UpdateEventParams = z.infer<typeof UpdateEventSchema>;

// ─── Handler ───
export async function handleUpdateEvent(
  params: UpdateEventParams,
  auth: AuthResult,
) {
  // Fetch existing event with its calendar for RBAC
  const existing = await db
    .select()
    .from(events)
    .where(eq(events.id, params.eventId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error(`Event not found: ${params.eventId}`);
  }

  const event = existing[0]!;

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

  // Build update payload (only provided fields)
  const updateData: Record<string, unknown> = {};
  if (params.title !== undefined) updateData.title = params.title;
  if (params.startTime !== undefined)
    updateData.startTime = new Date(params.startTime);
  if (params.endTime !== undefined)
    updateData.endTime = new Date(params.endTime);
  if (params.description !== undefined)
    updateData.description = params.description;
  if (params.location !== undefined) updateData.location = params.location;
  updateData.updatedAt = new Date();

  // If the event is recurring and singleInstance is true,
  // create a new override event (child) linked via baseEventId
  if (event.rrule && params.singleInstance) {
    const [override] = await db
      .insert(events)
      .values({
        calendarId: event.calendarId,
        creatorId: auth.userId,
        title: (updateData.title as string) ?? event.title,
        startTime:
          (updateData.startTime as Date) ?? event.startTime,
        endTime: (updateData.endTime as Date) ?? event.endTime,
        description:
          (updateData.description as string | null) ?? event.description,
        location:
          (updateData.location as string | null) ?? event.location,
        timezone: event.timezone,
        baseEventId: event.id,
      })
      .returning();

    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Single-instance override created for recurring event "${override.title}" (${override.startTime.toISOString()})`,
        },
        {
          type: "text" as const,
          text: JSON.stringify(override, null, 2),
        },
      ],
    };
  }

  // Standard update
  const [updated] = await db
    .update(events)
    .set(updateData)
    .where(eq(events.id, params.eventId))
    .returning();

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ Event updated: "${updated.title}"`,
      },
      {
        type: "text" as const,
        text: JSON.stringify(updated, null, 2),
      },
    ],
  };
}
