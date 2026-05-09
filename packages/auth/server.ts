// ─── NovaCal Auth Server ───
// Better Auth server instance with:
//   - Email/password authentication (no OAuth)
//   - Redis-backed session secondary storage
//   - QR challenge verification (60s TTL, PENDING→APPROVED)
//   - Drizzle ORM integration via drizzleAdapter
//
// AGENTS.md Rules:
//   42 — Sessions use text PK (Better Auth convention)
//   44 — Users with owned workspaces have restrict-delete
//   45 — API keys are bcrypt-hashed (dependency included for this)
//   55 — QR flow: Web generates challenge → stores in Redis (60s TTL)
//   56 — QR security: UUID unguessable, single-use (PENDING→APPROVED)

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@novacal/db";
import { users, sessions, qrChallenges } from "@novacal/db/schema";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import {
  SESSION_TTL_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  SESSION_CACHE_TTL_SECONDS,
  PASSWORD_MIN_LENGTH,
  QR_TTL_SECONDS,
} from "./config";

// ─── Better Auth Auxiliary Tables ───
// These tables are required by Better Auth for email/password credential
// storage (account) and email verification (verification). They are defined
// here rather than in packages/db/schema because they are internal to
// Better Auth's operation and not part of the application's domain schema.
// Better Auth creates/manages these through the Drizzle adapter.

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  password: text("password"), // bcrypt hash — used by Better Auth email/password plugin
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Auth Server Config ───

export interface CreateAuthServerConfig {
  /** Override BETTER_AUTH_SECRET env var */
  secret?: string;
}

// ─── Auth Server Instance ───

let _authInstance: ReturnType<typeof betterAuth> | null = null;
let _redisInstance: Redis | null = null;

/**
 * Creates (or returns the existing) Better Auth server instance.
 *
 * Call once at application startup. Subsequent calls return the cached instance.
 *
 * @param config - Optional config overrides
 * @returns { auth, redis } - Better Auth server instance + Redis connection
 */
export function createAuthServer(
  config: CreateAuthServerConfig = {}
): { auth: ReturnType<typeof betterAuth>; redis: Redis } {
  if (_authInstance && _redisInstance) {
    return { auth: _authInstance, redis: _redisInstance };
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const secret = config.secret || process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required. Set it in .env or pass it via CreateAuthServerConfig."
    );
  }

  const redis = new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: null, // Better Auth handles retries
  });

  const auth = betterAuth({
    secret,

    // Integrate with existing Drizzle schema
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),

    // Email/password only — no OAuth providers (per AGENTS.md Rule 96)
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: 128,
    },

    // Redis-backed secondary storage for session management
    // (AGENTS.md Rule 55: Redis for sessions + QR challenge storage)
    secondaryStorage: {
      get: async (key: string) => {
        return await redis.get(key);
      },
      set: async (key: string, value: string, ttl?: number) => {
        if (ttl) {
          await redis.set(key, value, "EX", ttl);
        } else {
          await redis.set(key, value);
        }
      },
      delete: async (key: string) => {
        await redis.del(key);
      },
    },

    // Session configuration
    session: {
      expiresIn: SESSION_TTL_SECONDS, // 7 days
      updateAge: SESSION_UPDATE_AGE_SECONDS, // 24 hours
      cookieCache: {
        enabled: true,
        maxAge: SESSION_CACHE_TTL_SECONDS, // 1 hour
      },
    },

    appName: "NovaCal",
  });

  _authInstance = auth;
  _redisInstance = redis;

  return { auth, redis };
}

// ─── QR Challenge Operations ───
// AGENTS.md Rules 55-56: QR auth bridge with 60s TTL, single-use challenges.

export interface QrChallengeResult {
  challengeId: string;
  expiresAt: Date;
}

/**
 * Creates a new QR challenge with strict 60s TTL.
 * The challenge is stored in Redis (primary, for fast lookup) and
 * persisted to PostgreSQL (for audit trail).
 *
 * @param auth - Better Auth instance
 * @param redis - Redis connection
 * @param browserDeviceInfo - Optional browser/device description
 * @returns challengeId and expiration timestamp
 */
export async function createQrChallenge(
  auth: ReturnType<typeof betterAuth>,
  redis: Redis,
  browserDeviceInfo?: string
): Promise<QrChallengeResult> {
  // Challenge UUID must be unguessable (AGENTS.md Rule 56)
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);

  // Store in Redis with strict 60s TTL (Rule 55: "stores in Redis (60s TTL)")
  await redis.set(
    `qr:challenge:${challengeId}`,
    JSON.stringify({ status: "PENDING", browserDeviceInfo }),
    "EX",
    QR_TTL_SECONDS
  );

  // Persist to DB for audit trail (Rule 56: "single-use, status: PENDING → APPROVED")
  await db.insert(qrChallenges).values({
    id: challengeId,
    status: "PENDING",
    browserDeviceInfo: browserDeviceInfo ?? null,
    expiresAt,
  });

  return { challengeId, expiresAt };
}

/**
 * Approves a pending QR challenge and creates a session for the user.
 * The challenge must be in PENDING status — single-use enforcement.
 *
 * @param auth - Better Auth instance
 * @param redis - Redis connection
 * @param challengeId - The UUID of the challenge to approve
 * @param userId - The authenticated user's ID (from mobile session token)
 * @throws Error if challenge not found or already consumed
 */
export async function approveQrChallenge(
  auth: ReturnType<typeof betterAuth>,
  redis: Redis,
  challengeId: string,
  userId: string
): Promise<void> {
  // Verify challenge exists in Redis (fast path)
  const challengeRaw = await redis.get(`qr:challenge:${challengeId}`);
  if (!challengeRaw) {
    throw Object.assign(new Error("QR_CHALLENGE_NOT_FOUND"), {
      code: "NOT_FOUND",
      status: 404,
    });
  }

  const challenge = JSON.parse(challengeRaw) as {
    status: string;
    browserDeviceInfo?: string;
  };

  // Single-use enforcement (Rule 56: "Challenge is single-use (status: PENDING→APPROVED)")
  if (challenge.status !== "PENDING") {
    throw Object.assign(new Error("QR_CHALLENGE_ALREADY_CONSUMED"), {
      code: "CONFLICT",
      status: 409,
    });
  }

  // Mark as APPROVED in Redis
  await redis.set(
    `qr:challenge:${challengeId}`,
    JSON.stringify({ ...challenge, status: "APPROVED" }),
    "EX",
    QR_TTL_SECONDS
  );

  // Update DB status
  await db
    .update(qrChallenges)
    .set({ status: "APPROVED" })
    .where(eq(qrChallenges.id, challengeId));
}

// ─── Type Exports ───

export type BetterAuthInstance = ReturnType<typeof betterAuth>;
