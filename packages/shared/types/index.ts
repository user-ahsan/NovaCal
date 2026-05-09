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

// ─── Calendar ───
export interface Calendar {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  description: string | null;
  timezone: string;
}

// ─── Event Attendee ───
export type AttendeeStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  email: string;
  status: AttendeeStatus;
  avatarUrl: string | null;
}

// ─── Public Link ───
export type LinkEntityType = "CALENDAR" | "EVENT";

export interface PublicLink {
  id: string;
  entityType: LinkEntityType;
  entityId: string;
  hash: string;
  passwordHash: string | null;
  expiresAt: string | null;
  createdAt: string;
  viewCount: number;
}

// ─── Public Calendar Response ───
export interface PublicCalendarData {
  link: {
    expiresAt: string | null;
    hasPassword: boolean;
    entityId: string;
  };
  calendar: {
    name: string;
    description: string | null;
    color: string;
  };
  events: PublicEvent[];
}

// ─── Public Event Response ───
export interface PublicEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string | null;
  location: string | null;
  color: string | null;
  timezone: string;
  isAllDay: boolean;
  attendees: Array<{
    id: string;
    name: string;
    email: string;
    response: AttendeeStatus;
  }>;
  createdBy: {
    id: string;
    name: string;
  } | null;
}

// ─── Single Event Landing Response ───
export interface PublicEventDetail {
  event: {
    id: string;
    title: string;
    start: string;
    end: string;
    description: string | null;
    location: string | null;
    timezone: string;
    isAllDay: boolean;
    attendees: Array<{
      id: string;
      name: string;
      email: string;
      response: AttendeeStatus;
    }>;
    createdBy: {
      id: string;
      name: string;
    } | null;
  };
  icsDownloadUrl: string;
}

// Re-export types from constants for convenience
export type { WorkspaceRole, CalendarView };
