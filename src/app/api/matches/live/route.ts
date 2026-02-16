import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matches, teams, competitions, competitionSeasons, venues } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Get matches that are live or at half time
    const liveMatches = await db
      .select()
      .from(matches)
      .where(inArray(matches.status, ["live", "half_time"]))
      .orderBy(matches.scheduledAt);

    if (liveMatches.length === 0) {
      return NextResponse.json({ matches: [], timestamp: new Date().toISOString() });
    }

    // Get related data for each match
    const matchesWithDetails = await Promise.all(
      liveMatches.map(async (match) => {
        const [homeTeam, awayTeam, venueData, compSeasonData] = await Promise.all([
          db.select().from(teams).where(eq(teams.id, match.homeTeamId)).then(r => r[0]),
          db.select().from(teams).where(eq(teams.id, match.awayTeamId)).then(r => r[0]),
          match.venueId
            ? db.select().from(venues).where(eq(venues.id, match.venueId)).then(r => r[0])
            : null,
          db
            .select({ competition: competitions })
            .from(competitionSeasons)
            .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
            .where(eq(competitionSeasons.id, match.competitionSeasonId))
            .then(r => r[0]),
        ]);

        return {
          id: match.id,
          status: match.status,
          minute: match.minute,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          scheduledAt: match.scheduledAt,
          homeTeam: homeTeam ? {
            id: homeTeam.id,
            name: homeTeam.name,
            shortName: homeTeam.shortName,
            slug: homeTeam.slug,
            logoUrl: homeTeam.logoUrl,
          } : null,
          awayTeam: awayTeam ? {
            id: awayTeam.id,
            name: awayTeam.name,
            shortName: awayTeam.shortName,
            slug: awayTeam.slug,
            logoUrl: awayTeam.logoUrl,
          } : null,
          venue: venueData ? {
            name: venueData.name,
            slug: venueData.slug,
          } : null,
          competition: compSeasonData?.competition ? {
            name: compSeasonData.competition.name,
            slug: compSeasonData.competition.slug,
          } : null,
        };
      })
    );

    return NextResponse.json({
      matches: matchesWithDetails,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching live matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch live matches", matches: [] },
      { status: 500 }
    );
  }
}
