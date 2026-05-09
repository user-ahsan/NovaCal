// ─── GET /api/workspaces / POST /api/workspaces ───
// Lists all workspaces the authenticated user belongs to, or creates a new one.

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { workspaces, workspaceMembers } from "@novacal/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { errorResponse, authenticateRequest, generateSlug } from "./_helpers";

/**
 * GET /api/workspaces
 *
 * Lists all workspaces the authenticated user belongs to.
 * Response 200: Array of { id, name, role, memberCount, createdAt }
 */
export async function GET(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const results = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
      memberCount: sql<number>`
        (SELECT COUNT(*)::int FROM ${workspaceMembers} wm_sub
         WHERE wm_sub.workspace_id = ${workspaces.id})
      `,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaces.createdAt));

  return Response.json(results);
}

/**
 * POST /api/workspaces
 *
 * Creates a new workspace. Sets the creator as OWNER.
 * Body: { name: string (required), timezone?: string (default "UTC") }
 * Response 201: { id, name, role: "OWNER", defaultTimezone }
 */
export async function POST(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return errorResponse("UNAUTHORIZED", "Missing or invalid session token", 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }

  const name: unknown = body.name;
  const timezone: unknown = body.timezone;

  if (typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("VALIDATION_ERROR", "name is required and must be a non-empty string", 400);
  }
  if (timezone !== undefined && typeof timezone !== "string") {
    return errorResponse("VALIDATION_ERROR", "timezone must be a string if provided", 400);
  }

  const slug = generateSlug(name);
  const defaultTimezone = timezone?.trim() || "UTC";

  // Insert workspace and membership in a transaction
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: name.trim(),
      slug,
      ownerId: userId,
      defaultTimezone,
    })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: "OWNER",
  });

  return Response.json(
    {
      id: workspace.id,
      name: workspace.name,
      role: "OWNER" as const,
      defaultTimezone: workspace.defaultTimezone,
    },
    { status: 201 },
  );
}
