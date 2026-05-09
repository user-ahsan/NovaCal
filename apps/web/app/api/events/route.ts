// ─── GET /api/events | POST /api/events ───
// Source: docs/03-api-websocket-contract.md §3 (Calendars & Events)
// Index: idx_events_time_range (calendar_id, start_time, end_time) WHERE deleted_at IS NULL
// Rule 31: UTC-only timestamptz | Rule 32: soft deletes with deletedAt | Rule 49: idempotency key

import { NextRequest, NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import {
  events,
  calendars,
  eventAttendees,
  users,
} from "@novacal/db/schema";
import { and, eq, gte, lte, inArray, asc, or, gt } from "drizzle-orm";
import { validateSession } from "@/lib/validate-session";
import { requireEditor } from "@/lib/rbac";
import { handleApiError, errorResponse, ERROR_CODES } from "@/lib/errors";
import { parseISODate, validateTimeRange } from "@/lib/iso-8601";
import { publishWorkspaceEvent } from "@/lib/redis";
import { WS_EVENTS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@novacal/shared";

// ─── Types ───

interface EventResponse {
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
  color: string;
  createdBy: { id: string; name: string } | null;
  attendees: Array<{ id: string | null; name: string | null; response: string }>;
}

interface DbEventRow {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  timezone: string | null;
  rrule: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string } | null;
  color: string;
}

interface DbAttendeeRow {
  eventId: string;
  userId: string | null;
  userName: string | null;
  email: string | null;
  rsvpStatus: string;
}

// ─── Helpers ───

function shapeEvent(row: DbEventRow): EventResponse {
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
    color: row.color,
    createdBy: row.createdBy,
    attendees: [],
  };
}

function shapeEventWithAttendees(
  event: EventResponse,
  attendeeRows: DbAttendeeRow[],
): EventResponse {
  const eventAttendeesList = attendeeRows
    .filter((a) => a.eventId === event.id)
    .map((a) => ({
      id: a.userId,
      name: a.userName ?? a.email,
      response: a.rsvpStatus,
    }));
  return { ...event, attendees: eventAttendeesList };
}

const CURSOR_SEPARATOR = "|";

