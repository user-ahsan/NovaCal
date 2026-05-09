// ─── DELETE /api/auth/sessions/:id ───
// Source: docs/03-api-websocket-contract.md §1 — DELETE /auth/sessions/:id
// Revokes a specific session by ID (remote logout).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import { sessions } from "@novacal/db/schema";
import { eq, and } from "drizzle-orm";
import { errorResponse, handleApiError, ERROR_CODES } from "../../../../../../lib/errors";
import { validateSession } from "../../../../../../lib/validate-session";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // ── Validate Auth ──
    const sessionUser = await validateSession(request);

    const authHeader = request.headers.get("Authorization");
    const currentSessionId = authHeader!.slice(7).trim();
    const userId = sessionUser.userId;

    // ── Prevent Self-Revocation ──
    // A user cannot revoke their own current session through this endpoint.
    // They should use POST /api/auth/logout instead.
    if (id === currentSessionId) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Cannot revoke current session via this endpoint. Use POST /api/auth/logout instead.",
      );
    }

    // ── Verify Session Ownership & Revoke ──
    // Only delete if the session belongs to the authenticated user (security: prevent
    // one user from revoking another user's session).
    const result = await db
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .returning({ id: sessions.id });

    if (result.length === 0) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Session not found or already revoked");
    }

    // ── Response 200 ──
    return NextResponse.json({ status: "revoked" }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
