-- NovaCal Database Indexes & Full-Text Search
-- PostgreSQL 16 — Performance Migration
-- Run after 0000_initial.sql

-- ─── 1. High-Speed Grid Queries (Composite B-Tree Index) ───
-- When the Web UI loads a Month view, it queries by calendar_id
-- and a start_time / end_time range.
CREATE INDEX IF NOT EXISTS idx_events_time_range
  ON events (calendar_id, start_time, end_time)
  WHERE deleted_at IS NULL;

-- ─── 2. Native Full-Text Search (GIN Index) ───
-- Eliminates the need for ElasticSearch. Combines title, description,
-- and location into a generated tsvector column with weighted priorities.

-- Add generated tsvector column for full-text search
ALTER TABLE events ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;

-- GIN index for lightning-fast full-text search
CREATE INDEX IF NOT EXISTS idx_events_search
  ON events
  USING GIN(search_vector);

-- ─── 3. Sync & Conflict Resolution (B-Tree on updated_at) ───
-- The mobile app syncs by requesting all changes since its last sync timestamp.
-- Partial index covers soft-deleted records and recent changes (last 30 days).
CREATE INDEX IF NOT EXISTS idx_events_sync
  ON events (updated_at)
  WHERE deleted_at IS NOT NULL OR updated_at > NOW() - INTERVAL '30 days';
