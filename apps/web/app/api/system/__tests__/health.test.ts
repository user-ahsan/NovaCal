// ─── Health Check Tests ───
// Source: docs/03-api-websocket-contract.md §8 — GET /health
// Acceptance criteria:
//   Returns { status, postgres, redis, uptime, version }
//   No auth required
//   Returns 503 if PG or Redis is down

import { describe, it, expect, beforeAll, vi } from "vitest";

// ─── Mocks ───

const mockDb = {
  execute: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

const { GET } = await import("../health/route");

describe("GET /api/system/health", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with status, postgres, redis, uptime, version when all healthy", async () => {
    mockDb.execute.mockResolvedValue([{ "?column?": 1 }]);
    const originalUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://localhost:6379";

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.postgres).toBe("connected");
    expect(body.redis).toBe("connected");
    expect(body).toHaveProperty("uptime");
    expect(body.version).toBe("1.0.0");

    process.env.REDIS_URL = originalUrl;
  });

  it("should return 503 when PostgreSQL is down", async () => {
    mockDb.execute.mockRejectedValue(new Error("Connection refused"));
    const originalUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://localhost:6379";

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.postgres).toBe("disconnected");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("version");

    process.env.REDIS_URL = originalUrl;
  });

  it("should return 200 (healthy) when Redis URL is not set but PG is healthy", async () => {
    mockDb.execute.mockResolvedValue([{ "?column?": 1 }]);
    const originalUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;

    const res = await GET();
    const body = await res.json();

    // When REDIS_URL is not set, the health check still reports connected (per the implementation)
    // The health endpoint tries to connect but gracefully reports status
    expect(res.status).toBe(200);
    expect(body.postgres).toBe("connected");

    process.env.REDIS_URL = originalUrl;
  });

  it("should be accessible without authentication", async () => {
    mockDb.execute.mockResolvedValue([{ "?column?": 1 }]);
    const originalUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://localhost:6379";

    // No auth headers, no session — should still work
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");

    process.env.REDIS_URL = originalUrl;
  });

  it("should return numeric uptime in seconds", async () => {
    mockDb.execute.mockResolvedValue([{ "?column?": 1 }]);
    const originalUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://localhost:6379";

    const res = await GET();
    const body = await res.json();

    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);

    process.env.REDIS_URL = originalUrl;
  });
});
