// ─── Tool: create_event ───
// Create a new calendar event with automatic conflict detection.
// RBAC: EDITOR minimum.

import { z } from "zod";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { db } from "@novacal/db";
import { events, calendars, eventAttendees, users } from "@novacal/db/schema";
import { assertMinimumRole } from "../rbac.js";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const CreateEventSchema = z.object({
  title: z.string().min(1).describe("Event title (required)"),
  startTime: z.string().describe("ISO-8601 start datetime (required)"),
  endTime: z.string().describe("ISO-8601 end datetime (required)"),
  description: z
    .string()
    .optional()
    .describe("Markdown description (optional)"),
  location: z
    .string()
    .optional()
    .describe("Physical location or meeting link (optional)"),
  timezone: z
    .string()
    .optional()
    .describe("IANA timezone for display (optional, defaults to user preference)"),
  attendees: z
    .array(z.string())
    .optional()
    .describe("Array of user emails to invite (optional)"),
  workspaceId: z
    .string()
    .optional()
    .describe("Workspace to create in (optional, defaults to active workspace)"),
  recurrence: z
    .string()
    .optional()
    .describe("RRule string for recurring events (optional)"),
});

export type CreateEventParams = z.infer<typeof CreateEventSchema>;

// ─── Helpers ───

async function getOrCreateDefaultCalendar(
  workspaceId: string,
): Promise<string> {
  const [cal] = await db
    .select()
    .from(calendars)
    .where(eq(calendars.workspaceId, workspaceId))
    .limit(1);

  if (cal) return cal.id;

  const [newCal] = await db
    .insert(calendars)
    .values({
      workspaceId,
      name: "Default Calendar",
      color: "#6366F1",
      isDefault: true,
    })
    .returning();

  return newCal.id;
}

// ─── Handler ───
export async function handleCreateEvent(
  params: CreateEventParams,
  auth: AuthResult,
) {
  const workspaceId = params.workspaceId || auth.activeWorkspaceId;

  // RBAC check
  await assertMinimumRole(auth.userId, workspaceId, "EDITOR");

  // Resolve calendar
  const calendarId = await getOrCreateDefaultCalendar(workspaceId);

  // Conflict detection: find overlapping events in same calendar
  const conflicts = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.calendarId, calendarId),
        sql`${events.deletedAt} IS NULL`,
        gte(events.endTime, new Date(params.startTime)),
        lte(events.startTime, new Date(params.endTime)),
      ),
    );

  // Insert event
  const [event] = await db
    .insert(events)
    .values({
      calendarId,
      creatorId: auth.userId,
      title: params.title,
      startTime: new Date(params.startTime),
      endTime: new Date(params.endTime),
      description: params.description ?? null,
      location: params.location ?? null,
      timezone: params.timezone ?? null,
      rrule: params.recurrence ?? null,
    })
    .returning();

  // Add attendees if specified
  if (params.attendees && params.attendees.length > 0) {
    const attendeeRecords = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`${users.email} = ANY(${params.attendees})`);

    if (attendeeRecords.length > 0) {
      await db.insert(eventAttendees).values(
        attendeeRecords.map((a) => ({
          eventId: event.id,
          userId: a.id,
          email: a.email,
          rsvpStatus: "PENDING",
        })),
      );
    }
  }

  const response: Record<string, unknown> = {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
  };

  const content: { type: "text"; text: string }[] = [
    {
      type: "text",
      text: `✅ Event created: "${event.title}" (${event.startTime.toISOString()} — ${event.endTime.toISOString()})`,
    },
    {
      type: "text",
      text: JSON.stringify(response, null, 2),
    },
  ];

  if (conflicts.length > 0) {
    content.push({
      type: "text",
      text: `⚠️ Conflict detected with ${conflicts.length} existing event(s): ${conflicts.map((c) => c.title).join(", ")}`,
    });
  }

  return { content };
}
