// ─── Tool: find_common_time ───
// Cross-reference multiple team members' calendars to find the
// earliest available meeting slot within a date range.
// RBAC: VIEWER minimum.

import { z } from "zod";
import { and, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "@novacal/db";
import { events } from "@novacal/db/schema";
import { DEFAULT_WORKING_HOURS } from "@novacal/shared";
import type { AuthResult } from "../auth.js";

// ─── Zod Schema ───
export const FindCommonTimeSchema = z.object({
  userIds: z
    .array(z.string())
    .min(1)
    .describe("Array of user IDs to check (required)"),
  dateFrom: z.string().describe("ISO-8601 start date (required)"),
  dateTo: z.string().describe("ISO-8601 end date (required)"),
  durationMinutes: z
    .number()
    .min(1)
    .describe("Desired meeting duration in minutes (required)"),
  workingHoursOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe("Only consider 9-5 weekday slots (default: true)"),
});

export type FindCommonTimeParams = z.infer<typeof FindCommonTimeSchema>;

// ─── Helpers ───

interface BusyBlock {
  start: Date;
  end: Date;
}

interface TimeSlot {
  start: Date;
  end: Date;
}

function getWorkingDayBoundaries(
  date: Date,
): { workStart: Date; workEnd: Date } {
  const workStart = new Date(date);
  workStart.setHours(DEFAULT_WORKING_HOURS.start, 0, 0, 0);

  const workEnd = new Date(date);
  workEnd.setHours(DEFAULT_WORKING_HOURS.end, 0, 0, 0);

  return { workStart, workEnd };
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

// Merge overlapping/adjacent busy blocks into a single sorted list
function mergeBusyBlocks(blocks: BusyBlock[]): BusyBlock[] {
  if (blocks.length === 0) return [];
  const sorted = blocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyBlock[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    const current = sorted[i]!;
    if (current.start <= last.end) {
      // Overlap or adjacent — extend last end
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function findEarliestSlot(
  busyBlocks: BusyBlock[],
  dateFrom: Date,
  dateTo: Date,
  durationMinutes: number,
  workingHoursOnly: boolean,
): TimeSlot | null {
  const merged = mergeBusyBlocks(busyBlocks);

  // Generate candidate slots: iterate day by day
  let cursor = new Date(dateFrom);

  while (cursor < dateTo) {
    if (workingHoursOnly && isWeekend(cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const { workStart, workEnd } = workingHoursOnly
      ? getWorkingDayBoundaries(cursor)
      : { workStart: new Date(cursor), workEnd: new Date(dateTo) };

    let slotStart = new Date(Math.max(cursor.getTime(), workStart.getTime()));
    const dayEnd = new Date(Math.min(dateTo.getTime(), workEnd.getTime()));

    while (slotStart < dayEnd) {
      const slotEnd = addMinutes(slotStart, durationMinutes);
      if (slotEnd > dayEnd) break;

      // Check if this slot conflicts with any busy block
      let conflicts = false;
      for (const busy of merged) {
        if (slotStart < busy.end && slotEnd > busy.start) {
          // Overlap — move cursor to end of this busy block
          slotStart = new Date(Math.max(slotStart.getTime(), busy.end.getTime()));
          conflicts = true;
          break;
        }
      }

      if (!conflicts) {
        return { start: slotStart, end: slotEnd };
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return null; // No slot found
}

// ─── Handler ───
export async function handleFindCommonTime(
  params: FindCommonTimeParams,
  _auth: AuthResult,
) {
  // Fetch all events for all specified users in the date range
  const allEvents = await db
    .select()
    .from(events)
    .where(
      and(
        inArray(events.creatorId, params.userIds),
        sql`${events.deletedAt} IS NULL`,
        gte(events.endTime, new Date(params.dateFrom)),
        lte(events.startTime, new Date(params.dateTo)),
      ),
    );

  // Build busy blocks
  const busyBlocks: BusyBlock[] = allEvents.map((e: typeof events.$inferSelect) => ({
    start: new Date(e.startTime),
    end: new Date(e.endTime),
  }));

  const dateFrom = new Date(params.dateFrom);
  const dateTo = new Date(params.dateTo);
  const durationMinutes = params.durationMinutes;

  const suggested = findEarliestSlot(
    busyBlocks,
    dateFrom,
    dateTo,
    durationMinutes,
    params.workingHoursOnly!,
  );

  if (!suggested) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No common available time slot found in the specified range.",
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ Found available slot: ${suggested.start.toISOString()} — ${suggested.end.toISOString()} (${params.durationMinutes} min)`,
      },
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            suggestedStart: suggested.start.toISOString(),
            suggestedEnd: suggested.end.toISOString(),
            durationMinutes,
          },
          null,
          2,
        ),
      },
    ],
  };
}
