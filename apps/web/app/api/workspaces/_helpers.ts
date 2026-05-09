// ─── Shared Helpers for Workspace API Routes ───
// Auth verification, RBAC checks, error responses

import { NextRequest } from "next/server";
import { db } from "@novacal/db/client";
import { sessions, workspaceMembers } from "@novacal/db/schema";
import { eq, and } from "drizzle-orm";
import { ROLE_HIERARCHY, type WorkspaceRole } from "@novacal/shared";

/**
 * Standard error response using the NovaCal error contract format.
 */
export function errorResponse(
  code: "UNAUTHORIZED" | "VALIDATION_ERROR" | "CONFLICT" | "INTERNAL_ERROR" | "RATE_LIMITED" | "NOT_FOUND" | "FORBIDDEN",
  message: string,
  status: number,
): Response {
  return Response.json(
    { error: { code, message, details: {} } },
    { status },
  );
}

/**
 * Extracts Bearer token from Authorization header and resolves the session.
 * Returns the authenticated userId, or null if invalid/missing.
 */
export async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, token))
    .limit(1);

  return session?.userId ?? null;
}

/**
 * Looks up the requesting user's role in a specific workspace.
 * Returns null if the user is not a member of the workspace.
 */
export async function getMemberRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);

  return (member?.role as WorkspaceRole) ?? null;
}

/**
 * Compares a user's role against a minimum required role using the
 * numeric hierarchy: OWNER(100) > ADMIN(80) > EDITOR(60) > VIEWER(40) > FREE_BUSY(20).
 */
export function hasMinRole(userRole: WorkspaceRole, minRole: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Generates a URL-safe slug from a workspace name.
 * Appends a random hex suffix to avoid unique constraint collisions.
 */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  if (!base) return `workspace-${crypto.randomUUID().slice(0, 8)}`;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
