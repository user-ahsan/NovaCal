// ─── GET /api/auth/sessions | DELETE /api/auth/sessions ───
// Source: docs/03-api-websocket-contract.md §1
// GET — Lists all active sessions for the current user (device ledger)
// DELETE — "Log out of all devices" panic button (revokes all except current)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import { sessions } from "@novacal/db/schema";
import { eq, and, gt, ne } from "drizzle-orm";
import { errorResponse, handleApiError, ERROR_CODES } from "../../../../../lib/errors";
import { validateSession } from "../../../../../lib/validate-session";

// ─── GET: List All Active Sessions ───
// Response 200: [{ id, device, ip, lastActive, createdAt, isCurrent }]
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await validateSession(request);

    // Extract current session token from the Authorization header
    const authHeader = request.headers.get("Authorization");
    const currentSessionId = authHeader!.slice(7).trim();

    const userId = sessionUser.userId;

    // Fetch all active (non-expired) sessions for this user
    const allSessions = await db
      .select({
        id: sessions.id,
        device: sessions.deviceInfo,
        ip: sessions.ipAddress,
        lastActive: sessions.createdAt, // proxy: no separate lastActive column yet
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(sessions.createdAt);

    // Map to response format with isCurrent flag
    const deviceLedger = allSessions.map((s) => ({
      id: s.id,
      device: s.device ?? "Unknown device",
      ip: s.ip ?? "Unknown",
      lastActive: (s.lastActive as Date).toISOString(),
      createdAt: (s.createdAt as Date).toISOString(),
      isCurrent: s.id === currentSessionId,
    }));

    return NextResponse.json(deviceLedger, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─── DELETE: Revoke All Sessions Except Current ───
// docs/03-api-websocket-contract.md: "Log out of all devices" — revokes all except current
// Response 200: { status: "all_revoked", count }
export async function DELETE(request: NextRequest) {
  try {
    const sessionUser = await validateSession(request);

    const authHeader = request.headers.get("Authorization");
    const currentSessionId = authHeader!.slice(7).trim();
    const userId = sessionUser.userId;

    // Delete all sessions for this user except the current one
    const result = await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          ne(sessions.id, currentSessionId),
        ),
      )
      .returning({ id: sessions.id });

    const count = result.length;

    return NextResponse.json(
      { status: "all_revoked", count },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
