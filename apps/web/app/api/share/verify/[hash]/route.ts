// ─── POST /api/share/verify/:hash ───
// Source: docs/03-api-websocket-contract.md §7 — POST /share/verify/:hash
// PUBLIC endpoint — no auth required.
// Verify a password for a locked public share link.
// Body: { password: string }

import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@novacal/db/client";
import { publicLinks } from "@novacal/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError, errorResponse, ERROR_CODES } from "../../../../../lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params;

    // ── Look up the share link ──
    const [link] = await db
      .select()
      .from(publicLinks)
      .where(eq(publicLinks.hash, hash))
      .limit(1);

    if (!link) {
      return errorResponse(
        ERROR_CODES.NOT_FOUND,
        "Share link not found",
      );
    }

    // ── No password set → no verification needed ──
    if (!link.passwordHash) {
      const tempToken = crypto.randomBytes(32).toString("hex");
      return Response.json({
        valid: true,
        tempToken,
        expiresIn: 3600,
      });
    }

    // ── Parse body ──
    const body = (await request.json()) as { password?: string };
    const { password } = body;

    if (!password) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Password is required for this share link",
      );
    }

    // ── Verify password against bcrypt hash ──
    const valid = await bcrypt.compare(password, link.passwordHash);

    if (!valid) {
      return errorResponse(
        ERROR_CODES.UNAUTHORIZED,
        "Invalid password",
      );
    }

    // ── Generate temporary access token ──
    // In production: sign a JWT with claims { hash, exp }
    const tempToken = crypto.randomBytes(32).toString("hex");

    return Response.json({
      valid: true,
      tempToken,
      expiresIn: 3600,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
