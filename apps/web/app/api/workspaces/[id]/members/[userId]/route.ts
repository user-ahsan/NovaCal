// ─── PATCH /api/workspaces/:id/members/:userId / DELETE /api/workspaces/:id/members/:userId ───
// Updates a member's role or removes them from the workspace.

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { workspaceMembers, workspaces } from "@novacal/db/schema";
import { eq, and } from "drizzle-orm";
import { type WorkspaceRole } from "@novacal/shared";
import {
  errorResponse,
  authenticateRequest,
  getMemberRole,
  hasMinRole,
} from "../../../_helpers";

// Roles that can be assigned via the PATCH endpoint. Never OWNER or ADMIN.
const ASSIGNABLE_ROLES: WorkspaceRole[] = ["EDITOR", "VIEWER", "FREE_BUSY"];

/**
 * PATCH /api/workspaces/:id/members/:userId
 *
 * Update a member's role.
 * RBAC: Owner or Admin only.
 * Body: { role: "EDITOR" | "VIEWER" | "FREE_BUSY" }
 * Cannot set to OWNER or ADMIN.
 * Response 200: { userId, role }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const actorId = await authenticateRequest(request);
  if (!actorId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const { id: workspaceId, userId: targetUserId } = await params;

  // Actor must be Owner or Admin
  const actorRole = await getMemberRole(actorId, workspaceId);
  if (!actorRole) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }
  if (!hasMinRole(actorRole, "ADMIN")) {
    return errorResponse("FORBIDDEN", "Owner or Admin role required to update members", 403);
  }

  // Target must be a member
  const targetRole = await getMemberRole(targetUserId, workspaceId);
  if (!targetRole) {
    return errorResponse("NOT_FOUND", "Member not found in workspace", 404);
  }

  // An Admin cannot modify another Admin or the Owner
  if (actorRole === "ADMIN" && (targetRole === "OWNER" || targetRole === "ADMIN")) {
    return errorResponse("FORBIDDEN", "Admins cannot modify other Admins or the Owner", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }

  const newRole: unknown = body.role;

  if (!ASSIGNABLE_ROLES.includes(newRole as WorkspaceRole)) {
    return errorResponse(
      "VALIDATION_ERROR",
      `role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`,
      400,
    );
  }

  await db
    .update(workspaceMembers)
    .set({ role: newRole as WorkspaceRole })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );

  return Response.json({ userId: targetUserId, role: newRole });
}

/**
 * DELETE /api/workspaces/:id/members/:userId
 *
 * Remove a member from the workspace.
 * RBAC: Owner or Admin only.
 * Cannot remove the workspace Owner.
 * Response 200: { status: "removed" }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const actorId = await authenticateRequest(request);
  if (!actorId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const { id: workspaceId, userId: targetUserId } = await params;

  // Actor must be Owner or Admin
  const actorRole = await getMemberRole(actorId, workspaceId);
  if (!actorRole) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }
  if (!hasMinRole(actorRole, "ADMIN")) {
    return errorResponse("FORBIDDEN", "Owner or Admin role required to remove members", 403);
  }

  // Verify the workspace exists and get its owner
  const [workspace] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }

  // Cannot remove the Owner
  if (workspace.ownerId === targetUserId) {
    return errorResponse("VALIDATION_ERROR", "Cannot remove the workspace Owner. Transfer ownership first.", 400);
  }

  // An Admin cannot remove another Admin
  const targetRole = await getMemberRole(targetUserId, workspaceId);
  if (actorRole === "ADMIN" && targetRole === "ADMIN") {
    return errorResponse("FORBIDDEN", "Admins cannot remove other Admins", 403);
  }

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );

  return Response.json({ status: "removed" });
}
