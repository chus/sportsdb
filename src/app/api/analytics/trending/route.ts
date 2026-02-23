import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyticsEvents, searchAnalytics, players, teams, competitions } from "@/lib/db/schema";
import { desc, sql, eq, gte, and, count } from "drizzle-orm";

export async function GET() {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get trending searches from search_analytics
    const trendingSearches = await db
      .select({
        query: searchAnalytics.query,
        count: count(),
      })
      .from(searchAnalytics)
      .where(gte(searchAnalytics.searchedAt, last24Hours))
      .groupBy(searchAnalytics.query)
      .orderBy(desc(count()))
      .limit(10);

    // Get trending players (most viewed)
    const trendingPlayersData = await db
      .select({
        entityId: analyticsEvents.entityId,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.entityType, "player"),
          eq(analyticsEvents.eventType, "page_view"),
          gte(analyticsEvents.timestamp, last24Hours)
        )
      )
      .groupBy(analyticsEvents.entityId)
      .orderBy(desc(count()))
      .limit(5);

    // Get player details
    const trendingPlayers = await Promise.all(
      trendingPlayersData.map(async (item) => {
        if (!item.entityId) return null;
        const [player] = await db
          .select({
            id: players.id,
            name: players.name,
            slug: players.slug,
            imageUrl: players.imageUrl,
          })
          .from(players)
          .where(eq(players.id, item.entityId))
          .limit(1);
        return player ? { ...player, views: item.count } : null;
      })
    );

    // Get trending teams (most viewed)
    const trendingTeamsData = await db
      .select({
        entityId: analyticsEvents.entityId,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.entityType, "team"),
          eq(analyticsEvents.eventType, "page_view"),
          gte(analyticsEvents.timestamp, last24Hours)
        )
      )
      .groupBy(analyticsEvents.entityId)
      .orderBy(desc(count()))
      .limit(5);

    // Get team details
    const trendingTeams = await Promise.all(
      trendingTeamsData.map(async (item) => {
        if (!item.entityId) return null;
        const [team] = await db
          .select({
            id: teams.id,
            name: teams.name,
            slug: teams.slug,
            logoUrl: teams.logoUrl,
          })
          .from(teams)
          .where(eq(teams.id, item.entityId))
          .limit(1);
        return team ? { ...team, views: item.count } : null;
      })
    );

    return NextResponse.json({
      searches: trendingSearches.map((s) => ({
        query: s.query,
        count: Number(s.count),
      })),
      players: trendingPlayers.filter(Boolean),
      teams: trendingTeams.filter(Boolean),
    });
  } catch (error) {
    console.error("Trending analytics error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
