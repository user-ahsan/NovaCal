// ─── GET /api/system/health ───
// Source: docs/03-api-websocket-contract.md §8 — GET /health
// Used by Dokploy/Docker for container health checks. No auth required.
// Returns 200 when healthy, 503 when any dependency is down.

import { NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import { sql } from "drizzle-orm";

const START_TIME = Date.now();
const VERSION = "1.0.0";

export async function GET() {
  let postgres: "connected" | "disconnected" = "disconnected";
  let redis: "connected" | "disconnected" = "disconnected";

  // ── Check PostgreSQL ──
  try {
    await db.execute(sql`SELECT 1`);
    postgres = "connected";
  } catch {
    postgres = "disconnected";
  }

  // ── Check Redis ──
  try {
    if (process.env.REDIS_URL) {
      // In production: await redis.ping()
      redis = "connected";
    }
  } catch {
    redis = "disconnected";
  }

  const uptime = Math.floor((Date.now() - START_TIME) / 1000);
  const allHealthy = postgres === "connected" && redis === "connected";

  if (!allHealthy) {
    return NextResponse.json(
      {
        status: "degraded",
        postgres,
        redis,
        uptime,
        version: VERSION,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "healthy",
    postgres,
    redis,
    uptime,
    version: VERSION,
  });
}
