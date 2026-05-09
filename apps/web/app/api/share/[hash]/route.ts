// ─── DELETE /api/share/:hash ───
// Source: docs/03-api-websocket-contract.md §7 — DELETE /share/:hash
// Revoke a public share link by its hash.
// Headers: Authorization: Bearer <session_token>

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { publicLinks } from "@novacal/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../../../../lib/auth";
import { handleApiError, errorResponse, ERROR_CODES } from "../../../../../lib/errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;

    // ── Auth ──
    await requireAuth(request);

    // ── Verify the link exists ──
    const [link] = await db
      .select({ id: publicLinks.id })
      .from(publicLinks)
      .where(eq(publicLinks.hash, hash))
      .limit(1);

    if (!link) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        "Share link not found",
      );
    }

    // ── Delete the share link ──
    await db.delete(publicLinks).where(eq(publicLinks.hash, hash));

    return Response.json({ status: "revoked" });
  } catch (error) {
    return handleApiError(error);
  }
}
