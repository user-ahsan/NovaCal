import {
  pgTable,
  pgEnum,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ─── Role Enum ───
export const roleEnum = pgEnum("workspace_role", [
  "OWNER",    // Full control, billing, delete workspace
  "ADMIN",    // Invite users, modify settings
  "EDITOR",   // Create, edit, delete events
  "VIEWER",   // Read-only full access
  "FREE_BUSY", // See only "Busy" blocks
]);

// ─── Workspaces ───
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  defaultTimezone: varchar("default_timezone", { length: 50 })
    .default("UTC")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Workspace Memberships ───
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("VIEWER"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.workspaceId, table.userId],
    }), // Composite PK — no duplicate members
  }),
);
