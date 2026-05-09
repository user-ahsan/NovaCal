// ─── PATCH /api/workspaces/:id / DELETE /api/workspaces/:id ───
// Updates workspace settings or deletes the workspace entirely.

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { workspaces } from "@novacal/db/schema";
import { eq } from "drizzle-orm";
import {
  errorResponse,
  authenticateRequest,
  getMemberRole,
  hasMinRole,
} from "../_helpers";

/**
 * PATCH /api/workspaces/:id
 *
 * Update workspace name/timezone.
 * RBAC: Owner or Admin only.
 * Body: { name?: string, timezone?: string }
 * Response 200: { id, name, defaultTimezone }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const { id } = await params;

  // Verify membership and RBAC
  const role = await getMemberRole(userId, id);
  if (!role) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }
  if (!hasMinRole(role, "ADMIN")) {
    return errorResponse("FORBIDDEN", "Owner or Admin role required to update workspace", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }

  const name: unknown = body.name;
  const timezone: unknown = body.timezone;

  // Build partial update object
  const updateValues: Record<string, string> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "name must be a non-empty string", 400);
    }
    updateValues.name = name.trim();
  }
  if (timezone !== undefined) {
    if (typeof timezone !== "string") {
      return errorResponse("VALIDATION_ERROR", "timezone must be a string", 400);
    }
    updateValues.defaultTimezone = timezone;
  }

  if (Object.keys(updateValues).length === 0) {
    return errorResponse("VALIDATION_ERROR", "At least one of name or timezone must be provided", 400);
  }

  const [updated] = await db
    .update(workspaces)
    .set(updateValues)
    .where(eq(workspaces.id, id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      defaultTimezone: workspaces.defaultTimezone,
    });

  if (!updated) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }

  return Response.json(updated);
}

/**
 * DELETE /api/workspaces/:id
 *
 * Delete workspace. Owner only.
 * Response 200: { status: "deleted" }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const { id } = await params;

  // Verify membership and RBAC — only OWNER can delete
  const role = await getMemberRole(userId, id);
  if (!role) {
    return errorResponse("NOT_FOUND", "Workspace not found", 404);
  }
  if (role !== "OWNER") {
    return errorResponse("FORBIDDEN", "Owner role required to delete workspace", 403);
  }

  // Verify the requesting user is the actual owner_id on the workspace
  const [workspace] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);

  if (!workspace || workspace.ownerId !== userId) {
    return errorResponse("FORBIDDEN", "Only the workspace Owner can delete the workspace", 403);
  }

  await db.delete(workspaces).where(eq(workspaces.id, id));

  return Response.json({ status: "deleted" });
}
