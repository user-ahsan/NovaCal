// ─── NovaCal Realtime Server ───
// Single-source-of-truth WebSocket server for real-time calendar collaboration.
// Handles WebSocket connections, heartbeat, Redis Pub/Sub for horizontal scaling.
//
// Port: process.env.WS_PORT || 3001
// Redis: process.env.REDIS_URL || "redis://novacal-redis:6379"
//
// Heartbeat: 30s ping interval, 10s pong timeout → connection terminated
//
// Event flow:
//   Client → WebSocket → handleConnection() → rooms/broadcast → Redis Pub/Sub
//   Redis Pub/Sub → rooms/index.ts → broadcast to local clients

import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";
import { setupRoomManager } from "./rooms/index.js";
import { handleConnection } from "./handlers/connection.js";

// ─── Configuration ───
const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://novacal-redis:6379";
const HEARTBEAT_INTERVAL_MS = 30_000; // Server pings every 30s
const MAX_PAYLOAD_BYTES = 1024 * 100; // 100KB max message size

// ─── HTTP Server ───
// Used for health checks and as the WebSocket upgrade server.
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", service: "novacal-realtime" }));
});

// ─── WebSocket Server ───
const wss = new WebSocketServer({
  server,
  maxPayload: MAX_PAYLOAD_BYTES,
});

// ─── Redis Clients ───
// Two clients are needed: one for publishing, one for subscribing.
// Redis Pub/Sub requires a dedicated connection for subscriptions.
const redisPub = new Redis(REDIS_URL, {
  retryStrategy: (times) => Math.min(times * 100, 3000),
});
const redisSub = new Redis(REDIS_URL, {
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redisPub.on("error", (err) => console.error("Redis Pub client error:", err));
redisSub.on("error", (err) => console.error("Redis Sub client error:", err));

// Initialize the room manager with Redis Pub/Sub clients
setupRoomManager(redisPub, redisSub);

// ─── Heartbeat ───
// Ping every 30s. Client must pong within 10s or connection is terminated.
interface HeartbeatWS extends WebSocket {
  isAlive?: boolean;
}

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = ws as HeartbeatWS;
    if (client.isAlive === false) {
      // Client missed more than one heartbeat cycle
      console.warn("Heartbeat timeout — terminating connection");
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

// ─── Connection Handler ───
wss.on("connection", (ws: HeartbeatWS) => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  handleConnection(ws);
});

wss.on("error", (err) => {
  console.error("WebSocket server error:", err);
});

// ─── Graceful Shutdown ───
function shutdown() {
  console.log("\nShutting down NovaCal Realtime server...");
  clearInterval(heartbeatTimer);

  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    ws.close(1001, "Server shutting down");
  });

  // Close Redis connections
  redisPub.quit();
  redisSub.quit();

  // Close HTTP server
  wss.close(() => {
    server.close(() => {
      console.log("Server stopped");
      process.exit(0);
    });
  });

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ─── Start Server ───
server.listen(PORT, () => {
  console.log(`✅ NovaCal Realtime server listening on port ${PORT}`);
});

export { server, wss, redisPub, redisSub };
