// ─── System & Business Logic Constants ───
// Source: docs/02-component-library-global-constants.md §1.C

// ─── Roles ───
export const WORKSPACE_ROLES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "VIEWER",
  "FREE_BUSY",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  EDITOR: 60,
  VIEWER: 40,
  FREE_BUSY: 20,
};

// ─── Time ───
export const DEFAULT_TIMEZONE = "UTC";
export const SLOT_INCREMENT_MINUTES = 15;
export const MIN_EVENT_DURATION_MINUTES = 15;
export const MAX_EVENT_DURATION_HOURS = 24;
export const DEFAULT_WORKING_HOURS = { start: 9, end: 17 } as const;
export const DEFAULT_START_OF_WEEK = 1; // Monday

// ─── Cache / TTL ───
export const QR_TTL_SECONDS = 60;
export const QR_REFRESH_INTERVAL_MS = 60_000; // matches QR_TTL
export const RATE_LIMIT_MAX_REQUESTS = 100; // per minute
export const SESSION_CACHE_TTL_SECONDS = 3600; // 1 hour

// ─── View Types ───
export const CALENDAR_VIEWS = [
  "day",
  "3-day",
  "week",
  "month",
  "year",
] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

// ─── Pagination ───
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const AGENDA_PAGE_SIZE = 100;

// ─── WebSocket ───
export const WS_EVENTS = {
  EVENT_CREATED: "event.created",
  EVENT_UPDATED: "event.updated",
  EVENT_DELETED: "event.deleted",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  USER_ONLINE: "user.online",
  USER_OFFLINE: "user.offline",
} as const;

// ─── Share Links ───
export const SHARE_HASH_BYTES = 32; // crypto.randomBytes(32)
export const SHARE_DEFAULT_EXPIRY_DAYS = 7;
export const SHARE_MAX_EXPIRY_DAYS = 365;
