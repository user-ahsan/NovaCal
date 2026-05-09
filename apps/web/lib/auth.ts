// ─── Auth Route Utilities ───
// Source: docs/03-api-websocket-contract.md § Global Config + §1 Auth
// Source: AGENTS.md Rules 42, 45, 47, 50, 55-56
//
// Provides shared utilities used by all /api/auth/* route handlers.
// Session validation uses lib/validate-session.ts. Error responses use lib/errors.ts.

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { sessions } from "@novacal/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { validateSession, type SessionUser } from "./validate-session";
import { ApiRequestError, ERROR_CODES, errorResponse } from "./errors";
import redis from "./redis";
import crypto from "crypto";

// ─── Session + User from Token (throws ApiRequestError on failure) ───
// Thin wrapper over validate-session that provides the full session row.
export async function getSessionWithUser(token: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!session) {
    throw new ApiRequestError(ERROR_CODES.UNAUTHORIZED, "Session token is invalid or expired");
  }

  return session;
}

// ─── Auth Guard for Routes ───
// Extracts the token, validates it, and returns the session user.
// Throws ApiRequestError if auth fails.
export async function requireAuth(request: NextRequest): Promise<{ sessionUser: SessionUser; sessionId: string; userId: string }> {
  const sessionUser = await validateSession(request);
  const token = extractBearerToken(request);
  const session = await getSessionWithUser(token);

  return { sessionUser, sessionId: token, userId: sessionUser.userId };
}

// ─── Extract Bearer Token ───
export function extractBearerToken(request: NextRequest): string {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new ApiRequestError(ERROR_CODES.UNAUTHORIZED, "Missing or invalid Authorization header. Expected: Bearer <session_token>");
  }
  const token = auth.slice(7).trim();
  if (!token) {
    throw new ApiRequestError(ERROR_CODES.UNAUTHORIZED, "Authorization header has empty token");
  }
  return token;
}

// ─── Generate Session Token ───
// Better Auth convention: text PK using crypto random bytes
// AGENTS.md Rule 42: Sessions use text PK (not UUID)
export function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

// ─── Get Client IP ───
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

// ─── Rate Limiting (Redis-backed) ───
// docs/03-api-websocket-contract.md § Rate Limiting:
// Auth endpoints → 10 req/min per IP
export async function checkRateLimit(
  ip: string,
  limit: number = 10,
  windowSeconds: number = 60,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:auth:${ip}`;
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}
