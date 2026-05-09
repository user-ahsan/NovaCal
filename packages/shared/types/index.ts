// ─── Shared TypeScript Interfaces ───
// Source: docs/01-database-schema.md (entity definitions)

import type { WorkspaceRole, CalendarView } from "../constants/system";

// ─── User ───
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  defaultTimezone: string;
}

// ─── Event ───
export interface Event {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  timezone: string;
  rrule: string | null;
  baseEventId: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ─── API Error ───
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── Pagination ───
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
}

// Re-export types from constants for convenience
export type { WorkspaceRole, CalendarView };
