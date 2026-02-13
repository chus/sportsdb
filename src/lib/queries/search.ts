import { db } from "@/lib/db";
import { searchIndex } from "@/lib/db/schema";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
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

  // Full-text search with ranking
  const results = await db.execute<{
    id: string;
    entity_type: string;
    slug: string;
    name: string;
    subtitle: string | null;
    meta: string | null;
    rank: number;
  }>(sql`
    SELECT
      id,
      entity_type,
      slug,
      name,
      subtitle,
      meta,
      ts_rank(
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(meta, '')),
        to_tsquery('english', ${sanitizedQuery + ":*"})
      ) as rank
    FROM search_index
    WHERE to_tsvector('english', coalesce(name, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(meta, ''))
      @@ to_tsquery('english', ${sanitizedQuery + ":*"})
    ${typeFilter}
    ORDER BY rank DESC, name ASC
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
