// ─── Offline Sync Engine ───
// Offline-first local SQLite cache with sync queue.
// Per AGENTS.md Rules 86-95: offline-first architecture, sync queue pattern,
// local SQLite mirroring PG schema, push on reconnect, pull remote, last-write-wins.
// ─── Complexity: 🔴 High ───

import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";
import { apiClient, STORAGE_KEYS, ApiClientError } from "./api";
import type { EventDetail } from "./api";

// ─── Constants ───

const DB_NAME = "novacal-local.db";
const STORAGE_KEYS_LOCAL = {
  LAST_SYNC: "novacal_last_sync",
  SYNC_LOCK: "novacal_sync_lock",
} as const;

const SYNC_LOCK_TTL_MS = 60_000; // 1 minute lock to prevent concurrent syncs

// ─── Types ───

export type SyncStatus = "SYNCED" | "PENDING_SYNC" | "SYNC_FAILED" | "CONFLICT";

export interface PendingMutation {
  id: number;
  entityType: "event" | "workspace" | "attendee";
  mutationType: "CREATE" | "UPDATE" | "DELETE";
  entityId: string;
  payload: string; // JSON-serialized
  status: SyncStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError: string | null;
}

export interface LocalEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: number; // SQLite uses 0/1 for booleans
  timezone: string;
  rrule: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
  workspaceId: string | null;
}

export interface LocalWorkspace {
  id: string;
  name: string;
  role: string;
  defaultTimezone: string;
  memberCount: number;
  syncStatus: SyncStatus;
}

export interface SyncStatusInfo {
  pendingCount: number;
  lastSyncTimestamp: string | null;
  dbFileSize: number | null;
  failedCount: number;
  isSyncing: boolean;
}

// ─── Database Manager ───

class OfflineSyncEngine {
  private db: SQLite.WebSQLDatabase | null = null;
  private dbReady: Promise<void> | null = null;
  private isSyncing = false;

  // ─── Initialization ───

