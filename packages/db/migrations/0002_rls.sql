-- NovaCal Row-Level Security Policies
-- PostgreSQL 16 — Security Migration
-- Run after 0001_indexes.sql
--
-- RLS provides the "hard backstop" referenced in AGENTS.md Rules 34/83.
-- Every table containing user data gets RLS enabled + policies.

-- ─── Helper function: get current user ID from session ───
-- In production, this reads from the application's session context.
-- For self-hosted single-user, this provides defense-in-depth.
-- For multi-user, replace with proper session-based auth.uid().

-- ─── 1. Users ───
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON users
  FOR ALL
  USING (id = current_setting('app.current_user_id', TRUE)::uuid);

-- ─── 2. Sessions ───
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_self ON sessions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE)::uuid);

-- ─── 3. QR Challenges ───
ALTER TABLE qr_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY qr_challenges_self ON qr_challenges
  FOR SELECT
  USING (true); -- QR challenges are read by unauthenticated users during scan

-- ─── 4. Workspaces ───
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_member ON workspaces
  FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
  );

CREATE POLICY workspaces_owner ON workspaces
  FOR UPDATE
  USING (owner_id = current_setting('app.current_user_id', TRUE)::uuid);

-- ─── 5. Workspace Members ───
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_self ON workspace_members
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
  );

-- ─── 6. Calendars ───
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendars_workspace ON calendars
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
  );

-- ─── 7. Events ───
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_calendar ON events
  FOR ALL
  USING (
    calendar_id IN (
      SELECT c.id FROM calendars c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE wm.user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
  );

-- ─── 8. Event Attendees ───
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_attendees_calendar ON event_attendees
  FOR ALL
  USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN calendars c ON c.id = e.calendar_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE wm.user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
  );

-- ─── 9. API Keys ───
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_self ON api_keys
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE)::uuid);

-- ─── 10. Webhooks ───
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhooks_workspace ON webhooks
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
  );

-- ─── 11. Public Links ───
ALTER TABLE public_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_links_read ON public_links
  FOR SELECT
  USING (true); -- Public links are intentionally world-readable

CREATE POLICY public_links_manage ON public_links
  FOR ALL
  USING (
    entity_id IN (
      SELECT c.id FROM calendars c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE wm.user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
    OR
    entity_id IN (
      SELECT e.id FROM events e
      JOIN calendars c ON c.id = e.calendar_id
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE wm.user_id = current_setting('app.current_user_id', TRUE)::uuid
    )
  );
