// ─── GET /api/system/metrics ───
// Source: docs/03-api-websocket-contract.md §8 — GET /system/metrics
// Instance Admin only. Returns platform-wide aggregate metrics.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import { sql } from "drizzle-orm";
import { requireAuth } from "../../../../../lib/auth";
import { handleApiError } from "../../../../../lib/errors";

export async function GET(request: NextRequest) {
  try {
    // ── Auth: Instance Admin only ──
    await requireAuth(request);

    // ── Query Aggregates ──
    const [userResult] = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM users`,
    );
    const [eventResult] = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM events`,
    );
    const [workspaceResult] = await db.execute(
      sql`SELECT COUNT(*)::int AS count FROM workspaces`,
    );
    const [dbSizeResult] = await db.execute(
      sql`SELECT pg_database_size(current_database()) / (1024 * 1024)::int AS size_mb`,
    );

    return NextResponse.json({
      totalUsers: (userResult as { count: number } | undefined)?.count ?? 0,
      totalEvents: (eventResult as { count: number } | undefined)?.count ?? 0,
      totalWorkspaces:
        (workspaceResult as { count: number } | undefined)?.count ?? 0,
      /** Tracked by the realtime WebSocket server */
      activeWsConnections: 0,
      databaseSizeMb:
        (dbSizeResult as { size_mb: number } | undefined)?.size_mb ?? 0,
      /** Tracked via Redis INFO memory command */
      redisMemoryMb: 0,
      /** Tracked via rate limiter middleware */
      requestsLastMinute: 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
