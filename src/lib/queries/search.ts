import { db } from "@/lib/db";
import { searchIndex, searchAnalytics, players } from "@/lib/db/schema";
import { eq, ilike, or, and, sql, desc, gte } from "drizzle-orm";
import type { SearchResult } from "@/types/entities";

/**
 * Search entities using Postgres full-text search.
 * Uses to_tsvector for indexing and ts_rank for relevance ranking.
 * Falls back to ILIKE for partial matches when no full-text results.
 */
export async function searchEntities(
  query: string,
  entityType?: string,
  limit = 10
): Promise<SearchResult[]> {
  // Sanitize query for tsquery - remove special characters
  const sanitizedQuery = query
    .trim()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" & ");

  if (!sanitizedQuery) {
    return [];
  }

  // Build the WHERE clause for entity type filter
  const typeFilter = entityType
    ? sql`AND ${searchIndex.entityType} = ${entityType}`
    : sql``;

  // Full-text search with ranking, boosted by popularity for players
  const results = await db.execute<{
    id: string;
    entity_type: string;
    slug: string;
    name: string;
    subtitle: string | null;
    meta: string | null;
    rank: number;
    popularity: number | null;
  }>(sql`
    SELECT
      si.id,
      si.entity_type,
      si.slug,
      si.name,
      si.subtitle,
      si.meta,
      ts_rank(
        to_tsvector('english', coalesce(si.name, '') || ' ' || coalesce(si.subtitle, '') || ' ' || coalesce(si.meta, '')),
        to_tsquery('english', ${sanitizedQuery + ":*"})
      ) as rank,
      CASE WHEN si.entity_type = 'player' THEN p.popularity_score ELSE 0 END as popularity
    FROM search_index si
    LEFT JOIN players p ON si.entity_type = 'player' AND si.id = p.id
    WHERE to_tsvector('english', coalesce(si.name, '') || ' ' || coalesce(si.subtitle, '') || ' ' || coalesce(si.meta, ''))
      @@ to_tsquery('english', ${sanitizedQuery + ":*"})
    ${typeFilter}
    ORDER BY
      -- Boost exact name matches
      CASE WHEN lower(si.name) = lower(${query}) THEN 1000 ELSE 0 END DESC,
      -- Boost prefix matches (name starts with query)
      CASE WHEN lower(si.name) LIKE lower(${query + "%"}) THEN 500 ELSE 0 END DESC,
      -- Combine text relevance with popularity
      (rank * 100) + coalesce(CASE WHEN si.entity_type = 'player' THEN p.popularity_score ELSE 0 END, 0) DESC,
      si.name ASC
    LIMIT ${limit}
  `);

  // If full-text search returns results, use them
  if (results.rows.length > 0) {
    return results.rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type as SearchResult["entityType"],
      slug: r.slug,
      name: r.name,
      subtitle: r.subtitle,
      meta: r.meta,
    }));
  }

  // Fallback to ILIKE for partial matches (handles typos, substrings)
  const pattern = `%${query}%`;
  const filters = [
    or(
      ilike(searchIndex.name, pattern),
      ilike(searchIndex.subtitle, pattern),
      ilike(searchIndex.meta, pattern)
    ),
  ];

  if (entityType) {
    filters.push(eq(searchIndex.entityType, entityType));
  }

  const fallbackResults = await db
    .select()
    .from(searchIndex)
    .where(and(...filters))
    .limit(limit);

  return fallbackResults.map((r) => ({
    id: r.id,
    entityType: r.entityType as SearchResult["entityType"],
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    meta: r.meta,
  }));
}

/**
 * Track a search query for analytics purposes.
 * Used to calculate popular searches.
 */
export async function trackSearch(
  query: string,
  resultsCount: number,
  entityType?: string
): Promise<void> {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery || trimmedQuery.length < 2) return;

  try {
    await db.insert(searchAnalytics).values({
      query: trimmedQuery,
      resultsCount,
      entityType: entityType || null,
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break search
    console.error("Failed to track search:", error);
  }
}

/**
 * Get popular searches from the last N days.
 * Returns queries sorted by frequency.
 */
export async function getPopularSearches(
  limit = 10,
  daysBack = 7
): Promise<{ query: string; count: number }[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const results = await db
    .select({
      query: searchAnalytics.query,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(searchAnalytics)
    .where(gte(searchAnalytics.searchedAt, cutoffDate))
    .groupBy(searchAnalytics.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return results;
}

/**
 * Get featured entities for each type to show on empty search pages.
 * Returns popular players, teams, and competitions.
 */
export async function getFeaturedEntities(limitPerType = 6): Promise<{
  players: SearchResult[];
  teams: SearchResult[];
  competitions: SearchResult[];
}> {
  // Get top players by popularity score
  const featuredPlayers = await db.execute<{
    id: string;
    entity_type: string;
    slug: string;
    name: string;
    subtitle: string | null;
    meta: string | null;
  }>(sql`
    SELECT si.id, si.entity_type, si.slug, si.name, si.subtitle, si.meta
    FROM search_index si
    LEFT JOIN players p ON si.id = p.id
    WHERE si.entity_type = 'player'
    ORDER BY coalesce(p.popularity_score, 0) DESC
    LIMIT ${limitPerType}
  `);

  // Get top teams (prefer tier 1 and 2 teams)
  const featuredTeams = await db.execute<{
    id: string;
    entity_type: string;
    slug: string;
    name: string;
    subtitle: string | null;
    meta: string | null;
  }>(sql`
    SELECT si.id, si.entity_type, si.slug, si.name, si.subtitle, si.meta
    FROM search_index si
    LEFT JOIN teams t ON si.id = t.id
    WHERE si.entity_type = 'team'
    ORDER BY coalesce(t.tier, 3) ASC, si.name ASC
    LIMIT ${limitPerType}
  `);

  // Get featured competitions
  const featuredCompetitions = await db
    .select()
    .from(searchIndex)
    .where(eq(searchIndex.entityType, "competition"))
    .orderBy(searchIndex.name)
    .limit(limitPerType);

  const mapResult = (r: { id: string; entity_type?: string; entityType?: string; slug: string; name: string; subtitle: string | null; meta: string | null }): SearchResult => ({
    id: r.id,
    entityType: (r.entity_type || r.entityType) as SearchResult["entityType"],
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    meta: r.meta,
  });

  return {
    players: featuredPlayers.rows.map(mapResult),
    teams: featuredTeams.rows.map(mapResult),
    competitions: featuredCompetitions.map(r => ({
      id: r.id,
      entityType: r.entityType as SearchResult["entityType"],
      slug: r.slug,
      name: r.name,
      subtitle: r.subtitle,
      meta: r.meta,
    })),
  };
}
