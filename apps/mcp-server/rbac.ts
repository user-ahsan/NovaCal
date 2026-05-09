// ─── MCP RBAC — Per-Tool Role Enforcement ───
//
// Every MCP tool has a minimum role requirement.
// The calling user's role is checked against MINIMUM_ROLE_HIERARCHY
// using the numeric ROLE_HIERARCHY from @novacal/shared.
//
// Role levels (highest → lowest):
//   OWNER=100 > ADMIN=80 > EDITOR=60 > VIEWER=40 > FREE_BUSY=20

import { and, eq } from "drizzle-orm";
import { db } from "@novacal/db";
import { workspaceMembers } from "@novacal/db/schema";
import { ROLE_HIERARCHY } from "@novacal/shared";
import type { WorkspaceRole } from "@novacal/shared";

// ─── Minimum Role Per Tool ───
// Maps each tool name to the minimum WorkspaceRole required.
export const MINIMUM_ROLE_HIERARCHY: Record<string, WorkspaceRole> = {
  list_events: "VIEWER",
  create_event: "EDITOR",
  update_event: "EDITOR",
  delete_event: "EDITOR",
  find_common_time: "VIEWER",
  get_availability: "FREE_BUSY",
  search_events: "VIEWER",
  get_upcoming_events: "VIEWER",
};

// ─── assertMinimumRole ───
// Looks up the user's role in the given workspace and throws if it
// does not meet the minimum required role level.
//
// @param userId    - The authenticated user's ID
// @param workspaceId - The workspace to check membership in
// @param minimumRole - The minimum role required (e.g., "EDITOR")
// @throws Error with descriptive message if access is denied
export async function assertMinimumRole(
  userId: string,
  workspaceId: string,
  minimumRole: string,
): Promise<void> {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.userId, userId),
      eq(workspaceMembers.workspaceId, workspaceId),
    ),
  });

  if (!membership) {
    throw new Error(
      `Access denied: user is not a member of workspace ${workspaceId}`,
    );
  }

  const roleLevel = ROLE_HIERARCHY[membership.role as WorkspaceRole];
  const requiredLevel = ROLE_HIERARCHY[minimumRole as WorkspaceRole];

  if (roleLevel === undefined) {
    throw new Error(`Unknown user role: ${membership.role}`);
  }

  if (requiredLevel === undefined) {
    throw new Error(`Unknown minimum role: ${minimumRole}`);
  }

  if (roleLevel < requiredLevel) {
    throw new Error(
      `Insufficient permissions: requires ${minimumRole}, user has ${membership.role}`,
    );
  }
}
