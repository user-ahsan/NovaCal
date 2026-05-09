// ─── API Client ───
// Typed HTTP client for NovaCal REST API.
// Base URL loaded from SecureStore (no hardcoded instance URLs per AGENTS.md Rule 89).
// Auth token injected automatically via Authorization header.
// All endpoints from docs/03-api-websocket-contract.md.
// ─── Complexity: 🟡 Medium ───

import * as SecureStore from "expo-secure-store";
import type {
  User,
  Event,
  ApiError,
  PaginatedResponse,
  PublicLink,
  PublicCalendarData,
  PublicEventDetail,
  WorkspaceRole,
} from "@novacal/shared";

// ─── Constants ───

const STORAGE_KEYS = {
  INSTANCE_URL: "novacal_instance_url",
  AUTH_TOKEN: "novacal_auth_token",
  ACTIVE_WORKSPACE: "novacal_active_workspace",
  LAST_SYNC: "novacal_last_sync",
  FCM_TOKEN: "novacal_fcm_token",
} as const;

// ─── Response Types (matching docs/03-api-websocket-contract.md) ───

export interface AuthRegisterResponse {
  user: User;
  sessionToken: string;
}

export interface AuthLoginResponse {
  user: User & { role: WorkspaceRole };
  sessionToken: string;
  activeWorkspaceId: string;
}

export interface AuthQrInitResponse {
  challengeId: string;
  expiresAt: string;
  wsChannel: string;
}

export interface AuthQrApproveResponse {
  status: "APPROVED";
}

export interface AuthLogoutResponse {
  status: "logged_out";
}

export interface SessionInfo {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface RevokeAllResponse {
  status: "all_revoked";
  count: number;
}

export interface RevokeResponse {
  status: "revoked";
}

// ─── Workspace Types ───

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  role: WorkspaceRole;
  defaultTimezone: string;
}

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface MemberUpdateResponse {
  userId: string;
  role: WorkspaceRole;
}

export interface RemoveMemberResponse {
  status: "removed";
}

export interface CreateInviteResponse {
  inviteUrl: string;
  expiresAt: string;
}

// ─── Event Types ───

export interface EventQueryParams {
  start: string;
  end: string;
  calendarIds?: string[];
  userId?: string;
}

export interface CreateEventPayload {
  calendarId: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  timezone?: string;
  attendees?: string[];
  recurrence?: string;
  isAllDay?: boolean;
}

export interface CreateEventResponse {
  id: string;
  title: string;
  start: string;
  end: string;
  conflicts?: Array<{
    eventId: string;
    title: string;
    start: string;
  }>;
}

export interface UpdateEventPayload {
  title?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
  timezone?: string;
  singleInstance?: boolean;
}

export interface UpdateEventResponse {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface DeleteEventResponse {
  status: "deleted";
  scope: "single" | "this_and_future" | "all";
}

export interface EventDetail {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  rrule: string | null;
  color: string | null;
  description: string | null;
  location: string | null;
  timezone: string;
  attendees: Array<{
    id: string;
    name: string;
    response: "PENDING" | "ACCEPTED" | "DECLINED" | "TENTATIVE";
  }>;
  createdBy: { id: string; name: string } | null;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Search Types ───

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  start: string;
  end: string;
}

export interface SearchResponse {
  results: SearchResult[];
  latencyMs: number;
  total: number;
}

// ─── Share Types ───

export interface CreateSharePayload {
  password?: string;
  expiresAt?: string;
}

export interface CreateShareResponse {
  shareUrl: string;
  hash: string;
  expiresAt: string;
  hasPassword: boolean;
}

export interface ShareLinkInfo {
  hash: string;
  createdAt: string;
  expiresAt: string | null;
  hasPassword: boolean;
  viewCount: number;
}

export interface VerifyPasswordResponse {
  valid: boolean;
  tempToken: string;
  expiresIn: number;
}

// ─── System Types ───

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  postgres: "connected" | "disconnected";
  redis: "connected" | "disconnected";
  uptime: number;
  version: string;
}

