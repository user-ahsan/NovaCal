// ─── POST /api/auth/qr/init ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/qr/init
// Generates a QR auth challenge. Rate limited: 10 req/min per IP.
// AGENTS.md Rules 55-56: QR: 60s TTL, single-use, UUID unguessable, wsChannel UUID-based

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import redis from "../../../../../lib/redis";
import { errorResponse, handleApiError, ERROR_CODES } from "../../../../../lib/errors";
import {
  getClientIp,
  checkRateLimit,
} from "../../../../../lib/auth";

// ─── Request Validation Schema ───
const QrInitSchema = z.object({
  deviceInfo: z.string().min(1, "deviceInfo is required"),
});

const QR_TTL_SECONDS = 60;

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
    const parsed = QrInitSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Invalid request body",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { deviceInfo } = parsed.data;

    // ── Generate Challenge ──
    // AGENTS.md Rule 56: Challenge UUID is unguessable (crypto.randomUUID for v4)
    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);

    // AGENTS.md Rule 55-56: WebSocket channel is UUID-based (no auth needed on WS)
    const wsChannel = `auth_${challengeId}`;

    // ── Store in Redis ──
    // docs/03-api-websocket-contract.md Backend actions:
    // challenge:{challengeId} → { status: "PENDING", userId: null, deviceInfo } with TTL 60s
    const challengeData = JSON.stringify({
      status: "PENDING",
      userId: null,
      deviceInfo,
      createdAt: new Date().toISOString(),
    });

    await redis.setex(`challenge:${challengeId}`, QR_TTL_SECONDS, challengeData);

    // ── Response 201 ──
    return NextResponse.json(
      {
        challengeId,
        expiresAt: expiresAt.toISOString(),
        wsChannel,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
