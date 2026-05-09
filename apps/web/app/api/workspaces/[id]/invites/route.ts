// ─── POST /api/workspaces/:id/invites ───
// Generates a one-time invitation link for a workspace.

import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@novacal/db/client";
import { publicLinks } from "@novacal/db/schema";
import { errorResponse, authenticateRequest, getMemberRole, hasMinRole } from "../../_helpers";
import { type WorkspaceRole } from "@novacal/shared";

/**
 * POST /api/workspaces/:id/invites
 *
 * Generate a one-time invitation link.
 * RBAC: Owner or Admin only.
 * Body: { role?: "VIEWER" | "EDITOR" | "FREE_BUSY" (default "VIEWER"), expiresInDays?: number (default 7) }
 * Response 201: { inviteUrl, expiresAt }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const { id: workspaceId } = await params;

  // Actor must be Owner or Admin
  const actorRole = await getMemberRole(userId, workspaceId);
  if (!actorRole) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }
  if (!hasMinRole(actorRole, "ADMIN")) {
    return errorResponse("FORBIDDEN", "Owner or Admin role required to generate invites", 403);
  }

  const body = await request.json().catch(() => null);

  // Parse and validate role (default: VIEWER)
  const rawRole: unknown = body?.role;
  const validInviteRoles: WorkspaceRole[] = ["VIEWER", "EDITOR", "FREE_BUSY"];
  const defaultRole: WorkspaceRole = validInviteRoles.includes(rawRole as WorkspaceRole)
    ? (rawRole as WorkspaceRole)
    : "VIEWER";

  // Parse and validate expiresInDays (default: 7, min: 1, max: 365)
  const rawDays: unknown = body?.expiresInDays;
  let expiresInDays = 7;
  if (typeof rawDays === "number" && Number.isInteger(rawDays)) {
    if (rawDays < 1 || rawDays > 365) {
      return errorResponse("VALIDATION_ERROR", "expiresInDays must be between 1 and 365", 400);
    }
    expiresInDays = rawDays;
  } else if (rawDays !== undefined) {
    return errorResponse("VALIDATION_ERROR", "expiresInDays must be an integer if provided", 400);
  }

  // Generate a cryptographically secure 64-character hex hash
  const hash = randomBytes(32).toString("hex");

  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);

  // Persist the invite in public_links (polymorphic: entity_type = "WORKSPACE_INVITE")
  await db.insert(publicLinks).values({
    hash,
    entityType: "WORKSPACE_INVITE",
    entityId: workspaceId,
    passwordHash: JSON.stringify({ defaultRole }),
    expiresAt,
  });

  // Construct the absolute invite URL from the request origin
  const inviteUrl = `${request.nextUrl.origin}/invite/${hash}`;

  return Response.json(
    { inviteUrl, expiresAt: expiresAt.toISOString() },
    { status: 201 },
  );
}
