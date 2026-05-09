// ─── POST /api/share/calendar/:id ───
// Source: docs/03-api-websocket-contract.md §7 — POST /share/calendar/:id
// Generate a cryptographically secure public share link for a calendar.
// Headers: Authorization: Bearer <session_token>
// Body: { password?: string, expiresAt?: ISO-8601 }

import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@novacal/db/client";
import { publicLinks } from "@novacal/db/schema";
import { requireAuth } from "../../../../../../lib/auth";
import { handleApiError, errorResponse, ERROR_CODES } from "../../../../../../lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: calendarId } = await params;

    // ── Auth ──
    await requireAuth(request);

    // ── Parse Body ──
    const body = (await request.json()) as {
      password?: string;
      expiresAt?: string;
    };
    const { password, expiresAt } = body;

    // ── Validate expiresAt (max 365 days from now) ──
    if (expiresAt) {
      const expiresDate = new Date(expiresAt);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 1);

      if (isNaN(expiresDate.getTime())) {
        return errorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "Invalid expiresAt date format",
        );
      }

      if (expiresDate > maxDate) {
        return errorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "expiresAt cannot exceed 365 days from now",
        );
      }
    }

    // ── Generate 64-char hex hash (AGENTS.md Rule 57) ──
    const hash = crypto.randomBytes(32).toString("hex");

    // ── Hash password with bcrypt if provided (AGENTS.md Rule 45) ──
    const passwordHash = password
      ? await bcrypt.hash(password, 12)
      : null;

    // ── Insert into DB ──
    await db.insert(publicLinks).values({
      hash,
      entityType: "CALENDAR",
      entityId: calendarId,
      passwordHash,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // ── Response 201 ──
    return new Response(
      JSON.stringify({
        shareUrl: `/p/${hash}`,
        hash,
        expiresAt: expiresAt ?? null,
        hasPassword: !!password,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
