// ─── Workspace API Tests ───
// Source: docs/03-api-websocket-contract.md §2 — Workspaces & Members
// Acceptance criteria:
//   POST: creates with creator as OWNER
//   GET: lists user's workspaces
//   PATCH: Owner/Admin can update, non-Owner/Admin gets 403
//   DELETE: Owner only (non-Owner gets 403)
//   Owner cannot be removed from workspace

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

vi.mock("@novacal/db/schema", () => ({
  workspaces: { id: "ws.id", name: "ws.name", slug: "ws.slug", ownerId: "ws.ownerId", defaultTimezone: "ws.defaultTimezone", createdAt: "ws.createdAt" },
  workspaceMembers: { workspaceId: "wm.workspaceId", userId: "wm.userId", role: "wm.role", joinedAt: "wm.joinedAt" },
  users: { id: "users.id" },
  sessions: { id: "sessions.id", userId: "sessions.userId" },
}));

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 100,
  ADMIN: 80,
  EDITOR: 60,
  VIEWER: 40,
  FREE_BUSY: 20,
};

vi.mock("@novacal/shared", () => ({
  ROLE_HIERARCHY,
  WORKSPACE_ROLES: ["OWNER", "ADMIN", "EDITOR", "VIEWER", "FREE_BUSY"],
}));

const { GET, POST } = await import("../route");
const { PATCH, DELETE } = await import("../[id]/route");

// ─── Helpers ───

function createGetRequest(token: string): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/workspaces"), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function createPostRequest(token: string, body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/workspaces"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createPatchRequest(token: string, workspaceId: string, body: unknown): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000/api/workspaces/${workspaceId}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(token: string, workspaceId: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000/api/workspaces/${workspaceId}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockSession(token: string, userId: string) {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(token ? [{ userId }] : []),
  });
}

describe("Workspace API", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/workspaces — Create workspace", () => {
    it("should create workspace with creator as OWNER, returning 201", async () => {
      mockSession("valid-token", "user-1");

      // Reset the mock select to handle sequential calls
      vi.mocked(mockDb.select).mockReset();

      // First select after creation check (but that's internal)
      // Insert workspace
      const mockWorkspace = { id: "ws-1", name: "Engineering", slug: "engineering-abc123", ownerId: "user-1", defaultTimezone: "Asia/Karachi", createdAt: new Date() };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockWorkspace]),
        }),
      });

      // Insert workspace_members
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const req = createPostRequest("valid-token", { name: "Engineering", timezone: "Asia/Karachi" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBe("ws-1");
      expect(body.name).toBe("Engineering");
      expect(body.role).toBe("OWNER");
      expect(body.defaultTimezone).toBe("Asia/Karachi");
    });

    it("should default to UTC timezone when not provided", async () => {
      mockSession("valid-token", "user-1");
      vi.mocked(mockDb.select).mockReset();

      const mockWorkspace = { id: "ws-2", name: "Marketing", slug: "marketing-def456", ownerId: "user-1", defaultTimezone: "UTC", createdAt: new Date() };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockWorkspace]),
        }),
      });
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const req = createPostRequest("valid-token", { name: "Marketing" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.defaultTimezone).toBe("UTC");
    });

    it("should return 400 VALIDATION_ERROR when name is missing", async () => {
      mockSession("valid-token", "user-1");

      const req = createPostRequest("valid-token", {});
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 401 when not authenticated", async () => {
      mockSession("", "");

      const req = createPostRequest("", { name: "Test" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/workspaces — List workspaces", () => {
    it("should return list of workspaces for authenticated user", async () => {
      mockSession("valid-token", "user-1");
      vi.mocked(mockDb.select).mockReset();

      const mockResults = [
        { id: "ws-1", name: "Engineering", role: "OWNER", memberCount: 12, createdAt: new Date("2026-04-01") },
        { id: "ws-2", name: "Marketing", role: "ADMIN", memberCount: 5, createdAt: new Date("2026-04-15") },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockResults),
      });

      const req = createGetRequest("valid-token");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      expect(body[0].name).toBe("Engineering");
      expect(body[0].role).toBe("OWNER");
      expect(body[0].memberCount).toBe(12);
    });

    it("should return empty array when user has no workspaces", async () => {
      mockSession("valid-token", "user-1");
      vi.mocked(mockDb.select).mockReset();

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      const req = createGetRequest("valid-token");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);
    });
  });

  describe("PATCH /api/workspaces/:id — Update workspace", () => {
    it("should allow Owner to update workspace settings", async () => {
      mockSession("valid-token", "user-1");
      vi.mocked(mockDb.select).mockReset();

      // getMemberRole
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ role: "OWNER" }]),
      });

      const updated = { id: "ws-1", name: "Engineering Team", defaultTimezone: "UTC" };
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const req = createPatchRequest("valid-token", "ws-1", { name: "Engineering Team" });
      const res = await PATCH(req, { params: Promise.resolve({ id: "ws-1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("Engineering Team");
    });

    it("should return 403 when non-Owner/Admin tries to update", async () => {
      mockSession("valid-token", "viewer-user");
      vi.mocked(mockDb.select).mockReset();

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ role: "VIEWER" }]),
      });

      const req = createPatchRequest("valid-token", "ws-1", { name: "Hacked" });
      const res = await PATCH(req, { params: Promise.resolve({ id: "ws-1" }) });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 when EDITOR tries to update", async () => {
      mockSession("valid-token", "editor-user");
      vi.mocked(mockDb.select).mockReset();

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ role: "EDITOR" }]),
      });

      const req = createPatchRequest("valid-token", "ws-1", { name: "Hacked" });
      const res = await PATCH(req, { params: Promise.resolve({ id: "ws-1" }) });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("DELETE /api/workspaces/:id — Delete workspace", () => {
    it("should allow OWNER to delete workspace", async () => {
      mockSession("valid-token", "owner-user");
      vi.mocked(mockDb.select).mockReset();

      // getMemberRole returns OWNER
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ role: "OWNER" }]),
      });

      // Verify ownerId match
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ ownerId: "owner-user" }]),
      });

      mockDb.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const req = createDeleteRequest("valid-token", "ws-1");
      const res = await DELETE(req, { params: Promise.resolve({ id: "ws-1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("deleted");
    });

    it("should return 403 when non-Owner tries to delete", async () => {
      mockSession("valid-token", "admin-user");
      vi.mocked(mockDb.select).mockReset();

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ role: "ADMIN" }]),
      });

      const req = createDeleteRequest("valid-token", "ws-1");
      const res = await DELETE(req, { params: Promise.resolve({ id: "ws-1" }) });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 403 when requesting user is not the workspace owner_id", async () => {
      mockSession("valid-token", "other-admin");
      vi.mocked(mockDb.select).mockReset();

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ role: "OWNER" }]),
      });

      // But the actual ownerId is different
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ ownerId: "actual-owner" }]),
      });

      const req = createDeleteRequest("valid-token", "ws-1");
      const res = await DELETE(req, { params: Promise.resolve({ id: "ws-1" }) });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });
});