function encodeCursor(startTime: Date, id: string): string {
  return Buffer.from(`${startTime.toISOString()}${CURSOR_SEPARATOR}${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { startTime: Date; id: string } {
  const decoded = Buffer.from(cursor, "base64url").toString();
  const separatorIndex = decoded.lastIndexOf(CURSOR_SEPARATOR);
  if (separatorIndex === -1) {
    throw new Error("Invalid cursor format");
  }
  return {
    startTime: new Date(decoded.slice(0, separatorIndex)),
    id: decoded.slice(separatorIndex + 1),
  };
}

// ─── GET /api/events ───

export async function GET(request: NextRequest) {
  try {
    await validateSession(request);

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const calendarIdsParam = searchParams.get("calendarIds");
    const userIdParam = searchParams.get("userId");
    const cursorParam = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");

    // Validate required timeframe params
    if (!startParam || !endParam) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Query parameters 'start' and 'end' (ISO-8601) are required",
      );
    }

    const startDate = parseISODate(startParam);
    const endDate = parseISODate(endParam);
    validateTimeRange(startDate, endDate);

    const limit = Math.min(
      Math.max(1, Number(limitParam) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    // Build WHERE conditions using idx_events_time_range:
    // (calendar_id, start_time, end_time) WHERE deleted_at IS NULL
    const conditions: ReturnType<typeof eq>[] = [
      eq(events.deletedAt, null),
      gte(events.startTime, startDate),
      lte(events.endTime, endDate),
    ];

    if (calendarIdsParam) {
      const ids = calendarIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        conditions.push(inArray(events.calendarId, ids));
      }
    }

    if (userIdParam) {
      conditions.push(eq(events.creatorId, userIdParam));
    }

    // Cursor-based pagination: client sends cursor pointing to last seen event.
    // We fetch limit+1 to detect whether there is a next page.
    if (cursorParam) {
      const cursor = decodeCursor(cursorParam);
      conditions.push(
        or(
          gt(events.startTime, cursor.startTime),
          and(eq(events.startTime, cursor.startTime), gt(events.id, cursor.id)),
        ) as ReturnType<typeof eq>,
      );
    }

    // Fetch events with creator + calendar info
    const eventRows = (await db
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
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        createdBy: {
          id: users.id,
          name: users.name,
        },
        color: calendars.color,
      })
      .from(events)
      .leftJoin(calendars, eq(events.calendarId, calendars.id))
      .leftJoin(users, eq(events.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(asc(events.startTime), asc(events.id))
      .limit(limit + 1)) as DbEventRow[];

    const hasMore = eventRows.length > limit;
    const pageRows = hasMore ? eventRows.slice(0, limit) : eventRows;

    // If there are events, fetch their attendees
    let attendeesByEvent: DbAttendeeRow[] = [];
    if (pageRows.length > 0) {
      const eventIds = pageRows.map((e) => e.id);
      attendeesByEvent = (await db
        .select({
          eventId: eventAttendees.eventId,
          userId: eventAttendees.userId,
          userName: users.name,
          email: eventAttendees.email,
          rsvpStatus: eventAttendees.rsvpStatus,
        })
        .from(eventAttendees)
        .leftJoin(users, eq(eventAttendees.userId, users.id))
        .where(inArray(eventAttendees.eventId, eventIds))) as DbAttendeeRow[];
    }

    // Shape response
    const responseData: EventResponse[] = pageRows.map((row) => {
      const event = shapeEvent(row);
      return shapeEventWithAttendees(event, attendeesByEvent);
    });

    // Build response
    const response = NextResponse.json(responseData);

    // Cursor-based pagination via Link header
    if (hasMore) {
      const lastRow = pageRows[pageRows.length - 1];
      if (lastRow) {
        const nextCursor = encodeCursor(lastRow.startTime, lastRow.id);
        const nextUrl = new URL(request.url);
        nextUrl.searchParams.set("cursor", nextCursor);
        response.headers.set(
          "Link",
          `<${nextUrl.pathname}${nextUrl.search}>; rel="next"`,
        );
      }
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── POST /api/events ───

export async function POST(request: NextRequest) {
  try {
    const { userId, userName } = await validateSession(request);

    // Required headers
    const workspaceId = request.headers.get("X-Workspace-Id");
    if (!workspaceId) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "X-Workspace-Id header is required",
      );
    }

    const idempotencyKey = request.headers.get("X-Idempotency-Key");

    // RBAC: EDITOR minimum
    await requireEditor(userId, workspaceId);

    // Parse and validate body
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Request body must be valid JSON",
      );
    }

    const { calendarId, title, startTime, endTime, description, location, timezone, attendees, recurrence, isAllDay } = body as Record<string, unknown>;

    // Validate required fields
    if (!calendarId || typeof calendarId !== "string") {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, "'calendarId' is required and must be a string");
    }
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, "'title' is required and must be a non-empty string");
    }
    if (!startTime || typeof startTime !== "string") {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, "'startTime' is required and must be an ISO-8601 string");
    }
    if (!endTime || typeof endTime !== "string") {
      return errorResponse(ERROR_CODES.VALIDATION_ERROR, "'endTime' is required and must be an ISO-8601 string");
    }

    const startDate = parseISODate(startTime);
    const endDate = parseISODate(endTime);
    validateTimeRange(startDate, endDate);

    // Verify calendar belongs to the workspace
    const calendar = await db
      .select({ id: calendars.id, workspaceId: calendars.workspaceId })
      .from(calendars)
      .where(eq(calendars.id, calendarId))
      .limit(1);

    if (!calendar[0]) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Calendar not found");
    }

    if (calendar[0].workspaceId !== workspaceId) {
      return errorResponse(ERROR_CODES.FORBIDDEN, "Calendar does not belong to the specified workspace");
    }

    // Idempotency check: if key provided, check for existing event
    if (idempotencyKey) {
      const existing = await db
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.calendarId, calendarId),
            eq(events.startTime, startDate),
            eq(events.endTime, endDate),
            eq(events.title, title.trim()),
            eq(events.creatorId, userId),
            eq(events.deletedAt, null),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return errorResponse(
          ERROR_CODES.CONFLICT,
          "Duplicate event detected. An identical event already exists.",
        );
      }
    }

    // Conflict detection: overlapping events in the same calendar
    const conflicts = await db
      .select({
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        endTime: events.endTime,
      })
      .from(events)
      .where(
        and(
          eq(events.calendarId, calendarId),
          eq(events.deletedAt, null),
          lte(events.startTime, endDate),
          gte(events.endTime, startDate),
        ),
      )
      .limit(10);

    // Insert event
    const now = new Date();
    const [inserted] = await db
      .insert(events)
      .values({
        calendarId,
        creatorId: userId,
        title: title.trim(),
        description: description && typeof description === "string" ? description : null,
        location: location && typeof location === "string" ? location : null,
        startTime: startDate,
        endTime: endDate,
        isAllDay: typeof isAllDay === "boolean" ? isAllDay : false,
        timezone: timezone && typeof timezone === "string" ? timezone : null,
        rrule: recurrence && typeof recurrence === "string" ? recurrence : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: events.id,
        calendarId: events.calendarId,
        title: events.title,
        startTime: events.startTime,
        endTime: events.endTime,
      });

    if (!inserted) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, "Failed to create event");
    }

    // Handle attendees: look up users by email and insert into event_attendees
    if (attendees && Array.isArray(attendees) && attendees.length > 0) {
      const attendeeEmails = attendees.filter((a): a is string => typeof a === "string");

      if (attendeeEmails.length > 0) {
        // Find registered users by email
        const registeredUsers = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(users.email, attendeeEmails));

        const registeredEmails = new Set(registeredUsers.map((u) => u.email));

        const attendeeValues = attendeeEmails.map((email) => {
          const user = registeredUsers.find((u) => u.email === email);
          return {
            eventId: inserted.id,
            userId: user?.id ?? null,
            email,
            rsvpStatus: "PENDING",
          };
        });

        if (attendeeValues.length > 0) {
          await db.insert(eventAttendees).values(attendeeValues);
        }
      }
    }

    // Broadcast EVENT_CREATED via Redis Pub/Sub to workspace members
    await publishWorkspaceEvent(workspaceId, WS_EVENTS.EVENT_CREATED, {
      eventId: inserted.id,
      actor: { id: userId, name: userName },
    });

    return NextResponse.json(
      {
        id: inserted.id,
        title: inserted.title,
        start: inserted.startTime.toISOString(),
        end: inserted.endTime.toISOString(),
        conflicts: conflicts.map((c) => ({
          eventId: c.id,
          title: c.title,
          start: c.startTime.toISOString(),
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
