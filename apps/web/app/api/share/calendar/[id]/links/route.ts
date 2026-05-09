// ─── GET /api/share/calendar/:id/links ───
// Source: docs/03-api-websocket-contract.md §7 — GET /share/calendar/:id/links
// List all active (non-expired) share links for a calendar.
// Headers: Authorization: Bearer <session_token>

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { publicLinks } from "@novacal/db/schema";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { requireAuth } from "../../../../../../../lib/auth";
import { handleApiError } from "../../../../../../../lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: calendarId } = await params;

    // ── Auth ──
    await requireAuth(request);

    // ── Query active share links ──
    const links = await db
      .select()
      .from(publicLinks)
      .where(
        and(
          eq(publicLinks.entityType, "CALENDAR"),
          eq(publicLinks.entityId, calendarId),
          or(
            isNull(publicLinks.expiresAt),
            gt(publicLinks.expiresAt, new Date()),
          ),
        ),
      );

    return Response.json(
      links.map((link) => ({
        hash: link.hash,
        createdAt: link.createdAt.toISOString(),
        expiresAt: link.expiresAt?.toISOString() ?? null,
        hasPassword: !!link.passwordHash,
        /** viewCount tracked via separate counter table */
        viewCount: 0,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
