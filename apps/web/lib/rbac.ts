// ─── Workspace RBAC (Role-Based Access Control) ───
// Source: AGENTS.md Rule 43 (role hierarchy), docs/01-database-schema.md §2

import { db } from "@novacal/db/client";
import { workspaceMembers } from "@novacal/db/schema";
import { eq, and } from "drizzle-orm";
import { ROLE_HIERARCHY } from "@novacal/shared";
import type { WorkspaceRole } from "@novacal/shared";
import { ApiRequestError, ERROR_CODES } from "./errors";

/**
 * Checks that the user has at least the specified role in the workspace.
 * Throws ApiRequestError if membership is missing or role is insufficient.
 * Returns the workspace member record on success.
 */
export async function requireRole(
  userId: string,
  workspaceId: string,
  minimumRole: WorkspaceRole,
) {
  const member = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!member[0]) {
    throw new ApiRequestError(
      ERROR_CODES.FORBIDDEN,
      "User is not a member of this workspace",
    );
  }

  const userLevel = ROLE_HIERARCHY[member[0].role as WorkspaceRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole];

  if (userLevel < requiredLevel) {
    throw new ApiRequestError(
      ERROR_CODES.FORBIDDEN,
      `Insufficient permissions. Required role: ${minimumRole}, current: ${member[0].role}`,
    );
  }

  return member[0];
}

/**
 * Shorthand for requireRole(userId, workspaceId, "EDITOR").
 */
export async function requireEditor(userId: string, workspaceId: string) {
  return requireRole(userId, workspaceId, "EDITOR");
}