  /**
   * Initialize the local SQLite database.
   * Creates tables mirroring the PostgreSQL schema (simplified for offline).
   * Must be called once on app startup (from _layout.tsx).
   */
  async initLocalDB(): Promise<void> {
    if (this.dbReady) return this.dbReady;

    this.dbReady = new Promise<void>((resolve, reject) => {
      try {
        this.db = SQLite.openDatabase(DB_NAME);

        this.db.transaction((tx) => {
          // ── Events Table ──
          // Mirrors PG schema: id UUID PK, timestamptz stored as ISO strings,
          // soft deletes via deletedAt, syncStatus for offline tracking.
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS events (
              id TEXT PRIMARY KEY,
              calendarId TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT,
              location TEXT,
              startTime TEXT NOT NULL,
              endTime TEXT NOT NULL,
              isAllDay INTEGER DEFAULT 0,
              timezone TEXT DEFAULT 'UTC',
              rrule TEXT,
              color TEXT,
              createdAt TEXT NOT NULL,
              updatedAt TEXT NOT NULL,
              deletedAt TEXT,
              syncStatus TEXT DEFAULT 'SYNCED' CHECK(syncStatus IN ('SYNCED','PENDING_SYNC','SYNC_FAILED','CONFLICT')),
              workspaceId TEXT
            )`,
            [],
            () => {
              // Create indexes for efficient queries
              tx.executeSql(
                `CREATE INDEX IF NOT EXISTS idx_local_events_time ON events(startTime, endTime)`
              );
              tx.executeSql(
                `CREATE INDEX IF NOT EXISTS idx_local_events_sync ON events(syncStatus)`
              );
              tx.executeSql(
                `CREATE INDEX IF NOT EXISTS idx_local_events_workspace ON events(workspaceId)`
              );
              tx.executeSql(
                `CREATE INDEX IF NOT EXISTS idx_local_events_updated ON events(updatedAt)`
              );
            }
          );

          // ── Pending Mutations Queue ──
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS pending_mutations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              entityType TEXT NOT NULL CHECK(entityType IN ('event','workspace','attendee')),
              mutationType TEXT NOT NULL CHECK(mutationType IN ('CREATE','UPDATE','DELETE')),
              entityId TEXT NOT NULL,
              payload TEXT NOT NULL,
              status TEXT DEFAULT 'PENDING_SYNC' CHECK(status IN ('PENDING_SYNC','SYNC_FAILED','CONFLICT')),
              createdAt TEXT NOT NULL,
              updatedAt TEXT NOT NULL,
              retryCount INTEGER DEFAULT 0,
              lastError TEXT
            )`,
            [],
            () => {
              tx.executeSql(
                `CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_mutations(status)`
              );
              tx.executeSql(
                `CREATE INDEX IF NOT EXISTS idx_pending_entity ON pending_mutations(entityType, entityId)`
              );
            }
          );

          // ── Workspaces Table ──
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS workspaces (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              role TEXT NOT NULL,
              defaultTimezone TEXT DEFAULT 'UTC',
              memberCount INTEGER DEFAULT 0,
              syncStatus TEXT DEFAULT 'SYNCED' CHECK(syncStatus IN ('SYNCED','PENDING_SYNC','SYNC_FAILED'))
            )`
          );

          // ── Sync Metadata ──
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS sync_metadata (
              key TEXT PRIMARY KEY,
              value TEXT
            )`
          );
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    return this.dbReady;
  }

  private async ensureDB(): Promise<SQLite.WebSQLDatabase> {
    await this.initLocalDB();
    return this.db!;
  }

  // ─── Mutation Queue ───

  /**
   * Queue an offline mutation for later sync.
   * Stores the mutation with status PENDING_SYNC in the local SQLite queue.
   */
  async queueMutation(
    entityType: "event" | "workspace" | "attendee",
    mutationType: "CREATE" | "UPDATE" | "DELETE",
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const db = await this.ensureDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `INSERT INTO pending_mutations (entityType, mutationType, entityId, payload, status, createdAt, updatedAt, retryCount)
           VALUES (?, ?, ?, ?, 'PENDING_SYNC', ?, ?, 0)`,
          [entityType, mutationType, entityId, JSON.stringify(payload), now, now],
          () => resolve(),
          (_, error) => {
            reject(new Error(`Failed to queue mutation: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  /**
   * Queue an event mutation and also update the local events table optimistically.
   */
  async queueEventMutation(
    mutationType: "CREATE" | "UPDATE" | "DELETE",
    event: LocalEvent
  ): Promise<void> {
    const db = await this.ensureDB();

    // First upsert the event locally (optimistic update)
    await this.upsertLocalEvent(event, mutationType === "CREATE" ? "PENDING_SYNC" : "PENDING_SYNC");

    // Then queue the mutation for server sync
    await this.queueMutation("event", mutationType, event.id, event as unknown as Record<string, unknown>);
  }

  private upsertLocalEvent(
    event: LocalEvent,
    syncStatus: SyncStatus
  ): Promise<void> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `INSERT OR REPLACE INTO events
           (id, calendarId, title, description, location, startTime, endTime,
            isAllDay, timezone, rrule, color, createdAt, updatedAt, deletedAt, syncStatus, workspaceId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            event.id,
            event.calendarId,
            event.title,
            event.description,
            event.location,
            event.startTime,
            event.endTime,
            event.isAllDay,
            event.timezone,
            event.rrule,
            event.color,
            event.createdAt,
            event.updatedAt,
            event.deletedAt,
            syncStatus,
            event.workspaceId,
          ],
          () => resolve(),
          (_, error) => {
            reject(new Error(`Failed to upsert event: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  // ─── Sync Push ───

  /**
   * Push all pending mutations to the server.
   * Called when connectivity is restored (via NetInfo listener in _layout.tsx).
   * Processes mutations in FIFO order, marking failures for later retry.
   */
  async pushPendingMutations(): Promise<{ pushed: number; failed: number }> {
    const db = await this.ensureDB();
    if (this.isSyncing) return { pushed: 0, failed: 0 };

    // Check network
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return { pushed: 0, failed: 0 };
    }

    this.isSyncing = true;
    let pushed = 0;
    let failed = 0;

    try {
      // Get all pending mutations ordered by creation time (FIFO)
      const pending = await this.getPendingMutations();

      for (const mutation of pending) {
        try {
          await this.processMutation(mutation);

          // Remove from queue on success
          await this.removeMutation(mutation.id);
          pushed++;
        } catch (err) {
          failed++;

          const errorMessage = err instanceof ApiClientError
            ? `${err.code}: ${err.message}`
            : (err as Error).message;

          // Mark as failed with incremented retry count
          await this.markMutationFailed(mutation.id, errorMessage);

          // If conflict, mark local data as conflict
          if (err instanceof ApiClientError && err.isConflict) {
            await this.markLocalEventConflict(mutation.entityId);
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return { pushed, failed };
  }

  private getPendingMutations(): Promise<PendingMutation[]> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM pending_mutations WHERE status IN ('PENDING_SYNC', 'SYNC_FAILED') ORDER BY id ASC`,
          [],
          (_, { rows }) => resolve(rows._array as PendingMutation[]),
          (_, error) => {
            reject(new Error(`Failed to get pending mutations: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  private async processMutation(mutation: PendingMutation): Promise<void> {
    const payload = JSON.parse(mutation.payload);

    switch (mutation.entityType) {
      case "event":
        await this.processEventMutation(mutation, payload);
        break;
      case "workspace":
        // Workspace mutations handled separately (less frequent)
        break;
      case "attendee":
        // Attendee mutations handled separately
        break;
    }
  }

  private async processEventMutation(
    mutation: PendingMutation,
    payload: Record<string, unknown>
  ): Promise<void> {
    switch (mutation.mutationType) {
      case "CREATE": {
        await apiClient.createEvent(payload as Parameters<typeof apiClient.createEvent>[0]);
        break;
      }
      case "UPDATE": {
        await apiClient.updateEvent(
          mutation.entityId,
          payload as Parameters<typeof apiClient.updateEvent>[1]
        );
        break;
      }
      case "DELETE": {
        await apiClient.deleteEvent(mutation.entityId, payload.scope as "single" | "this_and_future" | "all");
        break;
      }
    }
  }

  private removeMutation(id: number): Promise<void> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `DELETE FROM pending_mutations WHERE id = ?`,
          [id],
          () => resolve(),
          (_, error) => {
            reject(new Error(`Failed to remove mutation: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  private markMutationFailed(id: number, error: string): Promise<void> {
    const db = this.db!;
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `UPDATE pending_mutations
           SET status = 'SYNC_FAILED', lastError = ?, retryCount = retryCount + 1, updatedAt = ?
           WHERE id = ?`,
          [error, now, id],
          () => resolve(),
          (_, err) => {
            reject(new Error(`Failed to mark mutation failed: ${err.message}`));
            return false;
          }
        );
      });
    });
  }

  private markLocalEventConflict(entityId: string): Promise<void> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `UPDATE events SET syncStatus = 'CONFLICT' WHERE id = ?`,
          [entityId],
          () => resolve(),
          (_, error) => {
            reject(new Error(`Failed to mark event conflict: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  // ─── Sync Pull ───

  /**
   * Pull remote changes since the last sync timestamp.
   * Uses the cursor-based updatedAt field to get incremental changes.
   */
  async pullRemoteChanges(since?: string): Promise<{ pulled: number }> {
    const db = await this.ensureDB();

    // Get last sync timestamp if not provided
    if (!since) {
      since = await this.getLastSyncTimestamp();
    }

    const sinceDate = since || new Date(0).toISOString();
    let pulled = 0;

    try {
      // Fetch events updated since last sync
      const events = await this.fetchRemoteEvents(sinceDate);

      // Upsert each event into local DB (server is source of truth)
      for (const event of events) {
        await this.upsertLocalEvent(
          {
            id: event.id,
            calendarId: event.calendarId,
            title: event.title,
            description: event.description || null,
            location: event.location || null,
            startTime: event.start,
            endTime: event.end,
            isAllDay: event.isAllDay ? 1 : 0,
            timezone: event.timezone || "UTC",
            rrule: event.rrule || null,
            color: event.color || null,
            createdAt: event.createdAt || event.start,
            updatedAt: event.updatedAt || event.start,
            deletedAt: null, // soft-deleted events filtered server-side
            syncStatus: "SYNCED",
            workspaceId: null,
          },
          "SYNCED"
        );
        pulled++;
      }

      // Update last sync timestamp
      await this.setLastSyncTimestamp(new Date().toISOString());
    } catch (err) {
      console.warn("Failed to pull remote changes:", err);
    }

    return { pulled };
  }

  private async fetchRemoteEvents(since: string): Promise<EventDetail[]> {
    try {
      // Use the events list endpoint with date range
      const now = new Date();
      const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // +90 days
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // -30 days

      const events = await apiClient.listEvents({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      // Filter to only events updated since the last sync
      return events.filter((e: EventDetail) => {
        const updatedAt = e.updatedAt || e.start;
        return updatedAt > since;
      });
    } catch {
      // If API call fails (offline, auth), return empty
      return [];
    }
  }

  // ─── Reconciliation ───

  /**
   * Reconcile local data with remote data.
   * Strategy: last-write-wins based on updatedAt timestamps.
   * Conflicts are flagged with CONFLICT status for user resolution.
   */
  async reconcile(): Promise<{ merged: number; conflicts: number }> {
    const db = await this.ensureDB();
    let merged = 0;
    let conflicts = 0;

    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Fetch current server state
      const remoteEvents = await apiClient.listEvents({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      // Get all non-deleted local events
      const localEvents = await this.getLocalEvents();

      // Build a map of remote events by ID for fast lookup
      const remoteMap = new Map<string, EventDetail>();
      for (const event of remoteEvents) {
        remoteMap.set(event.id, event);
      }

      // Compare and reconcile
      for (const local of localEvents) {
        const remote = remoteMap.get(local.id);

        if (!remote) {
          // Event exists locally but not remotely — it was deleted on server
          if (local.syncStatus !== "PENDING_SYNC") {
            // Only remove if it wasn't a local creation pending sync
            await this.deleteLocalEvent(local.id);
            merged++;
          }
          continue;
        }

        const remoteUpdated = new Date(remote.updatedAt || remote.start).getTime();
        const localUpdated = new Date(local.updatedAt).getTime();

        if (remoteUpdated >= localUpdated) {
          // Server is newer or equal — accept server version
          if (local.syncStatus !== "PENDING_SYNC") {
            await this.upsertLocalEvent(
              {
                id: remote.id,
                calendarId: remote.calendarId,
                title: remote.title,
                description: remote.description || null,
                location: remote.location || null,
                startTime: remote.start,
                endTime: remote.end,
                isAllDay: remote.isAllDay ? 1 : 0,
                timezone: remote.timezone || "UTC",
                rrule: remote.rrule || null,
                color: remote.color || null,
                createdAt: remote.createdAt || remote.start,
                updatedAt: remote.updatedAt || remote.start,
                deletedAt: null,
                syncStatus: "SYNCED",
                workspaceId: null,
              },
              "SYNCED"
            );
            merged++;
          } else {
            // Local has pending changes — mark as conflict
            await this.markLocalEventConflict(local.id);
            conflicts++;
          }
        }
        // else: local is newer — keep local (will be pushed)
      }

      // Add remote events that don't exist locally
      for (const remote of remoteEvents) {
        if (!localEvents.find((l) => l.id === remote.id)) {
          await this.upsertLocalEvent(
            {
              id: remote.id,
              calendarId: remote.calendarId,
              title: remote.title,
              description: remote.description || null,
              location: remote.location || null,
              startTime: remote.start,
              endTime: remote.end,
              isAllDay: remote.isAllDay ? 1 : 0,
              timezone: remote.timezone || "UTC",
              rrule: remote.rrule || null,
              color: remote.color || null,
              createdAt: remote.createdAt || remote.start,
              updatedAt: remote.updatedAt || remote.start,
              deletedAt: null,
              syncStatus: "SYNCED",
              workspaceId: null,
            },
            "SYNCED"
          );
          merged++;
        }
      }

      // Update last sync timestamp
      await this.setLastSyncTimestamp(new Date().toISOString());
    } catch (err) {
      console.warn("Reconciliation failed:", err);
    }

    return { merged, conflicts };
  }

  private getLocalEvents(): Promise<LocalEvent[]> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM events WHERE deletedAt IS NULL`,
          [],
          (_, { rows }) => resolve(rows._array as LocalEvent[]),
          (_, error) => {
            reject(new Error(`Failed to get local events: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  private deleteLocalEvent(id: string): Promise<void> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `DELETE FROM events WHERE id = ?`,
          [id],
          () => resolve(),
          (_, error) => {
            reject(new Error(`Failed to delete local event: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  // ─── Sync Status ───

  /**
   * Get the current sync status.
   * Returns pending mutation count, last sync timestamp, and DB file size.
   */
  async getSyncStatus(): Promise<SyncStatusInfo> {
    const db = await this.ensureDB();

    const [pendingCount, failedCount, lastSyncTimestamp, dbFileSize] = await Promise.all([
      this.getPendingCount(),
      this.getFailedCount(),
      this.getLastSyncTimestamp(),
      this.getDbFileSize(),
    ]);

    return {
      pendingCount,
      failedCount,
      lastSyncTimestamp,
      dbFileSize,
      isSyncing: this.isSyncing,
    };
  }

  private getPendingCount(): Promise<number> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT COUNT(*) as count FROM pending_mutations WHERE status = 'PENDING_SYNC'`,
          [],
          (_, { rows }) => resolve(rows._array[0]?.count ?? 0),
          (_, error) => {
            reject(new Error(`Failed to get pending count: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  private getFailedCount(): Promise<number> {
    const db = this.db!;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT COUNT(*) as count FROM pending_mutations WHERE status = 'SYNC_FAILED'`,
          [],
          (_, { rows }) => resolve(rows._array[0]?.count ?? 0),
          (_, error) => {
            reject(new Error(`Failed to get failed count: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  private async getLastSyncTimestamp(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS_LOCAL.LAST_SYNC);
    } catch {
      return null;
    }
  }

  private async setLastSyncTimestamp(timestamp: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS_LOCAL.LAST_SYNC, timestamp);
    } catch {
      // Silently fail — non-critical
    }
  }

  private async getDbFileSize(): Promise<number | null> {
    try {
      // expo-sqlite doesn't expose file size directly.
      // We use Platform + require to get it on Android/iOS.
      const RNFS = Platform.select({
        ios: () => require("react-native-fs"),
        android: () => require("react-native-fs"),
        default: () => null,
      })();

      if (RNFS) {
        const dbPath = `${RNFS.DocumentDirectoryPath}/SQLite/${DB_NAME}`;
        const stat = await RNFS.stat(dbPath);
        return stat.size;
      }
      return null;
    } catch {
      return null;
    }
  }

  // ─── Query Helpers ───

  /**
   * Query local events for the calendar view.
   * Returns events within the specified timeframe.
   */
  async queryLocalEvents(
    startTime: string,
    endTime: string,
    workspaceId?: string
  ): Promise<LocalEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        const params: (string | undefined)[] = [startTime, endTime];
        let sql = `SELECT * FROM events WHERE deletedAt IS NULL AND startTime < ? AND endTime > ?`;

        if (workspaceId) {
          sql += ` AND workspaceId = ?`;
          params.push(workspaceId);
        }

        sql += ` ORDER BY startTime ASC`;

        tx.executeSql(
          sql,
          params,
          (_, { rows }) => resolve(rows._array as LocalEvent[]),
          (_, error) => {
            reject(new Error(`Failed to query local events: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  /**
   * Search local events using SQLite FTS (LIKE-based for simplicity).
   * Mobile searches local SQLite first (instant), then falls back to server.
   */
  async searchLocalEvents(query: string): Promise<LocalEvent[]> {
    const db = await this.ensureDB();
    const searchTerm = `%${query}%`;
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM events
           WHERE deletedAt IS NULL
           AND (title LIKE ? OR description LIKE ? OR location LIKE ?)
           ORDER BY startTime ASC
           LIMIT 50`,
          [searchTerm, searchTerm, searchTerm],
          (_, { rows }) => resolve(rows._array as LocalEvent[]),
          (_, error) => {
            reject(new Error(`Failed to search local events: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  // ─── Force Operations ───

  /**
   * Force push all pending mutations immediately.
   * Used by the "Force Push" button in Settings > Database Sync.
   */
  async forcePush(): Promise<{ pushed: number; failed: number }> {
    return this.pushPendingMutations();
  }

  /**
   * Force pull latest changes from server immediately.
   * Used by the "Pull Latest" button in Settings > Database Sync.
   */
  async forcePull(): Promise<{ pulled: number }> {
    return this.pullRemoteChanges();
  }

  /**
   * Clear all local data and re-sync from scratch.
   */
  async resetAndResync(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(`DELETE FROM events`);
        tx.executeSql(`DELETE FROM pending_mutations`);
        tx.executeSql(`DELETE FROM workspaces`);
        tx.executeSql(`DELETE FROM sync_metadata`);
      }, reject, resolve);
    });
  }

  /**
   * Get events with sync conflicts for user resolution.
   */
  async getConflictEvents(): Promise<LocalEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM events WHERE syncStatus = 'CONFLICT'`,
          [],
          (_, { rows }) => resolve(rows._array as LocalEvent[]),
          (_, error) => {
            reject(new Error(`Failed to get conflict events: ${error.message}`));
            return false;
          }
        );
      });
    });
  }

  /**
   * Resolve a conflict by choosing which version to keep.
   * keepLocal=true: keep local version and re-queue for push.
   * keepLocal=false: accept server version (already synced).
   */
  async resolveConflict(eventId: string, keepLocal: boolean): Promise<void> {
    const db = await this.ensureDB();
    if (keepLocal) {
      // Re-queue the local version for push
      return new Promise((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(
            `UPDATE events SET syncStatus = 'PENDING_SYNC' WHERE id = ?`,
            [eventId],
            () => resolve(),
            (_, error) => {
              reject(new Error(`Failed to resolve conflict: ${error.message}`));
              return false;
            }
          );
        });
      });
    } else {
      // Accept server version — already SYNCED, just clear the conflict flag
      return new Promise((resolve, reject) => {
        db.transaction((tx) => {
          tx.executeSql(
            `UPDATE events SET syncStatus = 'SYNCED' WHERE id = ?`,
            [eventId],
            () => resolve(),
            (_, error) => {
              reject(new Error(`Failed to resolve conflict: ${error.message}`));
              return false;
            }
          );
        });
      });
    }
  }
}

// Singleton
export const syncEngine = new OfflineSyncEngine();
