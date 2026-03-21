import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  users,
  articles,
  matches,
  subscriptions,
  teams,
  players,
  competitions,
  seasons,
  playerSeasonStats,
  matchEvents,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { count, eq, ne } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      usersResult,
      articlesResult,
      matchesResult,
      subscriptionsResult,
      pendingResult,
      teamsResult,
      playersResult,
      competitionsResult,
      seasonsResult,
      playerStatsResult,
      matchEventsResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(articles),
      db.select({ count: count() }).from(matches),
      db
        .select({ count: count() })
        .from(subscriptions)
        .where(ne(subscriptions.tier, "free")),
      db
        .select({ count: count() })
        .from(articles)
        .where(eq(articles.status, "draft")),
      db.select({ count: count() }).from(teams),
      db.select({ count: count() }).from(players),
      db.select({ count: count() }).from(competitions),
      db.select({ count: count() }).from(seasons),
      db.select({ count: count() }).from(playerSeasonStats),
      db.select({ count: count() }).from(matchEvents),
    ]);

    return NextResponse.json({
      totalUsers: usersResult[0].count,
      articlesPublished: articlesResult[0].count,
      matchesTracked: matchesResult[0].count,
      activeSubscriptions: subscriptionsResult[0].count,
      monthlyRevenue: 0,
      pendingArticles: pendingResult[0].count,
      // Table row counts for the Data page
      tableCounts: {
        teams: teamsResult[0].count,
        players: playersResult[0].count,
        matches: matchesResult[0].count,
        competitions: competitionsResult[0].count,
        seasons: seasonsResult[0].count,
        articles: articlesResult[0].count,
        playerStats: playerStatsResult[0].count,
        matchEvents: matchEventsResult[0].count,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
