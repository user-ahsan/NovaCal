// ─── Presence Tracking ───
// Tracks which users are currently online per workspace.
// Used to broadcast USER_ONLINE / USER_OFFLINE and for "Who's here" features.

import { broadcastToRoom } from "../rooms/index.js";

// workspaceId → Set<userId>
const workspacePresence = new Map<string, Set<string>>();

export function addUser(workspaceId: string, userId: string): void {
  if (!workspacePresence.has(workspaceId)) {
    workspacePresence.set(workspaceId, new Set());
  }
  workspacePresence.get(workspaceId)!.add(userId);
}

export function removeUser(workspaceId: string, userId: string): void {
  const presence = workspacePresence.get(workspaceId);
  if (!presence) return;

  presence.delete(userId);
  if (presence.size === 0) {
    workspacePresence.delete(workspaceId);
  }
}

export function getOnlineUsers(workspaceId: string): string[] {
  const users = workspacePresence.get(workspaceId);
  return users ? Array.from(users) : [];
}
