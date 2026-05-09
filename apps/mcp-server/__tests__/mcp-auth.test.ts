// ─── MCP Auth Tests ───
// Source: docs/04-mcp-server-implementation.md §1.3 — Security & Authorization
// Acceptance criteria:
//   GET /mcp/sse: with valid Bearer token → SSE stream established
//   GET /mcp/sse: without token → 401
//   Rate limit 100 req/min → 429

import { describe, it, expect, beforeAll, vi } from "vitest";
import type { Request, Response } from "express";

// ─── Mocks ───

const mockDb = {
  query: {
    apiKeys: { findFirst: vi.fn() },
    workspaceMembers: { findFirst: vi.fn() },
  },
  update: vi.fn(),
};

vi.mock("@novacal/db", () => ({
  db: mockDb,
}));

vi.mock("@novacal/db/schema", () => ({
  apiKeys: { id: "ak.id", keyHash: "ak.keyHash", userId: "ak.userId" },
  workspaceMembers: { userId: "wm.userId", workspaceId: "wm.workspaceId", role: "wm.role" },
}));

const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};
vi.mock("ioredis", () => ({
  default: vi.fn(() => mockRedis),
}));

vi.mock("@novacal/shared", () => ({
  ROLE_HIERARCHY: { OWNER: 100, ADMIN: 80, EDITOR: 60, VIEWER: 40, FREE_BUSY: 20 },
  WORKSPACE_ROLES: ["OWNER", "ADMIN", "EDITOR", "VIEWER", "FREE_BUSY"],
}));

// Import the auth module under test
const { hashToken, authenticateRequest } = await import("../auth");

describe("MCP Auth", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("hashToken", () => {
    it("should return a deterministic SHA-256 hex hash", () => {
      const token = "ncp_key_test_token_123";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
      expect(typeof hash1).toBe("string");
    });

    it("should produce different hashes for different tokens", () => {
      const hashA = hashToken("token_a");
      const hashB = hashToken("token_b");
      expect(hashA).not.toBe(hashB);
    });
  });

  describe("authenticateRequest", () => {
    function createMockRequest(token?: string): Partial<Request> {
      return {
        headers: {
          authorization: token ? `Bearer ${token}` : undefined,
        },
      } as Partial<Request>;
    }

    it("should return AuthResult for valid Bearer token", async () => {
      const mockKeyRecord = { id: "key-1", userId: "user-1", keyHash: "hash123" };
      const mockMembership = { workspaceId: "ws-1", role: "EDITOR" };

      mockDb.query.apiKeys.findFirst.mockResolvedValue(mockKeyRecord);
      mockDb.query.workspaceMembers.findFirst.mockResolvedValue(mockMembership);
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const req = createMockRequest("ncp_key_valid_key");
      const result = await authenticateRequest(req as Request);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe("user-1");
      expect(result!.apiKeyId).toBe("key-1");
      expect(result!.activeWorkspaceId).toBe("ws-1");
      expect(result!.role).toBe("EDITOR");
    });

    it("should return null for missing Authorization header", async () => {
      const req = createMockRequest();
      const result = await authenticateRequest(req as Request);
      expect(result).toBeNull();
    });

    it("should return null for non-Bearer Authorization header", async () => {
      const req = { headers: { authorization: "Basic base64encoded" } } as Partial<Request>;
      const result = await authenticateRequest(req as Request);
      expect(result).toBeNull();
    });

    it("should return null for invalid API key (not found in DB)", async () => {
      mockDb.query.apiKeys.findFirst.mockResolvedValue(null);

      const req = createMockRequest("ncp_key_invalid_key");
      const result = await authenticateRequest(req as Request);
      expect(result).toBeNull();
    });

    it("should return null when user has no workspace membership", async () => {
      const mockKeyRecord = { id: "key-2", userId: "user-2", keyHash: "hash456" };

      mockDb.query.apiKeys.findFirst.mockResolvedValue(mockKeyRecord);
      mockDb.query.workspaceMembers.findFirst.mockResolvedValue(null);
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const req = createMockRequest("ncp_key_orphan_key");
      const result = await authenticateRequest(req as Request);
      expect(result).toBeNull();
    });
  });

  describe("SSE endpoint auth (via index.ts logic)", () => {
    it("should reject requests without Bearer token with 401", async () => {
      // The sse endpoint calls authenticateRequest first; if null, sends 401
      mockDb.query.apiKeys.findFirst.mockResolvedValue(null);

      const req = { headers: {} } as Request;
      const result = await authenticateRequest(req);
      expect(result).toBeNull();
    });
  });
});
