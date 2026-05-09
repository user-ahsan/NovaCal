// ─── GET /api/search — PostgreSQL Full-Text Search ───
// Source: docs/03-api-websocket-contract.md §4 (High-Speed Search)
// Index: idx_events_search GIN on search_vector (tsvector)
// Weights: Title (A) > Location (B) > Description (C)
// Rule 35-37: GIN-indexed FTS, no external search services

import { NextRequest, NextResponse } from "next/server";
import { db } from "@novacal/db/client";
import { events, calendars } from "@novacal/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { validateSession } from "@/lib/validate-session";
import { handleApiError, errorResponse, ERROR_CODES } from "@/lib/errors";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  start: string;
  end: string;
}

interface SearchResponse {
  results: SearchResult[];
  latencyMs: number;
  total: number;
}

const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_MAX_LIMIT = 50;

/**
 * Sanitizes search input for use in to_tsquery.
 * Removes characters that could break the tsquery syntax
 * and splits into tokens for prefix matching.
 *
 * Prefix matching (:* suffix) provides typo tolerance:
 * "spr" matches "sprint", "spring", etc.
 */
function buildTsQuery(searchTerm: string): string {
  return searchTerm
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      // Remove special characters that could break tsquery syntax
      const clean = token.replace(/[&|!:*()<>"'\\]/g, "").trim();
      if (!clean) return null;
      // Add prefix matching for typo tolerance
      return `${clean}:*`;
    })
    .filter(Boolean)
    .join(" & ");
}

/**
 * Extracts a relevant text snippet from event description/title.
 * Shows surrounding context around the matched terms.
 */
function extractSnippet(
  title: string,
  description: string | null,
  query: string,
): string {
  const searchLower = query.toLowerCase();
  const text = description ?? title;
  const textLower = text.toLowerCase();

  const index = textLower.indexOf(searchLower);
  if (index === -1) {
    // Fallback: return start of description or truncated title
    return text.length > 150 ? `...${text.slice(0, 147)}...` : text;
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + searchLower.length + 60);
  let snippet = text.slice(start, end);

  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;

  return snippet;
}

// ─── GET /api/search ───

export async function GET(request: NextRequest) {
  const startTime = performance.now();

  try {
    await validateSession(request);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const limitParam = searchParams.get("limit");
    const workspaceId = searchParams.get("workspaceId");

    if (!q || q.trim().length === 0) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Query parameter 'q' is required",
      );
    }

    const limit = Math.min(
      Math.max(1, Number(limitParam) || SEARCH_DEFAULT_LIMIT),
      SEARCH_MAX_LIMIT,
    );

    // Build tsquery with prefix matching for typo tolerance
    const tsquery = buildTsQuery(q);

    if (!tsquery) {
      return errorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Search query contains no valid searchable terms",
      );
    }

    // Build the search query using PostgreSQL GIN-indexed tsvector
    // Uses raw SQL for to_tsvector / to_tsquery / ts_rank since Drizzle
    // doesn't have native full-text search operators.
    const searchCondition = sql`search_vector @@ to_tsquery('english', ${tsquery})`;

    // Build WHERE clause
    const whereConditions = [searchCondition, eq(events.deletedAt, null)];

    // If workspaceId is provided, scope search to calendars in that workspace
    if (workspaceId) {
      whereConditions.push(eq(calendars.workspaceId, workspaceId));
    }

    // Execute search with ranking
    const searchRows = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        startTime: events.startTime,
        endTime: events.endTime,
        rank: sql`ts_rank(search_vector, to_tsquery('english', ${tsquery}))`.as<number>("rank"),
        calendarWorkspaceId: calendars.workspaceId,
      })
      .from(events)
      .innerJoin(calendars, eq(events.calendarId, calendars.id))
      .where(and(...whereConditions))
      .orderBy(sql`rank DESC`)
      .limit(limit);

    // Get total count (for informational purposes, without pagination complexity)
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .innerJoin(calendars, eq(events.calendarId, calendars.id))
      .where(and(...whereConditions));

    const total = countResult[0]?.count ?? 0;
    const latencyMs = Math.round(performance.now() - startTime);

    // Build response with snippets
    const results: SearchResult[] = searchRows.map((row) => ({
      id: row.id,
      title: row.title,
      snippet: extractSnippet(row.title, row.description, q),
      start: row.startTime.toISOString(),
      end: row.endTime.toISOString(),
    }));

    const response: SearchResponse = { results, latencyMs, total };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}
