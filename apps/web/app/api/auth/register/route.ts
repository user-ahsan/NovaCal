// ─── POST /api/auth/register ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/register
// Creates a new account. Rate limited: 10 req/min per IP.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@novacal/db/client";
import { users, sessions } from "@novacal/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse, handleApiError, ERROR_CODES } from "../../../../../lib/errors";
import {
  generateSessionToken,
  getClientIp,
  checkRateLimit,
} from "../../../../../lib/auth";

// ─── Request Validation Schema ───
const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(255),
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
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid request body",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { email, password, name } = parsed.data;

    // ── Check For Existing User ──
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return errorResponse(ERROR_CODES.CONFLICT, "An account with this email already exists");
    }

    // ── Hash Password (bcrypt, 12 rounds) ──
    // AGENTS.md Rule 45: bcrypt hashing
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Create User ──
    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });

    if (!user) {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, "Failed to create user");
    }

    // ── Create Session ──
    // AGENTS.md Rule 42: text PK for sessions
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const deviceInfo =
      typeof body === "object" && body !== null && "deviceInfo" in body
        ? String((body as Record<string, unknown>).deviceInfo)
        : request.headers.get("user-agent");

    await db.insert(sessions).values({
      id: sessionToken,
      userId: user.id,
      deviceInfo: deviceInfo || null,
      ipAddress: getClientIp(request),
      expiresAt,
    });

    // ── Response 201 ──
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        sessionToken,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
