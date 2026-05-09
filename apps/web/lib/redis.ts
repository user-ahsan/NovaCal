// ─── Redis Client & Pub/Sub for WebSocket Broadcasting ───
// Source: docs/03-api-websocket-contract.md §6 (WebSocket Contract)
// Pattern: API route → Redis Pub/Sub → Realtime server → WebSocket clients
//
// NOTE: Requires `bun add ioredis` before use. The dynamic import pattern
// ensures graceful degradation if Redis is unavailable.
//
// Exports:
//   default — Redis client instance (used by auth.ts for rate limiting)
//   publishWorkspaceEvent — publish to workspace channel (used by events routes)

// Minimal interface for the Redis operations we need
interface RedisClient {
  connect(): Promise<void>;
  publish(channel: string, message: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<"OK">;
  del(key: string): Promise<number>;
}

let redis: RedisClient | null = null;
let redisReady = false;

async function getRedis(): Promise<RedisClient | null> {
  if (redisReady && redis) return redis;
  if (redis) return redis;

  try {
    const { Redis } = (await import("ioredis")) as {
      Redis: new (url: string, opts: Record<string, unknown>) => RedisClient;
    };
    redis = new Redis(process.env.REDIS_URL ?? "redis://novacal-redis:6379", {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 100, 1000); // Up to 1s backoff
      },
      lazyConnect: true,
    });

    await redis.connect();
    redisReady = true;
    return redis;
  } catch (err) {
    console.warn(
      "[redis] Unable to connect to Redis.",
      err instanceof Error ? err.message : "",
    );
    return null;
  }
}

/**
 * Publishes a workspace-scoped event to Redis Pub/Sub.
 * The realtime server subscribes to `workspace:{id}` channels
 * and forwards events to connected WebSocket clients.
 *
 * Channel format: `workspace:{workspaceId}`
 * Message format: `{ event: string, payload: object }`
 */
export async function publishWorkspaceEvent(
  workspaceId: string,
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  const channel = `workspace:${workspaceId}`;
  const message = JSON.stringify({ event: eventName, payload });

  try {
    await client.publish(channel, message);
  } catch (err) {
    console.error(
      `[redis] Failed to publish to channel "${channel}":`,
      err instanceof Error ? err.message : "",
    );
  }
}

// ─── Default Export: Redis Client Instance ───
// Used by auth.ts for rate limiting (redis.incr, redis.expire, etc.)
// Proxies method calls to the lazily-connected Redis instance.

const redisProxy: RedisClient = {
  async connect() {
    const client = await getRedis();
    if (!client) throw new Error("Redis not available");
    return client.connect();
  },
  async publish(channel: string, message: string): Promise<number> {
    const client = await getRedis();
    if (!client) return 0;
    return client.publish(channel, message);
  },
  async incr(key: string): Promise<number> {
    const client = await getRedis();
    if (!client) throw new Error("Redis not available");
    return client.incr(key);
  },
  async expire(key: string, seconds: number): Promise<number> {
    const client = await getRedis();
    if (!client) throw new Error("Redis not available");
    return client.expire(key, seconds);
  },
  async get(key: string): Promise<string | null> {
    const client = await getRedis();
    if (!client) throw new Error("Redis not available");
    return client.get(key);
  },
  async set(key: string, value: string): Promise<"OK"> {
    const client = await getRedis();
    if (!client) throw new Error("Redis not available");
    return client.set(key, value);
  },
  async del(key: string): Promise<number> {
    const client = await getRedis();
    if (!client) throw new Error("Redis not available");
    return client.del(key);
  },
};

export default redisProxy;
