// ─── Event Mutation Handlers ───
// Processes inbound event mutations (EVENT_MOVE) and AUTH_COMPLETE relay.
//
// Outbound events broadcast to room:
//   EVENT_CREATED, EVENT_UPDATED, EVENT_DELETED, USER_ONLINE, USER_OFFLINE,
//   MEMBER_ADDED, MEMBER_REMOVED, MEMBER_UPDATED
//
// AUTH_COMPLETE is relayed via auth channel subscriptions in rooms/index.ts.

import { WebSocket } from "ws";
import { eq } from "drizzle-orm";
import { db } from "@novacal/db/client";
import { events } from "@novacal/db/schema";
import { broadcastToRoom, getClientMetadata } from "../rooms/index.js";

/**
 * Handle EVENT_MOVE: drag-and-drop rescheduling from the client.
 * Validates payload, updates the database, broadcasts EVENT_UPDATED to the room.
 */
export async function handleEventMove(
  ws: WebSocket,
  payload: { eventId?: string; startTime?: string; endTime?: string }
): Promise<void> {
  const { eventId, startTime, endTime } = payload;

  // ── Validate payload ──
  if (!eventId || !startTime || !endTime) {
    sendError(ws, "eventId, startTime, and endTime are required");
    return;
  }

  const meta = getClientMetadata(ws);
  if (!meta) return; // Not authenticated / not in a room

  // ── Parse timestamps ──
  const parsedStart = new Date(startTime);
  const parsedEnd = new Date(endTime);

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    sendError(ws, "Invalid date format in startTime or endTime");
    return;
  }

  // ── Update event in database ──
  try {
    await db
      .update(events)
      .set({
        startTime: parsedStart,
        endTime: parsedEnd,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    // ── Broadcast EVENT_UPDATED to workspace room ──
    broadcastToRoom(
      meta.workspaceId,
      "EVENT_UPDATED",
      {
        eventId,
        actor: { id: meta.userId, name: meta.userName },
        changes: { startTime, endTime },
      },
      ws // Exclude origin client (they already applied the optimistic update)
    );
  } catch (err) {
    console.error("EVENT_MOVE handler error:", err);
    sendError(ws, "Failed to update event");
  }
}

// ─── Helpers ───

function sendError(ws: WebSocket, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event: "ERROR", payload: { message } }));
  }
}
