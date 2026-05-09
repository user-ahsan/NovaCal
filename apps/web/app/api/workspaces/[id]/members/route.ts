// ─── GET /api/workspaces/:id/members ───
// Lists all members in a workspace with their user details and roles.

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { workspaceMembers, users } from "@novacal/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse, authenticateRequest, getMemberRole } from "../../_helpers";

/**
 * GET /api/workspaces/:id/members
 *
 * List all members of a workspace.
 * Response 200: Array of { userId, name, email, role, joinedAt }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const { id } = await params;

  // Verify the requesting user is a member of this workspace
  const role = await getMemberRole(userId, id);
  if (!role) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, id))
    .orderBy(workspaceMembers.joinedAt);

  return Response.json(members);
}
