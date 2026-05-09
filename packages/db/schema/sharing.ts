import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// ─── Public Sharing & Cryptographic Links ───
// Polymorphic design: entityType + entityId serves both calendar views
// and individual event landing pages from a single table.
export const publicLinks = pgTable("public_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  hash: varchar("hash", { length: 64 }).notNull().unique(), // 64 hex characters
  entityType: varchar("entity_type", { length: 20 }).notNull(), // 'CALENDAR' | 'EVENT'
  entityId: uuid("entity_id").notNull(), // Polymorphic reference
  passwordHash: text("password_hash"), // Nullable = no password
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
