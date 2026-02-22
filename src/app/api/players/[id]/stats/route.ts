import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  players,
  playerSeasonStats,
  competitionSeasons,
  competitions,
  seasons,
  teams,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const seasonId = searchParams.get("season_id");

  try {
    // Resolve player ID - could be UUID or slug
    let playerId = id;
    if (!isUUID(id)) {
      // It's a slug, look up the player
      const [player] = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.slug, id))
        .limit(1);

      if (!player) {
        return NextResponse.json(
          { error: "Player not found" },
          { status: 404 }
        );
      }
      playerId = player.id;
    }

    // Build query
    let query = db
      .select({
        stat: playerSeasonStats,
        competition: {
          id: competitions.id,
          name: competitions.name,
          slug: competitions.slug,
        },
        season: {
          id: seasons.id,
          label: seasons.label,
          isCurrent: seasons.isCurrent,
        },
        team: {
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          logoUrl: teams.logoUrl,
        },
      })
      .from(playerSeasonStats)
      .innerJoin(
        competitionSeasons,
        eq(playerSeasonStats.competitionSeasonId, competitionSeasons.id)
      )
      .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
      .innerJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
      .innerJoin(teams, eq(playerSeasonStats.teamId, teams.id))
      .where(eq(playerSeasonStats.playerId, playerId))
      .orderBy(desc(seasons.startDate));

    const results = await query;

    // Filter by season if specified
    const filteredResults = seasonId
      ? results.filter((r) => r.season.id === seasonId)
      : results;

    // Calculate totals
    const totals = {
      appearances: filteredResults.reduce((sum, r) => sum + r.stat.appearances, 0),
      goals: filteredResults.reduce((sum, r) => sum + r.stat.goals, 0),
      assists: filteredResults.reduce((sum, r) => sum + r.stat.assists, 0),
      yellowCards: filteredResults.reduce((sum, r) => sum + r.stat.yellowCards, 0),
      redCards: filteredResults.reduce((sum, r) => sum + r.stat.redCards, 0),
      minutesPlayed: filteredResults.reduce((sum, r) => sum + r.stat.minutesPlayed, 0),
    };

    return NextResponse.json({
      stats: filteredResults,
      totals,
      seasonId: seasonId || null,
    });
  } catch (error) {
    console.error("Failed to fetch player stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch player stats" },
      { status: 500 }
    );
  }
}
