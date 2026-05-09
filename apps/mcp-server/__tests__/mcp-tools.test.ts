// ─── MCP Tools Tests ───
// Source: docs/04-mcp-server-implementation.md §1.2 — Tool Definitions + RBAC
// Acceptance criteria:
//   list_events returns 8 tools in ListToolsRequestSchema
//   create_event creates event with conflict detection
//   delete_event REQUIRES confirmDestructive=true (rejects without)
//   find_common_time finds available slots
//   get_availability: FREE_BUSY role sees "Busy" blocks only
//   search_events: returns FTS results
//   RBAC: VIEWER can't call create_event

import { describe, it, expect, beforeAll, vi } from "vitest";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  query: {
    workspaceMembers: { findFirst: vi.fn() },
  },
};

vi.mock("@novacal/db", () => ({
  db: mockDb,
}));

vi.mock("@novacal/db/schema", () => ({
  events: { id: "events.id", calendarId: "events.calendarId", creatorId: "events.creatorId", title: "events.title", description: "events.description", location: "events.location", startTime: "events.startTime", endTime: "events.endTime", isAllDay: "events.isAllDay", timezone: "events.timezone", rrule: "events.rrule", baseEventId: "events.baseEventId", deletedAt: "events.deletedAt", createdAt: "events.createdAt", updatedAt: "events.updatedAt" },
  calendars: { id: "cal.id", workspaceId: "cal.workspaceId", name: "cal.name", color: "cal.color" },
  eventAttendees: { eventId: "ea.eventId", userId: "ea.userId", email: "ea.email", rsvpStatus: "ea.rsvpStatus" },
  users: { id: "users.id", name: "users.name", email: "users.email" },
  workspaceMembers: { userId: "wm.userId", workspaceId: "wm.workspaceId", role: "wm.role" },
}));

vi.mock("@novacal/shared", () => ({
  ROLE_HIERARCHY: { OWNER: 100, ADMIN: 80, EDITOR: 60, VIEWER: 40, FREE_BUSY: 20 },
  DEFAULT_WORKING_HOURS: { start: 9, end: 17 },
  WORKSPACE_ROLES: ["OWNER", "ADMIN", "EDITOR", "VIEWER", "FREE_BUSY"],
}));

// ─── Auth Mock ───
const mockAuth = { userId: "user-1", apiKeyId: "key-1", activeWorkspaceId: "ws-1", role: "EDITOR" };

// ─── Import tools ───
const { handleListEvents } = await import("../tools/list-events");
const { handleCreateEvent } = await import("../tools/create-event");
const { handleDeleteEvent } = await import("../tools/delete-event");
const { handleFindCommonTime } = await import("../tools/find-common-time");
const { handleGetAvailability } = await import("../tools/get-availability");
const { handleSearchEvents } = await import("../tools/search-events");
const { assertMinimumRole, MINIMUM_ROLE_HIERARCHY } = await import("../rbac");