export interface MetricsResponse {
  totalUsers: number;
  totalEvents: number;
  totalWorkspaces: number;
  activeWsConnections: number;
  databaseSizeMb: number;
  redisMemoryMb: number;
  requestsLastMinute: number;
}

// ─── Error Types ───

export type ErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "FORBIDDEN";

export class ApiClientError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  static fromResponse(error: ApiError, statusCode: number): ApiClientError {
    return new ApiClientError(
      error.code as ErrorCode,
      statusCode,
      error.message,
      error.details
    );
  }

  get isUnauthorized(): boolean {
    return this.code === "UNAUTHORIZED" || this.statusCode === 401;
  }

  get isNotFound(): boolean {
    return this.code === "NOT_FOUND" || this.statusCode === 404;
  }

  get isConflict(): boolean {
    return this.code === "CONFLICT" || this.statusCode === 409;
  }

  get isRateLimited(): boolean {
    return this.code === "RATE_LIMITED" || this.statusCode === 429;
  }

  get isValidationError(): boolean {
    return this.code === "VALIDATION_ERROR" || this.statusCode === 400;
  }
}

// ─── API Client ───

class ApiClient {
  private baseUrlPromise: Promise<string | null>;
  private tokenPromise: Promise<string | null>;
  private workspaceIdPromise: Promise<string | null>;

