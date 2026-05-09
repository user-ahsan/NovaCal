import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// ─── Users ───
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash"), // Nullable if using Magic Links later
  avatarUrl: text("avatar_url"),
  defaultTimezone: varchar("default_timezone", { length: 50 })
    .default("UTC")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Device Ledger & Active Sessions ───
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // Better Auth uses text tokens
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceInfo: text("device_info"), // e.g., "Chrome on macOS" or "NovaCal Android"
  ipAddress: varchar("ip_address", { length: 45 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── QR Auth Bridge Ledger ───
export const qrChallenges = pgTable("qr_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: varchar("status", { length: 20 })
    .notNull()
    .default("PENDING"), // PENDING | APPROVED | EXPIRED
  browserDeviceInfo: text("browser_device_info"),
  linkedSessionId: text("linked_session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  expiresAt: timestamp("expires_at").notNull(), // Strictly 60 seconds from creation
});
