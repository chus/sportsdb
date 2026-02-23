import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { players, teams, competitions, playerTeamHistory, teamSeasons, competitionSeasons, seasons } from "@/lib/db/schema";
import { desc, eq, and, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    if (type === "players") {
      // Get popular players (by popularity score) with their current team
      const results = await db
        .select({
          id: players.id,
          name: players.name,
          slug: players.slug,
          position: players.position,
          imageUrl: players.imageUrl,
          teamName: teams.name,
        })
        .from(players)
        .leftJoin(
          playerTeamHistory,
          and(
            eq(playerTeamHistory.playerId, players.id),
            isNull(playerTeamHistory.validTo)
          )
        )
        .leftJoin(teams, eq(playerTeamHistory.teamId, teams.id))
        .where(eq(players.status, "active"))
        .orderBy(desc(players.popularityScore))
        .limit(8);

      return NextResponse.json(results);
    }

    if (type === "teams") {
      // Get top tier teams - simple query without complex joins
      const results = await db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          country: teams.country,
          logoUrl: teams.logoUrl,
        })
        .from(teams)
        .where(eq(teams.tier, 1))
        .orderBy(teams.name)
        .limit(6);

      // Add competition name separately
      const teamsWithCompetition = await Promise.all(
        results.map(async (team) => {
          // Get current season
          const [currentSeason] = await db
            .select()
            .from(seasons)
            .where(eq(seasons.isCurrent, true))
            .limit(1);

          if (!currentSeason) {
            return { ...team, competitionName: null };
          }

          // Get team's competition for current season
          const [teamSeason] = await db
            .select({
              competitionName: competitions.name,
            })
            .from(teamSeasons)
            .innerJoin(competitionSeasons, eq(teamSeasons.competitionSeasonId, competitionSeasons.id))
            .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
            .where(
              and(
                eq(teamSeasons.teamId, team.id),
                eq(competitionSeasons.seasonId, currentSeason.id)
              )
            )
            .limit(1);

          return {
            ...team,
            competitionName: teamSeason?.competitionName ?? null,
          };
        })
      );

      return NextResponse.json(teamsWithCompetition);
    }

    if (type === "competitions") {
      // Get major competitions
      const results = await db
        .select({
          id: competitions.id,
          name: competitions.name,
          slug: competitions.slug,
          type: competitions.type,
          logoUrl: competitions.logoUrl,
          country: competitions.country,
        })
        .from(competitions)
        .orderBy(competitions.name)
        .limit(4);

      return NextResponse.json(results);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
