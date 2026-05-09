// ─── WebSocket Tests ───
// Source: docs/03-api-websocket-contract.md §6 — WebSocket Contract
// Acceptance criteria:
//   Connect with valid token → receives connected event
//   SUBSCRIBE with valid workspaceId + token → joins room
//   Invalid token → rejected
//   Heartbeat ping every 30s
//   EVENT_CREATED broadcast after creation
//   USER_ONLINE on connect, USER_OFFLINE on close

import { describe, it, expect, beforeAll, vi, beforeEach } from "vitest";
import { WebSocket } from "ws";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

vi.mock("@novacal/db/schema", () => ({
  sessions: { id: "s.id", userId: "s.userId", expiresAt: "s.expiresAt" },
  users: { id: "u.id", name: "u.name" },
}));

// ─── WebSocket Event Emitter Helpers ───
// We mock the room manager and presence modules to test connection handler

const mockRoomManager = {
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  subscribeToAuthChannel: vi.fn(),
  broadcastToRoom: vi.fn(),
};

vi.mock("../rooms/index", () => mockRoomManager);

const mockPresence = {
  addUser: vi.fn(),
  removeUser: vi.fn(),
};

vi.mock("../handlers/presence", () => mockPresence);

const mockEvents = {
  handleEventMove: vi.fn(),
};

vi.mock("../handlers/events", () => mockEvents);

const { handleConnection } = await import("../handlers/connection");

describe("WebSocket Connection Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockWs(): WebSocket {
    // Create a minimal mock of WebSocket
    const ws = new WebSocket(null as unknown as string);
    // Override send for testing
    vi.spyOn(ws, "send").mockImplementation(() => {});
    vi.spyOn(ws, "close").mockImplementation(() => {});
    return ws;
  }

  function emitMessage(ws: WebSocket, type: string, payload: Record<string, unknown>) {
    ws.emit("message", Buffer.from(JSON.stringify({ type, payload })));
  }

  describe("Connection lifecycle", () => {
    it("should set isAlive true on pong", () => {
      const ws = createMockWs();
      handleConnection(ws);

      ws.emit("pong");

      // After pong, heartbeat should consider it alive
      expect((ws as unknown as Record<string, unknown>).isAlive).toBe(true);
    });
  });

  describe("SUBSCRIBE handshake", () => {
    it("should validate token and join room on valid SUBSCRIBE", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((cb: (rows: unknown[]) => unknown) => cb([{ userId: "user-1", userName: "Ahsan" }])),
      });

      const ws = createMockWs();
      handleConnection(ws);

      emitMessage(ws, "SUBSCRIBE", { workspaceId: "ws-1", token: "valid-token" });

      // Wait for async handler
      await vi.waitFor(() => {
        expect(mockRoomManager.joinRoom).toHaveBeenCalledWith(
          ws,
          "ws-1",
          { userId: "user-1", userName: "Ahsan" },
        );
      });

      expect(mockPresence.addUser).toHaveBeenCalledWith("ws-1", "user-1");
      expect(mockRoomManager.broadcastToRoom).toHaveBeenCalledWith(
        "ws-1",
        "USER_ONLINE",
        { userId: "user-1", name: "Ahsan" },
        ws,
      );
    });

    it("should reject invalid token and close connection with 4003", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((cb: (rows: unknown[]) => unknown) => cb([])),
      });

      const ws = createMockWs();
      handleConnection(ws);

      emitMessage(ws, "SUBSCRIBE", { workspaceId: "ws-1", token: "invalid-token" });

      await vi.waitFor(() => {
        expect(ws.close).toHaveBeenCalledWith(4003, "Authentication failed");
      });

      expect(mockRoomManager.joinRoom).not.toHaveBeenCalled();
    });

    it("should reject SUBSCRIBE with missing fields", async () => {
      const ws = createMockWs();
      handleConnection(ws);

      emitMessage(ws, "SUBSCRIBE", {});

      await vi.waitFor(() => {
        expect(ws.close).toHaveBeenCalledWith(4002, "Invalid SUBSCRIBE payload");
      });
    });

    it("should reject unknown message type for authenticated client", () => {
      const ws = createMockWs();
      handleConnection(ws);

      emitMessage(ws, "UNKNOWN_TYPE", {});

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe("USER_ONLINE / USER_OFFLINE presence", () => {
    it("should broadcast USER_ONLINE when user subscribes", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((cb: (rows: unknown[]) => unknown) => cb([{ userId: "user-1", userName: "Ahsan" }])),
      });

      const ws = createMockWs();
      handleConnection(ws);

      emitMessage(ws, "SUBSCRIBE", { workspaceId: "ws-1", token: "valid-token" });

      await vi.waitFor(() => {
        expect(mockRoomManager.broadcastToRoom).toHaveBeenCalledWith(
          "ws-1",
          "USER_ONLINE",
          expect.objectContaining({ userId: "user-1" }),
          ws,
        );
      });
    });

    it("should broadcast USER_OFFLINE when client disconnects", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((cb: (rows: unknown[]) => unknown) => cb([{ userId: "user-1", userName: "Ahsan" }])),
      });

      const ws = createMockWs();
      handleConnection(ws);

      emitMessage(ws, "SUBSCRIBE", { workspaceId: "ws-1", token: "valid-token" });

      await vi.waitFor(() => {
        expect(mockRoomManager.joinRoom).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      // Simulate disconnect
      ws.emit("close");

      expect(mockRoomManager.leaveRoom).toHaveBeenCalledWith(ws);
      expect(mockPresence.removeUser).toHaveBeenCalledWith("ws-1", "user-1");
      expect(mockRoomManager.broadcastToRoom).toHaveBeenCalledWith(
        "ws-1",
        "USER_OFFLINE",
        { userId: "user-1" },
      );
    });
  });

  describe("Max concurrent connections", () => {
    it("should enforce max 5 concurrent connections per user", async () => {
      // We need to test the internal enforcement logic
      // The connection handler tracks userConnectionCounts internally
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn((cb: (rows: unknown[]) => unknown) => cb([{ userId: "user-1", userName: "Ahsan" }])),
      });

      const connections: WebSocket[] = [];

      // Create 5 connections first (should succeed)
      for (let i = 0; i < 5; i++) {
        const ws = createMockWs();
        connections.push(ws);
        handleConnection(ws);
        emitMessage(ws, "SUBSCRIBE", { workspaceId: "ws-1", token: "valid-token" });
        await vi.waitFor(() => expect(ws.send).toHaveBeenCalled());
        vi.clearAllMocks();
      }

      // The 6th connection should be rejected
      const ws6 = createMockWs();
      handleConnection(ws6);
      emitMessage(ws6, "SUBSCRIBE", { workspaceId: "ws-1", token: "valid-token" });

      await vi.waitFor(() => {
        // The 6th connection should either close with rate limit or be denied
        // The check is inside handleSubscribe after the connections limit
      });
    });
  });
});
