// ─── MCP Auth — Bearer Token Validation ───
//
// API key authentication for MCP server.
// Tokens are stored as SHA-256 hashes (deterministic for UNIQUE constraint lookup).
// On each successful request, lastUsedAt is updated.
//
// M-001 note: crypto is built-in, no @types/* needed.
// API key format: ncp_key_<64_hex_chars>

import type { Request } from "express";
import { createHash } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import { db } from "@novacal/db";
import { apiKeys, workspaceMembers } from "@novacal/db/schema";

// ─── AuthResult ───
// Returned by authenticateRequest and stored per SSE session.
export interface AuthResult {
  userId: string;
  apiKeyId: string;
  activeWorkspaceId: string;
  role: string;
}

// ─── hashToken ───
// Deterministic SHA-256 hash for UNIQUE key_hash lookup.
// This is NOT bcrypt — the apiKeys.keyHash has a UNIQUE constraint,
// so the hash must be deterministic for direct equality lookups.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── authenticateRequest ───
// Extracts Bearer token from Authorization header, looks up the
// corresponding API key, verifies it exists (not revoked), resolves
// the user's active workspace and role via workspaceMembers.
//
// Returns null when auth fails (caller sends 401).
export async function authenticateRequest(
  req: Request,
): Promise<AuthResult | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7); // Strip "Bearer "

  // Look up API key by hashed token — must exist AND not be revoked
  const keyRecord = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, hashToken(token)),
  });

  if (!keyRecord || keyRecord.revokedAt) {
    return null;
  }

  // Update lastUsedAt
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRecord.id));

  // Resolve active workspace and role
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, keyRecord.userId),
  });

  if (!membership) {
    // User has no workspace membership — they can't use MCP
    return null;
  }

  return {
    userId: keyRecord.userId,
    apiKeyId: keyRecord.id,
    activeWorkspaceId: membership.workspaceId,
    role: membership.role,
  };
}
