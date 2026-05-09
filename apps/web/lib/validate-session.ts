// ─── Session Validation ───
// Validates Bearer token against Better Auth sessions table.
// Source: docs/01-database-schema.md §1 (auth.ts session schema)

import { db } from "@novacal/db/client";
import { sessions, users } from "@novacal/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { ApiRequestError, ERROR_CODES } from "./errors";

export interface SessionUser {
  userId: string;
  userName: string;
  userEmail: string;
}

/**
 * Validates the Authorization Bearer token against active sessions.
 * Returns the authenticated user's info.
 */
export async function validateSession(request: Request): Promise<SessionUser> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiRequestError(
      ERROR_CODES.UNAUTHORIZED,
      "Missing or invalid Authorization header. Expected: Bearer <session_token>",
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new ApiRequestError(
      ERROR_CODES.UNAUTHORIZED,
      "Authorization header has empty token",
    );
  }

  const result = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, token),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!result[0]) {
    throw new ApiRequestError(
      ERROR_CODES.UNAUTHORIZED,
      "Session token is invalid or expired",
    );
  }

  return result[0];
}
