import { db } from "@/lib/db";
import { analyticsEvents, searchAnalytics, players, teams } from "@/lib/db/schema";
import { desc, eq, gte, and, ne, count } from "drizzle-orm";

const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getTrendingPlayers(limit = 10) {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);

  const trendingData = await db
    .select({
      entityId: analyticsEvents.entityId,
      views: count(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.entityType, "player"),
        eq(analyticsEvents.eventType, "page_view"),
        gte(analyticsEvents.timestamp, since)
      )
    )
    .groupBy(analyticsEvents.entityId)
    .orderBy(desc(count()))
    .limit(limit);

  const results = await Promise.all(
    trendingData.map(async (item) => {
      if (!item.entityId) return null;
      const [player] = await db
        .select({
          id: players.id,
          name: players.name,
          slug: players.slug,
          imageUrl: players.imageUrl,
          position: players.position,
          nationality: players.nationality,
        })
        .from(players)
        .where(and(eq(players.id, item.entityId), ne(players.position, "Unknown")))
        .limit(1);
      return player ? { ...player, views: Number(item.views) } : null;
    })
  );

  return results.filter(Boolean) as Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    position: string;
    nationality: string | null;
    views: number;
  }>;
}

export async function getTrendingTeams(limit = 10) {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);

  const trendingData = await db
    .select({
      entityId: analyticsEvents.entityId,
      views: count(),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.entityType, "team"),
        eq(analyticsEvents.eventType, "page_view"),
        gte(analyticsEvents.timestamp, since)
      )
    )
    .groupBy(analyticsEvents.entityId)
    .orderBy(desc(count()))
    .limit(limit);

  const results = await Promise.all(
    trendingData.map(async (item) => {
      if (!item.entityId) return null;
      const [team] = await db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          logoUrl: teams.logoUrl,
          country: teams.country,
        })
        .from(teams)
        .where(eq(teams.id, item.entityId))
        .limit(1);
      return team ? { ...team, views: Number(item.views) } : null;
    })
  );

  return results.filter(Boolean) as Array<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    country: string;
    views: number;
  }>;
}

export async function getTrendingSearches(limit = 15) {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);

  const results = await db
    .select({
      query: searchAnalytics.query,
      searchCount: count(),
    })
    .from(searchAnalytics)
    .where(gte(searchAnalytics.searchedAt, since))
    .groupBy(searchAnalytics.query)
    .orderBy(desc(count()))
    .limit(limit);

  return results.map((r) => ({
    query: r.query,
    count: Number(r.searchCount),
  }));
}