describe("MCP Tools", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("Tool Registry — list_events", () => {
    it("should define 8 tools in MINIMUM_ROLE_HIERARCHY", () => {
      const toolNames = Object.keys(MINIMUM_ROLE_HIERARCHY);
      expect(toolNames).toHaveLength(8);
      expect(toolNames).toContain("list_events");
      expect(toolNames).toContain("create_event");
      expect(toolNames).toContain("update_event");
      expect(toolNames).toContain("delete_event");
      expect(toolNames).toContain("find_common_time");
      expect(toolNames).toContain("get_availability");
      expect(toolNames).toContain("search_events");
      expect(toolNames).toContain("get_upcoming_events");
    });

    it("should return events for valid date range", async () => {
      const mockEvents = [
        { id: "evt-1", calendarId: "cal-1", creatorId: "user-1", title: "Meeting", description: null, location: null, startTime: new Date("2026-05-10T09:00:00Z"), endTime: new Date("2026-05-10T10:00:00Z"), isAllDay: false, timezone: "UTC", rrule: null, baseEventId: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockEvents),
      });

      const result = await handleListEvents(
        { dateFrom: "2026-05-10T00:00:00Z", dateTo: "2026-05-17T00:00:00Z" },
        mockAuth,
      );
      const text = result.content[0].text;
      const parsed = JSON.parse(text);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].title).toBe("Meeting");
    });
  });

  describe("create_event", () => {
    it("should create event with RBAC check and return conflicts", async () => {
      mockDb.query.workspaceMembers.findFirst.mockResolvedValue({ role: "EDITOR" });

      // Calendar lookup
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cal-1", workspaceId: "ws-1", name: "Default Calendar", color: "#6366F1", isDefault: true, createdAt: new Date() }]),
      });

      // Conflict detection — empty
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      });

      // Insert event
      const mockEvent = { id: "evt-new", calendarId: "cal-1", creatorId: "user-1", title: "Code Review", description: null, location: null, startTime: new Date("2026-05-11T14:00:00Z"), endTime: new Date("2026-05-11T15:00:00Z"), isAllDay: false, timezone: null, rrule: null, baseEventId: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockEvent]),
        }),
      });

      const result = await handleCreateEvent(
        { title: "Code Review", startTime: "2026-05-11T14:00:00Z", endTime: "2026-05-11T15:00:00Z" },
        mockAuth,
      );

      expect(result.content[0].text).toContain("Event created");
      expect(result.content[0].text).toContain("Code Review");
    });

    it("should detect and report conflicts", async () => {
      mockDb.query.workspaceMembers.findFirst.mockResolvedValue({ role: "EDITOR" });

      // Calendar lookup
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cal-1", workspaceId: "ws-1", name: "Default Calendar", color: "#6366F1", isDefault: true, createdAt: new Date() }]),
      });

      // Conflict detection — existing event
      const conflictingEvents = [
        { id: "evt-conflict", calendarId: "cal-1", creatorId: "user-2", title: "Sprint Review", description: null, location: null, startTime: new Date("2026-05-11T13:30:00Z"), endTime: new Date("2026-05-11T15:00:00Z"), isAllDay: false, timezone: "UTC", rrule: null, baseEventId: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(conflictingEvents),
      });

      // Insert event
      const mockEvent = { id: "evt-new", calendarId: "cal-1", creatorId: "user-1", title: "Code Review", description: null, location: null, startTime: new Date("2026-05-11T14:00:00Z"), endTime: new Date("2026-05-11T15:00:00Z"), isAllDay: false, timezone: null, rrule: null, baseEventId: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockEvent]),
        }),
      });

      const result = await handleCreateEvent(
        { title: "Code Review", startTime: "2026-05-11T14:00:00Z", endTime: "2026-05-11T15:00:00Z" },
        mockAuth,
      );

      const texts = result.content.map((c: { text: string }) => c.text).join(" ");
      expect(texts).toContain("Conflict detected");
      expect(texts).toContain("Sprint Review");
    });
  });

  describe("delete_event", () => {
    it("should reject deletion without confirmDestructive flag", async () => {
      const result = await handleDeleteEvent(
        { eventId: "evt-1", confirmDestructive: false },
        mockAuth,
      );

      expect(result.content[0].text).toContain("requires confirmDestructive");
    });

    it("should execute deletion when confirmDestructive is true", async () => {
      // Fetch event
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "evt-1", calendarId: "cal-1", title: "Test Event", startTime: new Date(), endTime: new Date(), rrule: null, baseEventId: null, deletedAt: null }]),
      });

      // Fetch calendar for workspace RBAC
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cal-1", workspaceId: "ws-1" }]),
      });

      mockDb.query.workspaceMembers.findFirst.mockResolvedValue({ role: "EDITOR" });

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await handleDeleteEvent(
        { eventId: "evt-1", confirmDestructive: true, scope: "single" },
        { ...mockAuth, role: "EDITOR" },
      );

      expect(result.content[0].text).toContain("deleted");
    });
  });

  describe("find_common_time", () => {
    it("should find available slots among users", async () => {
      // No events for these users — full availability
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      });

      const result = await handleFindCommonTime(
        { userIds: ["user-1", "user-2"], dateFrom: "2026-05-11T00:00:00Z", dateTo: "2026-05-11T23:59:59Z", durationMinutes: 60 },
        mockAuth,
      );

      expect(result.content[0].text).toContain("Found available slot");
    });

    it("should return 'No common available time slot' when no slots exist", async () => {
      // Create events covering all hours
      const allDayEvents = Array.from({ length: 24 }, (_, i) => ({
        id: `evt-${i}`,
        calendarId: "cal-1",
        creatorId: "user-1",
        title: "Busy",
        description: null,
        location: null,
        startTime: new Date(`2026-05-11T${String(i).padStart(2, "0")}:00:00Z`),
        endTime: new Date(`2026-05-11T${String(i + 1).padStart(2, "0")}:00:00Z`),
        isAllDay: false,
        timezone: null,
        rrule: null,
        baseEventId: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(allDayEvents),
      });

      const result = await handleFindCommonTime(
        { userIds: ["user-1"], dateFrom: "2026-05-11T00:00:00Z", dateTo: "2026-05-11T23:59:59Z", durationMinutes: 60, workingHoursOnly: false },
        mockAuth,
      );

      expect(result.content[0].text).toContain("No common available time slot");
    });
  });

  describe("get_availability", () => {
    it("should return Busy blocks only for FREE_BUSY role", async () => {
      const userEvents = [
        { id: "evt-1", title: "Sprint Review", startTime: new Date("2026-05-11T14:00:00Z"), endTime: new Date("2026-05-11T15:00:00Z"), description: null, location: null },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(userEvents),
      });

      const result = await handleGetAvailability(
        { userId: "user-1", dateFrom: "2026-05-11T00:00:00Z", dateTo: "2026-05-11T23:59:59Z" },
        { ...mockAuth, role: "FREE_BUSY" },
      );

      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty("busyBlocks");
      expect(parsed.busyBlocks[0].status).toBe("Busy");
      // Should NOT include event titles
      expect(text).not.toContain("Sprint Review");
    });

    it("should return full event details for VIEWER+ role", async () => {
      const userEvents = [
        { id: "evt-1", title: "Sprint Review", startTime: new Date("2026-05-11T14:00:00Z"), endTime: new Date("2026-05-11T15:00:00Z"), description: "Review Q2", location: "Room 1" },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(userEvents),
      });

      const result = await handleGetAvailability(
        { userId: "user-1", dateFrom: "2026-05-11T00:00:00Z", dateTo: "2026-05-11T23:59:59Z" },
        { ...mockAuth, role: "VIEWER" },
      );

      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty("events");
      expect(parsed.events[0].title).toBe("Sprint Review");
      expect(text).toContain("Sprint Review");
    });
  });

  describe("search_events", () => {
    it("should return FTS search results", async () => {
      const mockResults = [
        { id: "evt-1", title: "Sprint Review", startTime: new Date("2026-05-11T14:00:00Z"), endTime: new Date("2026-05-11T15:00:00Z") },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResults),
      });

      const result = await handleSearchEvents(
        { query: "sprint" },
        mockAuth,
      );

      const text = result.content[0].text;
      expect(text).toContain("Sprint Review");
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe("RBAC Enforcement", () => {
    it("should have correct minimum role for each tool", () => {
      expect(MINIMUM_ROLE_HIERARCHY.list_events).toBe("VIEWER");
      expect(MINIMUM_ROLE_HIERARCHY.create_event).toBe("EDITOR");
      expect(MINIMUM_ROLE_HIERARCHY.update_event).toBe("EDITOR");
      expect(MINIMUM_ROLE_HIERARCHY.delete_event).toBe("EDITOR");
      expect(MINIMUM_ROLE_HIERARCHY.find_common_time).toBe("VIEWER");
      expect(MINIMUM_ROLE_HIERARCHY.get_availability).toBe("FREE_BUSY");
      expect(MINIMUM_ROLE_HIERARCHY.search_events).toBe("VIEWER");
      expect(MINIMUM_ROLE_HIERARCHY.get_upcoming_events).toBe("VIEWER");
    });

    it("should reject create_event for VIEWER role via assertMinimumRole", async () => {
      mockDb.query.workspaceMembers.findFirst.mockResolvedValue({ role: "VIEWER" });

      await expect(
        assertMinimumRole("viewer-user", "ws-1", "EDITOR"),
      ).rejects.toThrow("Insufficient permissions");
    });

    it("should allow create_event for EDITOR role via assertMinimumRole", async () => {
      mockDb.query.workspaceMembers.findFirst.mockResolvedValue({ role: "EDITOR" });

      await expect(
        assertMinimumRole("editor-user", "ws-1", "EDITOR"),
      ).resolves.not.toThrow();
    });

    it("should reject tool call when user is not a workspace member", async () => {
      mockDb.query.workspaceMembers.findFirst.mockResolvedValue(null);

      await expect(
        assertMinimumRole("non-member", "ws-1", "VIEWER"),
      ).rejects.toThrow("not a member");
    });
  });
});
