import { db } from "@/lib/db";
import { searchIndex, searchAnalytics, players } from "@/lib/db/schema";
import { eq, ilike, or, and, sql, desc, gte } from "drizzle-orm";
import type { SearchResult } from "@/types/entities";

/**
 * Autocomplete-style search that works with partial input.
 * Matches any word in the name starting with the query (e.g., "mes" finds "Lionel Messi")
 * Results ranked by: exact match > prefix match > contains match > popularity
 */
export async function searchEntities(
  query: string,
  entityType?: string,
  limit = 10
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim().toLowerCase();

  // Require at least 2 characters for search
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return [];
  }

  // Build type filter
  const typeFilter = entityType
    ? sql`AND si.entity_type = ${entityType}`
    : sql``;

  // Patterns for different match types
  const exactPattern = trimmedQuery;
  const prefixPattern = `${trimmedQuery}%`;
  const wordPrefixPattern = `% ${trimmedQuery}%`; // Matches word boundaries (space before)
  const exactWordPattern = `% ${trimmedQuery} %`; // Exact word match with spaces
  const exactWordEndPattern = `% ${trimmedQuery}`; // Word at end of name
  const containsPattern = `%${trimmedQuery}%`;

  // Autocomplete search with smart ranking
  const results = await db.execute<{
    id: string;
    entity_type: string;
    slug: string;
    name: string;
    subtitle: string | null;
    meta: string | null;
    popularity: number | null;
    match_rank: number;
  }>(sql`
    SELECT
      si.id,
      si.entity_type,
      si.slug,
      si.name,
      si.subtitle,
      si.meta,
      CASE WHEN si.entity_type = 'player' THEN p.popularity_score ELSE 0 END as popularity,
      CASE
        -- Exact match on full name (highest priority)
        WHEN lower(si.name) = ${exactPattern} THEN 10000
        -- Exact word match in name (e.g., "Messi" as a complete word)
        WHEN lower(' ' || si.name || ' ') LIKE ${'% ' + trimmedQuery + ' %'} THEN 8000
        -- Name starts with query exactly
        WHEN lower(si.name) LIKE ${prefixPattern} THEN 5000
        -- Any word in name starts with query (e.g., "Mes" in "Lionel Messi")
        WHEN lower(si.name) LIKE ${wordPrefixPattern} THEN 3000
        -- Subtitle matches
        WHEN lower(coalesce(si.subtitle, '')) LIKE ${prefixPattern} THEN 1000
        WHEN lower(coalesce(si.subtitle, '')) LIKE ${wordPrefixPattern} THEN 800
        -- Name contains query anywhere
        WHEN lower(si.name) LIKE ${containsPattern} THEN 500
        -- Subtitle/meta contains query
        WHEN lower(coalesce(si.subtitle, '')) LIKE ${containsPattern} THEN 200
        WHEN lower(coalesce(si.meta, '')) LIKE ${containsPattern} THEN 100
        ELSE 0
      END as match_rank
    FROM search_index si
    LEFT JOIN players p ON si.entity_type = 'player' AND si.id = p.id
    LEFT JOIN teams t ON si.entity_type = 'team' AND si.id = t.id
    WHERE (
      lower(si.name) LIKE ${containsPattern}
      OR lower(coalesce(si.subtitle, '')) LIKE ${containsPattern}
      OR lower(coalesce(si.meta, '')) LIKE ${containsPattern}
    )
    ${typeFilter}
    ORDER BY
      match_rank DESC,
      -- Within same match rank, order by popularity (players) or tier (teams)
      CASE
        WHEN si.entity_type = 'player' THEN coalesce(p.popularity_score, 0)
        WHEN si.entity_type = 'team' THEN (4 - coalesce(t.tier, 3)) * 100
        ELSE 0
      END DESC,
      si.name ASC
    LIMIT ${limit}
  `);

  return results.rows.map((r) => ({
    id: r.id,
    entityType: r.entity_type as SearchResult["entityType"],
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
 * Get all entities of a specific type (for browsing without search query).
 * Returns entities ordered by relevance/popularity.
 */
export async function getEntitiesByType(
  entityType: string,
  limit = 50
): Promise<SearchResult[]> {
  if (entityType === "player") {
    const results = await db.execute<{
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
      LIMIT ${limit}
    `);
    return results.rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type as SearchResult["entityType"],
      slug: r.slug,
      name: r.name,
      subtitle: r.subtitle,
      meta: r.meta,
    }));
  }

  if (entityType === "team") {
    const results = await db.execute<{
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
      LIMIT ${limit}
    `);
    return results.rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type as SearchResult["entityType"],
      slug: r.slug,
      name: r.name,
      subtitle: r.subtitle,
      meta: r.meta,
    }));
  }

  // For competition, venue, etc.
  const results = await db
    .select()
    .from(searchIndex)
    .where(eq(searchIndex.entityType, entityType))
    .orderBy(searchIndex.name)
    .limit(limit);

  return results.map((r) => ({
    id: r.id,
    entityType: r.entityType as SearchResult["entityType"],
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    meta: r.meta,
  }));
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
