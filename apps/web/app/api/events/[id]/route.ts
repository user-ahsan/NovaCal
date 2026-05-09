// ─── GET /api/events/:id | PATCH /api/events/:id | DELETE /api/events/:id ───
// Source: docs/03-api-websocket-contract.md §3 (Calendars & Events)
// Rule 31: UTC-only timestamptz | Rule 32: soft deletes with deletedAt
// Rule 49: idempotency key support

import { NextRequest, NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import { events, calendars, eventAttendees, users } from "@novacal/db/schema";
import { and, eq, inArray, asc, gte, or } from "drizzle-orm";
import { validateSession } from "@/lib/validate-session";
import { requireEditor } from "@/lib/rbac";
import { handleApiError, errorResponse, ERROR_CODES } from "@/lib/errors";
import { parseISODate, validateTimeRange } from "@/lib/iso-8601";
import { publishWorkspaceEvent } from "@/lib/redis";
import { WS_EVENTS } from "@novacal/shared";

// ─── Shared Helpers ───

interface AttendeeShape {
  id: string | null;
  name: string | null;
  response: string;
}

interface EventDetailResponse {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  description: string | null;
  location: string | null;
  timezone: string | null;
  isAllDay: boolean;
  rrule: string | null;
  baseEventId: string | null;
  color: string;
  createdBy: { id: string; name: string } | null;
  attendees: AttendeeShape[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetches a single event by ID with all relations (attendees, creator, calendar color).
 */
async function fetchEventDetail(eventId: string): Promise<EventDetailResponse | null> {
  const eventRows = await db
    .select({
      id: events.id,
      calendarId: events.calendarId,
      title: events.title,
      description: events.description,
      location: events.location,
      startTime: events.startTime,
      endTime: events.endTime,
      isAllDay: events.isAllDay,
      timezone: events.timezone,
      rrule: events.rrule,
      baseEventId: events.baseEventId,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
      color: calendars.color,
      creatorId: users.id,
      creatorName: users.name,
    })
    .from(events)
    .leftJoin(calendars, eq(events.calendarId, calendars.id))
    .leftJoin(users, eq(events.creatorId, users.id))
    .where(and(eq(events.id, eventId), eq(events.deletedAt, null)))
    .limit(1);

  if (!eventRows[0]) return null;

  const row = eventRows[0];

  // Fetch attendees
  const attendeeRows = await db
    .select({
      userId: eventAttendees.userId,
      userName: users.name,
      email: eventAttendees.email,
      rsvpStatus: eventAttendees.rsvpStatus,
    })
    .from(eventAttendees)
    .leftJoin(users, eq(eventAttendees.userId, users.id))
    .where(eq(eventAttendees.eventId, eventId));

  const attendees: AttendeeShape[] = attendeeRows.map((a) => ({
    id: a.userId,
    name: a.userName ?? a.email,
    response: a.rsvpStatus,
  }));

  return {
    id: row.id,
    calendarId: row.calendarId,
    title: row.title,
    start: row.startTime.toISOString(),
    end: row.endTime.toISOString(),
    description: row.description,
    location: row.location,
    timezone: row.timezone,
    isAllDay: row.isAllDay,
    rrule: row.rrule,
    baseEventId: row.baseEventId,
    color: row.color,
    createdBy: row.creatorId ? { id: row.creatorId, name: row.creatorName ?? "" } : null,
    attendees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Resolves the workspace ID for a given event by walking the calendar chain.
 */
async function resolveWorkspaceId(eventId: string): Promise<string | null> {
  const result = await db
    .select({ workspaceId: calendars.workspaceId })
    .from(events)
    .innerJoin(calendars, eq(events.calendarId, calendars.id))
    .where(eq(events.id, eventId))
    .limit(1);

  return result[0]?.workspaceId ?? null;
}

// ─── GET /api/events/:id ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await validateSession(_request);

    const { id } = await params;
    if (!id) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, "Event ID is required");
    }

    const event = await fetchEventDetail(id);
    if (!event) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Event not found");
    }

    return NextResponse.json(event);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── PATCH /api/events/:id ───

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, userName } = await validateSession(request);
    const { id } = await params;

    // Fetch existing event
    const existing = await db
      .select({
        id: events.id,
        calendarId: events.calendarId,
        title: events.title,
        startTime: events.startTime,
        endTime: events.endTime,
        rrule: events.rrule,
        baseEventId: events.baseEventId,
        deletedAt: events.deletedAt,
      })
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!existing[0]) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Event not found");
    }

    const eventRecord = existing[0];

    if (eventRecord.deletedAt) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Event has been deleted");
    }

    // Resolve workspace and check RBAC
    const workspaceId = await resolveWorkspaceId(id);
    if (!workspaceId) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Event workspace not found");
    }
    await requireEditor(userId, workspaceId);

    // Parse and validate body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, "Request body must be valid JSON");
    }

    const {
      title,
      startTime,
      endTime,
      description,
      location,
      singleInstance,
    } = body as Record<string, unknown>;

    // Check if this is a recurring event with single-instance edit
    const isRecurring = !!eventRecord.rrule;
    const isSingleEdit = isRecurring && singleInstance === true;

    if (isSingleEdit) {
      // Create a child override with baseEventId pointing to the parent
      // The child gets explicit startTime/endTime overriding the rrule expansion
      const now = new Date();

      const childStart = startTime
        ? parseISODate(startTime as string)
        : eventRecord.startTime;
      const childEnd = endTime
        ? parseISODate(endTime as string)
        : eventRecord.endTime;

      if (startTime || endTime) {
        validateTimeRange(
          startTime ? parseISODate(startTime as string) : eventRecord.startTime,
          endTime ? parseISODate(endTime as string) : eventRecord.endTime,
        );
      }

      const [child] = await db
        .insert(events)
        .values({
          calendarId: eventRecord.calendarId,
          creatorId: userId,
          title: (title as string)?.trim() ?? eventRecord.title,
          description: description !== undefined ? (description as string) ?? null : undefined,
          location: location !== undefined ? (location as string) ?? null : undefined,
          startTime: childStart,
          endTime: childEnd,
          rrule: null, // Child has no rrule — it overrides a specific instance
          baseEventId: eventRecord.id, // Link to parent
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: events.id, title: events.title, startTime: events.startTime, endTime: events.endTime });

      if (!child) {
        return errorResponse(ERROR_CODES.INTERNAL_ERROR, "Failed to create override event");
      }

      // Broadcast EVENT_UPDATED for the parent series
      await publishWorkspaceEvent(workspaceId, WS_EVENTS.EVENT_UPDATED, {
        eventId: id,
        actor: { id: userId, name: userName },
        changes: { singleInstanceOverride: child.id },
      });

      return NextResponse.json({
        id: child.id,
        title: child.title,
        start: child.startTime.toISOString(),
        end: child.endTime.toISOString(),
        baseEventId: eventRecord.id,
      });
    }

    // Standard update (non-recurring or "edit all" for recurring)
    const updateData: Record<string, unknown> = {};
    const now = new Date();

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return errorResponse(ERROR_CODES.VALIDATION_ERROR, "'title' must be a non-empty string");
      }
      updateData.title = title.trim();
    }

    if (startTime !== undefined) {
      updateData.startTime = parseISODate(startTime as string);
    }

    if (endTime !== undefined) {
      updateData.endTime = parseISODate(endTime as string);
    }

    // If both start and end are being set (or already exist), validate the range
    const finalStart = updateData.startTime ?? eventRecord.startTime;
    const finalEnd = updateData.endTime ?? eventRecord.endTime;
    if (finalStart && finalEnd) {
      validateTimeRange(finalStart, finalEnd);
    }

    if (description !== undefined) {
      updateData.description = description ?? null;
    }

    if (location !== undefined) {
      updateData.location = location ?? null;
    }

    updateData.updatedAt = now;

    const [updated] = await db
      .update(events)
      .set(updateData)
      .where(and(eq(events.id, id), eq(events.deletedAt, null)))
      .returning({
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        endTime: events.endTime,
      });

    if (!updated) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, "Failed to update event");
    }

    // Broadcast EVENT_UPDATED
    await publishWorkspaceEvent(workspaceId, WS_EVENTS.EVENT_UPDATED, {
      eventId: id,
      actor: { id: userId, name: userName },
      changes: Object.keys(updateData).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      start: updated.startTime.toISOString(),
      end: updated.endTime.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── DELETE /api/events/:id ───

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, userName } = await validateSession(request);
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get("scope") ?? "single") as
      | "single"
      | "this_and_future"
      | "all";

    if (!["single", "this_and_future", "all"].includes(scope)) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "'scope' must be one of: single, this_and_future, all",
      );
    }

    // Fetch the event to ensure it exists
    const existing = await db
      .select({
        id: events.id,
        calendarId: events.calendarId,
        rrule: events.rrule,
        baseEventId: events.baseEventId,
        startTime: events.startTime,
        deletedAt: events.deletedAt,
      })
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!existing[0]) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Event not found");
    }

    if (existing[0].deletedAt) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Event has already been deleted");
    }

    const eventRecord = existing[0];

    // Resolve workspace and check RBAC
    const workspaceId = await resolveWorkspaceId(id);
    if (!workspaceId) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Event workspace not found");
    }
    await requireEditor(userId, workspaceId);

    const now = new Date();

    if (scope === "single") {
      // Soft delete just this event (or create deleted override for recurring)
      await db
        .update(events)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(events.id, id));
    } else if (scope === "all") {
      // Soft delete all events in the series (same rrule, same title, same calendar)
      if (eventRecord.rrule) {
        // Delete the parent and all child overrides
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(
            and(
              eq(events.calendarId, eventRecord.calendarId),
              or(
                eq(events.id, id),
                eq(events.baseEventId, id),
              ),
              eq(events.deletedAt, null),
            ),
          );
      } else {
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(events.id, id));
      }
    } else if (scope === "this_and_future") {
      // Soft delete this and all future occurrences
      // Find all events in the same series starting from this event's start time
      if (eventRecord.rrule) {
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(
            and(
              eq(events.calendarId, eventRecord.calendarId),
              or(
                and(
                  eq(events.id, id),
                  eq(events.deletedAt, null),
                ),
                and(
                  eq(events.baseEventId, eventRecord.baseEventId ?? id),
                  gte(events.startTime, eventRecord.startTime),
                  eq(events.deletedAt, null),
                ),
              ),
            ),
          );
      } else {
        await db
          .update(events)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(events.id, id));
      }
    }

    // Broadcast EVENT_DELETED via Redis Pub/Sub
    await publishWorkspaceEvent(workspaceId, WS_EVENTS.EVENT_DELETED, {
      eventId: id,
      actor: { id: userId, name: userName },
    });

    return NextResponse.json({ status: "deleted", scope });
  } catch (error) {
    return handleApiError(error);
  }
}


