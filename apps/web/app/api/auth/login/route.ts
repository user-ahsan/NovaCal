// ─── POST /api/auth/login ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/login
// Email/password login. Rate limited: 10 req/min per IP.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@novacal/db/client";
import { users, sessions, workspaceMembers } from "@novacal/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse, handleApiError, ERROR_CODES } from "../../../../../lib/errors";
import {
  generateSessionToken,
  getClientIp,
  checkRateLimit,
} from "../../../../../lib/auth";

// ─── Request Validation Schema ───
const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    // ── Rate Limit ──
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, 10, 60);
    if (!rateLimit.allowed) {
      return errorResponse(ERROR_CODES.RATE_LIMITED, "Too many requests. Try again later.");
    }

    // ── Parse Body ──
    const body: unknown = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid request body",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { email, password } = parsed.data;

    // ── Find User ──
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !user.passwordHash) {
      return errorResponse(ERROR_CODES.UNAUTHORIZED, "Invalid email or password");
    }

    // ── Verify Password ──
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return errorResponse(ERROR_CODES.UNAUTHORIZED, "Invalid email or password");
    }

    // ── Determine User Role & Active Workspace ──
    // Get the user's workspace membership for role information
    const [membership] = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, user.id))
      .limit(1);

    // Role precedence: if user has any workspace membership, use that role.
    // If no workspace exists yet (first-run), default to OWNER per NovaCal setup flow.
    const role = membership?.role ?? "OWNER";
    const activeWorkspaceId = membership?.workspaceId ?? null;

    // ── Create Session ──
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(sessions).values({
      id: sessionToken,
      userId: user.id,
      deviceInfo:
        typeof body === "object" && body !== null && "deviceInfo" in body
          ? String((body as Record<string, unknown>).deviceInfo)
          : request.headers.get("user-agent"),
      ipAddress: getClientIp(request),
      expiresAt,
    });

    // ── Response 200 ──
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
        },
        sessionToken,
        activeWorkspaceId,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
