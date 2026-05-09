// ─── QR Auth Bridge Tests ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/qr/init & POST /auth/qr/approve
// AGENTS.md Rules 55-56: 60s TTL, single-use challenge, UUID unguessable
// Acceptance criteria:
//   POST /auth/qr/init: creates Redis challenge, returns challengeId + expiresAt + wsChannel
//   POST /auth/qr/approve: valid challenge returns APPROVED
//     consumed challenge returns 409 CONFLICT
//     expired challenge returns 404 NOT_FOUND

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Redis Mock ───
const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  publish: vi.fn(),
};

vi.mock("../../../../../lib/redis", () => ({
  default: mockRedis,
}));

// ─── Errors Mock ───
const mockErrors = {
  errorResponse: vi.fn((code, msg, status?, details?) =>
    new Response(JSON.stringify({ error: { code, message: msg, details: details ?? {} } }), {
      status: status ?? 400,
      headers: { "Content-Type": "application/json" },
    }),
  ),
  handleApiError: vi.fn((err: unknown) =>
    new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: (err as Error).message, details: {} } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }),
  ),
  ERROR_CODES: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    CONFLICT: "CONFLICT",
    UNAUTHORIZED: "UNAUTHORIZED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
  },
};

vi.mock("../../../../../lib/errors", () => mockErrors);

// ─── Auth Lib Mock ───
const mockAuth = {
  generateSessionToken: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  checkRateLimit: vi.fn(),
};

vi.mock("../../../../../lib/auth", () => mockAuth);

// ─── Validate Session Mock ───
const mockValidateSession = vi.fn();
vi.mock("../../../../../lib/validate-session", () => ({
  validateSession: mockValidateSession,
}));

// ─── Imports ───
// Need to bypass NextResponse.next() issues — use a simple Response-based mock
const { POST: postInit } = await import("../qr/init/route");
const { POST: postApprove } = await import("../qr/approve/route");

function createInitRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/auth/qr/init"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

function createApproveRequest(body: unknown, token?: string): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new NextRequest(new URL("http://localhost:3000/api/auth/qr/approve"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("QR Auth Bridge", () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
  });

  describe("POST /api/auth/qr/init", () => {
    it("should return 201 with challengeId, expiresAt, and wsChannel", async () => {
      const req = createInitRequest({ deviceInfo: "Chrome on Windows" });
      const res = await postInit(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body).toHaveProperty("challengeId");
      expect(body).toHaveProperty("expiresAt");
      expect(body).toHaveProperty("wsChannel");
      expect(body.wsChannel).toContain("auth_");
      expect(typeof body.challengeId).toBe("string");
      expect(typeof body.wsChannel).toBe("string");
    });

    it("should store challenge in Redis with 60s TTL and PENDING status", async () => {
      mockRedis.setex.mockClear();
      const req = createInitRequest({ deviceInfo: "Firefox on Linux" });
      await postInit(req);

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      const [key, ttl, value] = mockRedis.setex.mock.calls[0];
      expect(key).toContain("challenge:");
      expect(ttl).toBe(60);
      const parsed = JSON.parse(value);
      expect(parsed.status).toBe("PENDING");
      expect(parsed.userId).toBeNull();
      expect(parsed.deviceInfo).toBe("Firefox on Linux");
    });

    it("should return 400 VALIDATION_ERROR when deviceInfo is missing", async () => {
      const req = createInitRequest({});
      const res = await postInit(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/qr/approve", () => {
    const validChallengeId = "550e8400-e29b-41d4-a716-446655440000";

    it("should return 200 APPROVED for a valid PENDING challenge", async () => {
      mockValidateSession.mockResolvedValue({ userId: "mobile-user-id", userName: "Mobile User", userEmail: "mobile@test.com" });
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "PENDING", userId: null, deviceInfo: "Chrome" }));
      mockRedis.setex.mockResolvedValue("OK");
      mockRedis.publish.mockResolvedValue(1);

      const req = createApproveRequest({ challengeId: validChallengeId }, "mobile-session-token");
      const res = await postApprove(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("APPROVED");
    });

    it("should extend TTL to 10s after approval", async () => {
      mockValidateSession.mockResolvedValue({ userId: "mobile-user-id", userName: "Mobile User", userEmail: "mobile@test.com" });
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "PENDING", userId: null, deviceInfo: "Chrome" }));
      mockRedis.setex.mockResolvedValue("OK");
      mockRedis.publish.mockResolvedValue(1);

      const req = createApproveRequest({ challengeId: validChallengeId }, "mobile-session-token");
      await postApprove(req);

      // The last setex call should have TTL of 10s
      const setexCalls = mockRedis.setex.mock.calls;
      const lastSetex = setexCalls[setexCalls.length - 1];
      expect(lastSetex[1]).toBe(10);
    });

    it("should publish AUTH_COMPLETE to Redis Pub/Sub after approval", async () => {
      mockValidateSession.mockResolvedValue({ userId: "mobile-user-id", userName: "Mobile User", userEmail: "mobile@test.com" });
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "PENDING", userId: null, deviceInfo: "Chrome" }));
      mockRedis.setex.mockResolvedValue("OK");
      mockRedis.publish.mockResolvedValue(1);

      const req = createApproveRequest({ challengeId: validChallengeId }, "mobile-session-token");
      await postApprove(req);

      expect(mockRedis.publish).toHaveBeenCalled();
      const publishCall = mockRedis.publish.mock.calls[0];
      expect(publishCall[0]).toBe(`auth_${validChallengeId}`);
      const publishPayload = JSON.parse(publishCall[1]);
      expect(publishPayload.type).toBe("AUTH_COMPLETE");
      expect(publishPayload.status).toBe("APPROVED");
    });

    it("should return 409 CONFLICT for an already APPROVED challenge (single-use)", async () => {
      mockValidateSession.mockResolvedValue({ userId: "mobile-user-id", userName: "Mobile User", userEmail: "mobile@test.com" });
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "APPROVED", userId: "some-user", deviceInfo: "Chrome" }));

      const req = createApproveRequest({ challengeId: validChallengeId }, "mobile-session-token");
      const res = await postApprove(req);
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error.code).toBe("CONFLICT");
      expect(body.error.message).toContain("already been approved");
    });

    it("should return 404 NOT_FOUND for expired/missing challenge in Redis", async () => {
      mockValidateSession.mockResolvedValue({ userId: "mobile-user-id", userName: "Mobile User", userEmail: "mobile@test.com" });
      mockRedis.get.mockResolvedValue(null); // Expired or not found

      const req = createApproveRequest({ challengeId: validChallengeId }, "mobile-session-token");
      const res = await postApprove(req);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should return 400 VALIDATION_ERROR for invalid challengeId UUID format", async () => {
      mockValidateSession.mockResolvedValue({ userId: "mobile-user-id", userName: "Mobile User", userEmail: "mobile@test.com" });

      const req = createApproveRequest({ challengeId: "not-a-uuid" }, "mobile-session-token");
      const res = await postApprove(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 401 UNAUTHORIZED when no auth token provided", async () => {
      mockValidateSession.mockRejectedValue(
        new (class extends Error {
          code = "UNAUTHORIZED";
          statusCode = 401;
          details = {};
          constructor() {
            super("Missing or invalid Authorization header");
            this.name = "ApiRequestError";
          }
        })(),
      );

      const req = createApproveRequest({ challengeId: validChallengeId });
      const res = await postApprove(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
