// ─── Mobile Services — Barrel Export ───
// All service modules exposed for the mobile app.
// Import via: import { apiClient, syncEngine, fcmService } from "../services";
// ─── Complexity: 🟢 Low ───

export { apiClient, ApiClientError, STORAGE_KEYS } from "./api";
export type {
  // Auth
  AuthRegisterResponse,
  AuthLoginResponse,
  AuthQrInitResponse,
  AuthQrApproveResponse,
  AuthLogoutResponse,
  SessionInfo,
  RevokeAllResponse,
  RevokeResponse,
  // Workspace
  WorkspaceSummary,
  WorkspaceDetail,
  WorkspaceMember,
  MemberUpdateResponse,
  RemoveMemberResponse,
  CreateInviteResponse,
  // Events
  EventQueryParams,
  CreateEventPayload,
  CreateEventResponse,
  UpdateEventPayload,
  UpdateEventResponse,
  DeleteEventResponse,
  EventDetail,
  // Search
  SearchResult,
  SearchResponse,
  // Share
  CreateSharePayload,
  CreateShareResponse,
  ShareLinkInfo,
  VerifyPasswordResponse,
  // System
  HealthResponse,
  MetricsResponse,
  // Error
  ErrorCode,
} from "./api";

export { syncEngine } from "./offline-sync";
export type {
  SyncStatus,
  PendingMutation,
  LocalEvent,
  LocalWorkspace,
  SyncStatusInfo,
} from "./offline-sync";

export { fcmService } from "./fcm";
export type {
  NotificationType,
  NovaCalNotificationPayload,
  NotificationPreferences,
} from "./fcm";
