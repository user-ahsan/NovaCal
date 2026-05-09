import { pgTable, text, timestamp, uuid, varchar, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { workspaces } from "./workspace";

// ─── API Keys (for MCP + REST API access) ───
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Cursor MCP Integration"
  keyHash: text("key_hash").notNull().unique(), // sha256 hash (deterministic for UNIQUE lookup)
  revokedAt: timestamp("revoked_at"),            // If set, key is invalidated
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Webhooks (for n8n/Zapier/external integrations) ───
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  endpointUrl: text("endpoint_url").notNull(),
  secret: text("secret").notNull(), // HMAC signing secret — encrypted at rest via Vault/Env in production
  events: text("events").array().notNull(), // e.g., ['event.created', 'event.deleted']
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
