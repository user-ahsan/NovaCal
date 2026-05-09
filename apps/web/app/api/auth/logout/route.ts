// ─── POST /api/auth/logout ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/logout
// Invalidates the current session.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import { sessions } from "@novacal/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse, handleApiError, ERROR_CODES } from "../../../../../lib/errors";
import { validateSession } from "../../../../../lib/validate-session";

export async function POST(request: NextRequest) {
  try {
    // ── Validate Session ──
    // validateSession() throws ApiRequestError on invalid / missing token
    await validateSession(request);

    // Extract token manually to know which session to delete
    const authHeader = request.headers.get("Authorization");
    const token = authHeader!.slice(7).trim();

    // ── Invalidate Session ──
    // Delete the session row from the database
    await db.delete(sessions).where(eq(sessions.id, token));

    // ── Response 200 ──
    return NextResponse.json({ status: "logged_out" }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
