import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { workspaces } from "./workspace";

// ─── Calendars ───
export const calendars = pgTable("calendars", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366F1").notNull(), // Hex codes
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Events ───
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  calendarId: uuid("calendar_id")
    .notNull()
    .references(() => calendars.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id),

  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"), // Markdown only — no binary files
  location: text("location"),

  // Timestamps MUST be stored in UTC
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  isAllDay: boolean("is_all_day").default(false).notNull(),

  // Timezone override (e.g., event booked while traveling)
  timezone: varchar("timezone", { length: 50 }),

  // Advanced Recurrence (RFC 5545 / RRule format)
  rrule: text("rrule"),
  baseEventId: uuid("base_event_id"), // If this is a modified single-instance of a recurring series

  // Offline Sync & Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete — critical for offline sync
});

// ─── Event Attendees ───
export const eventAttendees = pgTable(
  "event_attendees",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    email: varchar("email", { length: 255 }), // For external guests not in the database
    rsvpStatus: varchar("rsvp_status", { length: 20 }).default("PENDING"), // ACCEPTED | DECLINED | TENTATIVE
  },
  (table) => ({
    pk: primaryKey({ columns: [table.eventId, table.userId] }),
  }),
);
