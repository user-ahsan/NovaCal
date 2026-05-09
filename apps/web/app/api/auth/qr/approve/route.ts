// ─── POST /api/auth/qr/approve ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/qr/approve
// Called by the Authenticated Mobile App to approve a QR challenge.
// AGENTS.md Rules 55-56: single-use challenge (PENDING → APPROVED), 60s TTL, 10s extension
// Headers: Authorization: Bearer <mobile_session_token>

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import redis from "../../../../../lib/redis";
import { errorResponse, handleApiError, ERROR_CODES } from "../../../../../lib/errors";
import { validateSession } from "../../../../../lib/validate-session";

// ─── Request Validation Schema ───
const QrApproveSchema = z.object({
  challengeId: z.string().uuid("challengeId must be a valid UUID"),
});

const CHALLENGE_TTL_EXTEND_SECONDS = 10;

export async function POST(request: NextRequest) {
  try {
    // ── Validate Mobile Session ──
    // docs/03-api-websocket-contract.md: Headers: Authorization: Bearer <mobile_session_token>
    // validateSession() throws ApiRequestError on invalid / missing token
    const sessionUser = await validateSession(request);
    const userId = sessionUser.userId;

    // ── Parse Body ──
    const body: unknown = await request.json();
    const parsed = QrApproveSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid request body",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { challengeId } = parsed.data;

    // ── Look Up Challenge in Redis ──
    const redisKey = `challenge:${challengeId}`;
    const raw = await redis.get(redisKey);

    // If not found → 404 NOT_FOUND
    if (!raw) {
      return errorResponse(ERROR_CODES.NOT_FOUND, "Challenge not found or expired");
    }

    let challenge: { status: string; userId: string | null; deviceInfo: string };
    try {
      challenge = JSON.parse(raw) as { status: string; userId: string | null; deviceInfo: string };
    } catch {
      return errorResponse(ERROR_CODES.INTERNAL_ERROR, "Invalid challenge data in cache");
    }

    // If already APPROVED → 409 CONFLICT (single-use enforcement)
    // AGENTS.md Rule 56: Challenge is single-use (status: PENDING → APPROVED)
    if (challenge.status === "APPROVED") {
      return errorResponse(ERROR_CODES.CONFLICT, "Challenge has already been approved");
    }

    // ── Approve the Challenge ──
    // Update Redis: set status to APPROVED, record userId
    challenge.status = "APPROVED";
    challenge.userId = userId;

    // Extend TTL to 10s to give the web client time to consume the result
    // docs/03-api-websocket-contract.md: "TTL remaining time is extended to 10s"
    await redis.setex(redisKey, CHALLENGE_TTL_EXTEND_SECONDS, JSON.stringify(challenge));

    // ── Publish to WebSocket Channel ──
    // docs/03-api-websocket-contract.md: Publish AUTH_COMPLETE event to the WebSocket channel
    // The realtime server subscribes to Redis pub/sub and forwards to the client via WebSocket
    const wsChannel = `auth_${challengeId}`;
    const publishPayload = JSON.stringify({
      type: "AUTH_COMPLETE",
      challengeId,
      userId,
      status: "APPROVED",
    });
    await redis.publish(wsChannel, publishPayload);

    // ── Response 200 ──
    return NextResponse.json({ status: "APPROVED" }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