  constructor() {
    // Lazy-load from SecureStore each time (values can change at runtime)
    this.baseUrlPromise = SecureStore.getItemAsync(STORAGE_KEYS.INSTANCE_URL);
    this.tokenPromise = SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    this.workspaceIdPromise = SecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_WORKSPACE);
  }

  /** Force re-read of storage values on next request. Call after login/logout/workspace switch. */
  refresh(): void {
    this.baseUrlPromise = SecureStore.getItemAsync(STORAGE_KEYS.INSTANCE_URL);
    this.tokenPromise = SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    this.workspaceIdPromise = SecureStore.getItemAsync(STORAGE_KEYS.ACTIVE_WORKSPACE);
  }

  /** Persist the instance URL after initial connect screen. */
  async setInstanceUrl(url: string): Promise<void> {
    const normalized = url.replace(/\/+$/, ""); // strip trailing slash
    await SecureStore.setItemAsync(STORAGE_KEYS.INSTANCE_URL, normalized);
    this.refresh();
  }

  /** Persist the auth token after successful login/QR. */
  async setAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
    this.refresh();
  }

  /** Clear auth token on logout. */
  async clearAuthToken(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    this.refresh();
  }

  /** Set the active workspace context. */
  async setActiveWorkspace(workspaceId: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.ACTIVE_WORKSPACE, workspaceId);
    this.refresh();
  }

  /** Clear all stored auth state. */
  async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.ACTIVE_WORKSPACE),
      SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC),
    ]);
    this.refresh();
  }

  // ─── Internal HTTP Methods ───

  private async getBaseUrl(): Promise<string> {
    const url = await this.baseUrlPromise;
    if (!url) {
      throw new ApiClientError(
        "INTERNAL_ERROR",
        0,
        "Instance URL not configured. Connect to a server first."
      );
    }
    return url;
  }

  private async getHeaders(requireAuth = true, requireWorkspace = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (requireAuth) {
      const token = await this.tokenPromise;
      if (!token) {
        throw new ApiClientError(
          "UNAUTHORIZED",
          401,
          "No auth token available. Log in first."
        );
      }
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (requireWorkspace) {
      const workspaceId = await this.workspaceIdPromise;
      if (!workspaceId) {
        throw new ApiClientError(
          "VALIDATION_ERROR",
          400,
          "No active workspace selected."
        );
      }
      headers["X-Workspace-Id"] = workspaceId;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | string[] | undefined>;
      requireAuth?: boolean;
      requireWorkspace?: boolean;
      idempotencyKey?: string;
    } = {}
  ): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders(
      options.requireAuth !== false,
      options.requireWorkspace === true
    );

    if (options.idempotencyKey) {
      headers["X-Idempotency-Key"] = options.idempotencyKey;
    }

    // Build URL with query params
    let url = `${baseUrl}/api${path}`;
    if (options.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v));
          } else {
            searchParams.set(key, value);
          }
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (options.body !== undefined && method !== "GET") {
      fetchOptions.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      throw new ApiClientError(
        "INTERNAL_ERROR",
        0,
        `Network request failed: ${(err as Error).message}`
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as { error?: ApiError } | undefined;
      if (errorData?.error) {
        throw ApiClientError.fromResponse(errorData.error, response.status);
      }
      throw new ApiClientError(
        "INTERNAL_ERROR",
        response.status,
        `Request failed with status ${response.status}`
      );
    }

    return data as T;
  }

  // ─── Auth Endpoints ───

  async register(email: string, password: string, name: string): Promise<AuthRegisterResponse> {
    return this.request<AuthRegisterResponse>("POST", "/auth/register", {
      body: { email, password, name },
      requireAuth: false,
    });
  }

  async login(email: string, password: string): Promise<AuthLoginResponse> {
    return this.request<AuthLoginResponse>("POST", "/auth/login", {
      body: { email, password },
      requireAuth: false,
    });
  }

  async qrInit(deviceInfo: string): Promise<AuthQrInitResponse> {
    return this.request<AuthQrInitResponse>("POST", "/auth/qr/init", {
      body: { deviceInfo },
      requireAuth: false,
    });
  }

  async qrApprove(challengeId: string): Promise<AuthQrApproveResponse> {
    return this.request<AuthQrApproveResponse>("POST", "/auth/qr/approve", {
      body: { challengeId },
      requireAuth: true,
    });
  }

  async logout(): Promise<AuthLogoutResponse> {
    return this.request<AuthLogoutResponse>("POST", "/auth/logout");
  }

  async getSessions(): Promise<SessionInfo[]> {
    return this.request<SessionInfo[]>("GET", "/auth/sessions");
  }

  async revokeSession(sessionId: string): Promise<RevokeResponse> {
    return this.request<RevokeResponse>("DELETE", `/auth/sessions/${sessionId}`);
  }

  async revokeAllSessions(): Promise<RevokeAllResponse> {
    return this.request<RevokeAllResponse>("DELETE", "/auth/sessions");
  }

  // ─── Events Endpoints ───

  async listEvents(params: EventQueryParams): Promise<EventDetail[]> {
    return this.request<EventDetail[]>("GET", "/events", {
      params: {
        start: params.start,
        end: params.end,
        calendarIds: params.calendarIds,
        userId: params.userId,
      },
      requireWorkspace: true,
    });
  }

  async createEvent(
    payload: CreateEventPayload,
    idempotencyKey?: string
  ): Promise<CreateEventResponse> {
    return this.request<CreateEventResponse>("POST", "/events", {
      body: payload,
      requireWorkspace: true,
      idempotencyKey,
    });
  }

  async getEvent(id: string): Promise<EventDetail> {
    return this.request<EventDetail>("GET", `/events/${id}`);
  }

  async updateEvent(
    id: string,
    payload: UpdateEventPayload
  ): Promise<UpdateEventResponse> {
    return this.request<UpdateEventResponse>("PATCH", `/events/${id}`, {
      body: payload,
      requireWorkspace: true,
    });
  }

  async deleteEvent(
    id: string,
    scope: "single" | "this_and_future" | "all" = "single"
  ): Promise<DeleteEventResponse> {
    return this.request<DeleteEventResponse>("DELETE", `/events/${id}`, {
      params: { scope },
      requireWorkspace: true,
    });
  }

  async searchEvents(
    query: string,
    limit = 20
  ): Promise<SearchResponse> {
    return this.request<SearchResponse>("GET", "/search", {
      params: { q: query, limit: String(limit) },
      requireWorkspace: true,
    });
  }

  // ─── Workspaces Endpoints ───

  async listWorkspaces(): Promise<WorkspaceSummary[]> {
    return this.request<WorkspaceSummary[]>("GET", "/workspaces");
  }

  async createWorkspace(
    name: string,
    timezone?: string
  ): Promise<WorkspaceDetail> {
    return this.request<WorkspaceDetail>("POST", "/workspaces", {
      body: { name, timezone },
    });
  }

  async getWorkspace(id: string): Promise<WorkspaceDetail> {
    return this.request<WorkspaceDetail>("GET", `/workspaces/${id}`);
  }

  async updateWorkspace(
    id: string,
    payload: { name?: string; timezone?: string }
  ): Promise<WorkspaceDetail> {
    return this.request<WorkspaceDetail>("PATCH", `/workspaces/${id}`, {
      body: payload,
    });
  }

  async deleteWorkspace(id: string): Promise<{ status: "deleted" }> {
    return this.request<{ status: "deleted" }>(
      "DELETE",
      `/workspaces/${id}`
    );
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.request<WorkspaceMember[]>(
      "GET",
      `/workspaces/${workspaceId}/members`
    );
  }

  async updateWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<MemberUpdateResponse> {
    return this.request<MemberUpdateResponse>(
      "PATCH",
      `/workspaces/${workspaceId}/members/${userId}`,
      { body: { role } }
    );
  }

  async removeWorkspaceMember(
    workspaceId: string,
    userId: string
  ): Promise<RemoveMemberResponse> {
    return this.request<RemoveMemberResponse>(
      "DELETE",
      `/workspaces/${workspaceId}/members/${userId}`
    );
  }

  async createWorkspaceInvite(
    workspaceId: string,
    role: WorkspaceRole,
    expiresInDays = 7
  ): Promise<CreateInviteResponse> {
    return this.request<CreateInviteResponse>(
      "POST",
      `/workspaces/${workspaceId}/invites`,
      { body: { role, expiresInDays } }
    );
  }

  // ─── Share Endpoints ───

  async createShareLink(
    calendarId: string,
    payload?: CreateSharePayload
  ): Promise<CreateShareResponse> {
    return this.request<CreateShareResponse>(
      "POST",
      `/share/calendar/${calendarId}`,
      { body: payload }
    );
  }

  async revokeShareLink(hash: string): Promise<RevokeResponse> {
    return this.request<RevokeResponse>("DELETE", `/share/${hash}`);
  }

  async listShareLinks(calendarId: string): Promise<ShareLinkInfo[]> {
    return this.request<ShareLinkInfo[]>(
      "GET",
      `/share/calendar/${calendarId}/links`
    );
  }

  async verifySharePassword(
    hash: string,
    password: string
  ): Promise<VerifyPasswordResponse> {
    return this.request<VerifyPasswordResponse>(
      "POST",
      `/share/verify/${hash}`,
      { body: { password }, requireAuth: false }
    );
  }

  async getPublicCalendar(hash: string): Promise<PublicCalendarData> {
    return this.request<PublicCalendarData>("GET", `/p/${hash}`, {
      requireAuth: false,
    });
  }

  async getPublicEvent(hash: string): Promise<PublicEventDetail> {
    return this.request<PublicEventDetail>("GET", `/e/${hash}`, {
      requireAuth: false,
    });
  }

  // ─── System Endpoints ───

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health", {
      requireAuth: false,
    });
  }

  async metrics(): Promise<MetricsResponse> {
    return this.request<MetricsResponse>("GET", "/system/metrics", {
      requireAuth: true,
    });
  }
}

// Singleton — used throughout the mobile app
export const apiClient = new ApiClient();
export { STORAGE_KEYS };
