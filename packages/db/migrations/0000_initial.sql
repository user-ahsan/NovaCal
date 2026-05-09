-- NovaCal Database Schema v0.0.1
-- PostgreSQL 16 — Initial Migration
-- All timestamps stored in UTC (timestamptz)

-- ─── 1. Core Identity & Authentication ───

CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         varchar(255) NOT NULL UNIQUE,
  name          varchar(255) NOT NULL,
  password_hash text,                    -- Nullable for future Magic Link / passwordless flow
  avatar_url    text,
  default_timezone varchar(50) NOT NULL DEFAULT 'UTC',
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id            text        PRIMARY KEY, -- Better Auth uses text tokens
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_info   text,                     -- e.g., "Chrome on macOS" or "NovaCal Android"
  ip_address    varchar(45),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qr_challenges (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status              varchar(20) NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | EXPIRED
  browser_device_info text,
  linked_session_id   text        REFERENCES sessions(id) ON DELETE SET NULL,
  expires_at          timestamptz NOT NULL -- Strictly 60 seconds from creation
);

-- ─── 2. Multi-Team Collaboration (RBAC) ───

DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM (
    'OWNER',    -- Full control, billing, delete workspace
    'ADMIN',    -- Invite users, modify settings
    'EDITOR',   -- Create, edit, delete events
    'VIEWER',   -- Read-only full access
    'FREE_BUSY' -- See only "Busy" blocks
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS workspaces (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name              varchar(100) NOT NULL,
  slug              varchar(50)  NOT NULL UNIQUE,
  owner_id          uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  default_timezone  varchar(50)  NOT NULL DEFAULT 'UTC',
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id  uuid           NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          workspace_role NOT NULL DEFAULT 'VIEWER',
  joined_at     timestamptz    NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id) -- Composite PK — no duplicate members
);

-- ─── 3. The Scheduling Engine (Calendars & Events) ───

CREATE TABLE IF NOT EXISTS calendars (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         varchar(100) NOT NULL,
  color        varchar(7)   NOT NULL DEFAULT '#6366F1', -- Hex codes
  is_default   boolean      NOT NULL DEFAULT false,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id   uuid         NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  creator_id    uuid         NOT NULL REFERENCES users(id),

  title         varchar(255) NOT NULL,
  description   text,                       -- Markdown only — no binary files
  location      text,

  -- Timestamps MUST be stored in UTC (with timezone)
  start_time    timestamptz  NOT NULL,
  end_time      timestamptz  NOT NULL,
  is_all_day    boolean      NOT NULL DEFAULT false,

  -- Timezone override (e.g., event booked while traveling)
  timezone      varchar(50),

  -- Advanced Recurrence (RFC 5545 / RRule format)
  rrule         text,
  base_event_id uuid,                       -- If this is a modified single-instance of a recurring series

  -- Offline Sync & Audit
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  deleted_at    timestamptz                  -- Soft delete — critical for offline sync
);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id    uuid         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid         REFERENCES users(id) ON DELETE CASCADE,
  email       varchar(255),                  -- For external guests not in the database
  rsvp_status varchar(20)  DEFAULT 'PENDING', -- ACCEPTED | DECLINED | TENTATIVE
  PRIMARY KEY (event_id, user_id)            -- Composite PK — no duplicate attendees
);

-- ─── 4. Developer API, MCP & Webhooks ───

CREATE TABLE IF NOT EXISTS api_keys (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          varchar(100) NOT NULL,  -- e.g., "Cursor MCP Integration"
  key_hash      text         NOT NULL UNIQUE, -- sha256 hash (deterministic for UNIQUE lookup)
  revoked_at    timestamptz,                  -- If set, key is invalidated
  last_used_at  timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  endpoint_url  text        NOT NULL,
  secret        text        NOT NULL,        -- HMAC signing secret
  events        text[]      NOT NULL,        -- e.g., ['event.created', 'event.deleted']
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. Public Sharing & Cryptographic Links ───

CREATE TABLE IF NOT EXISTS public_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hash          varchar(64) NOT NULL UNIQUE, -- 64 hex characters
  entity_type   varchar(20) NOT NULL,        -- 'CALENDAR' | 'EVENT'
  entity_id     uuid        NOT NULL,        -- Polymorphic reference
  password_hash text,                         -- Nullable = no password
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
