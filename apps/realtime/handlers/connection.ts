// ─── WebSocket Connection Handler ───
// Manages the full lifecycle of a WebSocket connection:
// 1. Wait for SUBSCRIBE message with workspaceId + session token
// 2. Validate token against the database (sessions table)
// 3. Enforce max 5 concurrent connections per user
// 4. Join the workspace room and Redis Pub/Sub channel
// 5. Broadcast USER_ONLINE to workspace
// 6. On close: cleanup room membership, broadcast USER_OFFLINE
// 7. Also supports SUBSCRIBE_AUTH for QR bridge auth channels

import { WebSocket } from "ws";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@novacal/db/client";
import { sessions, users } from "@novacal/db/schema";
import {
  joinRoom,
  leaveRoom,
  subscribeToAuthChannel,
  broadcastToRoom,
} from "../rooms/index.js";
import { addUser, removeUser } from "./presence.js";
import { handleEventMove } from "./events.js";

// ─── Constants ───
const MAX_CONNECTIONS_PER_USER = 5;
const SUBSCRIBE_TIMEOUT_MS = 10_000; // 10 seconds to send initial SUBSCRIBE

// userId → Set of active WebSocket connections (for max-concurrent enforcement)
const userConnectionCounts = new Map<string, Set<WebSocket>>();

export function handleConnection(ws: WebSocket): void {
  let authenticated = false;
  let currentUserId = "";
  let currentUserName = "";
  let currentWorkspaceId = "";

  // ─── SUBSCRIBE Timeout ───
  // If the client doesn't send SUBSCRIBE within 10s, close the connection.
  const subscribeTimer = setTimeout(() => {
    if (!authenticated) {
      console.warn("SUBSCRIBE timeout — closing unauthenticated connection");
      ws.close(4001, "SUBSCRIBE timeout");
    }
  }, SUBSCRIBE_TIMEOUT_MS);

  // ─── Handle inbound messages ───
  ws.on("message", async (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case "SUBSCRIBE": {
          const authInfo = await handleSubscribe(ws, msg.payload, subscribeTimer);
          if (authInfo) {
            currentUserId = authInfo.userId;
            currentUserName = authInfo.userName;
            currentWorkspaceId = authInfo.workspaceId;
            authenticated = true;
          }
          break;
        }

        case "SUBSCRIBE_AUTH":
          clearTimeout(subscribeTimer);
          await handleSubscribeAuth(ws, msg.payload);
          break;

        case "EVENT_MOVE":
          if (authenticated) {
            await handleEventMove(ws, msg.payload || {});
          }
          break;

        default:
          if (authenticated) {
            sendError(ws, `Unknown message type: ${msg.type}`);
          }
          break;
      }
    } catch (err) {
      console.error("WebSocket message parse error:", err);
      if (authenticated) {
        sendError(ws, "Invalid JSON message format");
      }
    }
  });

  // ─── On disconnect ───
  ws.on("close", () => {
    // Only process if the client was fully authenticated
    if (!authenticated) return;

    // Release connection slot
    const conns = userConnectionCounts.get(currentUserId);
    if (conns) {
      conns.delete(ws);
      if (conns.size === 0) {
        userConnectionCounts.delete(currentUserId);
      }
    }

    // Leave the workspace room (removes from local room set)
    leaveRoom(ws);

    // Remove presence
    removeUser(currentWorkspaceId, currentUserId);

    // Broadcast USER_OFFLINE to the workspace
    broadcastToRoom(currentWorkspaceId, "USER_OFFLINE", {
      userId: currentUserId,
    });
  });

  // ─── On error ───
  ws.on("error", (err) => {
    console.error("WebSocket connection error:", err);
    ws.close(1011, "Internal server error");
  });
}

// ─── SUBSCRIBE Handler ───

async function handleSubscribe(
  ws: WebSocket,
  payload: { workspaceId?: string; token?: string },
  subscribeTimer: NodeJS.Timeout
): Promise<{ userId: string; userName: string; workspaceId: string } | null> {
  clearTimeout(subscribeTimer);

  const { workspaceId, token } = payload || {};

  if (!workspaceId || !token) {
    sendError(ws, "workspaceId and token are required");
    ws.close(4002, "Invalid SUBSCRIBE payload");
    return null;
  }

  // ── Validate session token against the database ──
  const session = await db
    .select({
      userId: sessions.userId,
      userName: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .then((rows) => rows[0]);

  if (!session) {
    sendError(ws, "Invalid or expired session token");
    ws.close(4003, "Authentication failed");
    return null;
  }

  const userId = session.userId;
  const userName = session.userName;

  // ── Enforce max 5 concurrent connections per user ──
  if (!userConnectionCounts.has(userId)) {
    userConnectionCounts.set(userId, new Set());
  }
  const conns = userConnectionCounts.get(userId)!;

  if (conns.size >= MAX_CONNECTIONS_PER_USER) {
    sendError(ws, "Maximum concurrent connections reached (5)");
    ws.close(4004, "Rate limit exceeded");
    return null;
  }

  conns.add(ws);

  // ── Join the workspace room ──
  joinRoom(ws, workspaceId, { userId, userName });

  // ── Track presence ──
  addUser(workspaceId, userId);

  // ── Broadcast USER_ONLINE to the workspace (exclude this client) ──
  broadcastToRoom(
    workspaceId,
    "USER_ONLINE",
    { userId, name: userName },
    ws
  );

  // ── Send SUBSCRIBED confirmation ──
  ws.send(
    JSON.stringify({
      event: "SUBSCRIBED",
      payload: { workspaceId, userId },
    })
  );

  // Return auth info so handleConnection can store it for cleanup
  return { userId, userName, workspaceId };
}

// ─── SUBSCRIBE_AUTH Handler (QR Bridge) ───

async function handleSubscribeAuth(
  ws: WebSocket,
  payload: { channelId?: string }
): Promise<void> {
  const { channelId } = payload || {};

  if (!channelId) {
    sendError(ws, "channelId is required");
    ws.close(4005, "Invalid SUBSCRIBE_AUTH payload");
    return;
  }

  // Register this WebSocket to receive AUTH_COMPLETE events on this channel
  subscribeToAuthChannel(ws, channelId);

  ws.send(
    JSON.stringify({
      event: "SUBSCRIBED_AUTH",
      payload: { channelId },
    })
  );
}

// ─── Helpers ───

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event: "ERROR", payload: { message } }));
  }
}
