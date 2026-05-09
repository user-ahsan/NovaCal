// ─── Room/Channel Management ───
// Manages WebSocket rooms per workspace and Redis Pub/Sub for horizontal scaling.
// Also handles auth channel subscriptions for the QR bridge (AUTH_COMPLETE relay).

import { WebSocket } from "ws";
import type { Redis } from "ioredis";
import crypto from "crypto";

// ─── Types ───
interface ClientMeta {
  userId: string;
  userName: string;
  workspaceId: string;
}

// ─── State ───
const rooms = new Map<string, Set<WebSocket>>();
const clientMetadata = new Map<WebSocket, ClientMeta>();
const authSubscribers = new Map<string, WebSocket>(); // channelId → WS (QR bridge)

const SERVER_ID = crypto.randomUUID();

let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;

// ─── Setup ───

export function setupRoomManager(redisPub: Redis, redisSub: Redis) {
  redisPubClient = redisPub;
  redisSubClient = redisSub;

  // Subscribe to workspace channels for cross-server event broadcast
  redisSub.psubscribe("ws:*");
  // Subscribe to auth channels for QR bridge AUTH_COMPLETE forwarding
  redisSub.psubscribe("auth:*");

  redisSub.on("pmessage", (_pattern: string, channel: string, message: string) => {
    try {
      if (channel.startsWith("auth:")) {
        // ─── AUTH_COMPLETE: Forward QR bridge approval to browser ───
        const channelId = channel.replace("auth:", "");
        const ws = authSubscribers.get(channelId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          const parsed = JSON.parse(message);
          ws.send(
            JSON.stringify({
              event: "AUTH_COMPLETE",
              payload: parsed.payload || parsed,
            })
          );
        }
        return;
      }

      if (channel.startsWith("ws:")) {
        // ─── Workspace event: Broadcast to all local clients in room ───
        const workspaceId = channel.replace("ws:", "");
        const parsed = JSON.parse(message);

        // Skip messages we published ourselves (anti-double-broadcast)
        if (parsed._origin === SERVER_ID) return;

        const room = rooms.get(workspaceId);
        if (!room || room.size === 0) return;

        // Strip internal routing fields
        const { _origin: _, ...cleanPayload } = parsed;
        const forwardMsg = JSON.stringify(cleanPayload);

        for (const ws of room) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(forwardMsg);
          }
        }
      }
    } catch (err) {
      console.error("Redis Pub/Sub handler error:", err);
    }
  });
}

// ─── Room Operations ───

export function joinRoom(
  ws: WebSocket,
  workspaceId: string,
  meta: { userId: string; userName: string }
): void {
  if (!rooms.has(workspaceId)) {
    rooms.set(workspaceId, new Set());
  }
  rooms.get(workspaceId)!.add(ws);
  clientMetadata.set(ws, { ...meta, workspaceId });
}

export function leaveRoom(ws: WebSocket): ClientMeta | null {
  const meta = clientMetadata.get(ws);
  if (!meta) return null;

  const room = rooms.get(meta.workspaceId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(meta.workspaceId);
    }
  }

  clientMetadata.delete(ws);
  return meta;
}

export function getClientMetadata(ws: WebSocket): ClientMeta | undefined {
  return clientMetadata.get(ws);
}

// ─── Broadcast ───

export function broadcastToRoom(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
  excludeWs?: WebSocket
): void {
  const room = rooms.get(workspaceId);
  if (!room || room.size === 0) return;

  const message = JSON.stringify({ event, payload });

  // Broadcast to all local clients in the room
  for (const ws of room) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }

  // Publish to Redis for other server instances (horizontal scaling)
  if (redisPubClient) {
    redisPubClient.publish(
      `ws:${workspaceId}`,
      JSON.stringify({ event, payload, _origin: SERVER_ID })
    );
  }
}

// ─── Auth Channel Subscription (QR Bridge) ───

export function subscribeToAuthChannel(ws: WebSocket, channelId: string): void {
  authSubscribers.set(channelId, ws);

  // Auto-cleanup when client disconnects
  ws.on("close", () => {
    authSubscribers.delete(channelId);
  });
  ws.on("error", () => {
    authSubscribers.delete(channelId);
  });
}
