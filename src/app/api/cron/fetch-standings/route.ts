import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fetch current-season league standings from football-data.org and upsert
 * them into the standings table.
 *
 * Scheduled because team and competition pages render "No standings data"
 * when this table is empty — which Google reads as thin content and drops
 * from the index. Runs hourly during the football week.
 *
 * Free-tier limit: 10 requests/minute. We cover 5 leagues per run with a
 * 7-second pause between each → total run ~35 seconds, well under the
 * 60-second function timeout.
 */

const LEAGUE_MAP: Record<string, string> = {
  PL: "premier-league",
  PD: "la-liga",
  BL1: "bundesliga",
  SA: "serie-a",
  FL1: "ligue-1",
};

interface StandingEntry {
  position: number;
  team: { id: number; name: string; shortName: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
}

async function verifyCronSecret() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  // Same key the manual script uses. Move to FOOTBALL_DATA_API_KEY env var
  // when convenient — kept inline so the cron works in any environment.
  const API_KEY = process.env.FOOTBALL_DATA_API_KEY ?? "226de578459844eeb0c5539b1859ed1e";

  if (!DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }

  const sql = neon(DATABASE_URL);
  const summary: Record<string, { fetched: number; upserted: number; notFound: number }> = {};

  for (const [code, slug] of Object.entries(LEAGUE_MAP)) {
    const comp = await sql`
      SELECT cs.id as competition_season_id
      FROM competitions c
      JOIN competition_seasons cs ON cs.competition_id = c.id
      JOIN seasons s ON s.id = cs.season_id
      WHERE c.slug = ${slug} AND s.is_current = true
      LIMIT 1
    `;
    if (comp.length === 0) {
      summary[slug] = { fetched: 0, upserted: 0, notFound: 0 };
      continue;
    }
    const competitionSeasonId = comp[0].competition_season_id;

    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/standings`,
      { headers: { "X-Auth-Token": API_KEY } },
    );
    if (!res.ok) {
      summary[slug] = { fetched: 0, upserted: 0, notFound: -1 };
      // Continue to other leagues — one failure shouldn't kill the whole run.
      continue;
    }

    const data = await res.json();
    const standings: StandingEntry[] = data.standings?.[0]?.table || [];
    let upserted = 0;
    let notFound = 0;

    for (const entry of standings) {
      // Three-tier team match: exact name/short_name, ILIKE partial, then
      // strip "FC"/"CF"/"SC" suffix and ILIKE. Mirrors the manual script.
      const teamName = entry.team.name;
      const exact = await sql`
        SELECT id FROM teams WHERE name = ${teamName} OR short_name = ${teamName} LIMIT 1
      `;
      let team = exact[0];
      if (!team) {
        const partial = await sql`
          SELECT id FROM teams
          WHERE name ILIKE ${`%${teamName}%`} OR short_name ILIKE ${`%${teamName}%`}
          LIMIT 1
        `;
        team = partial[0];
      }
      if (!team) {
        const cleanName = teamName.replace(/ FC$| CF$| SC$/i, "").trim();
        const clean = await sql`
          SELECT id FROM teams
          WHERE name ILIKE ${`%${cleanName}%`} OR short_name ILIKE ${`%${cleanName}%`}
          LIMIT 1
        `;
        team = clean[0];
      }
      if (!team) {
        notFound++;
        continue;
      }

      await sql`
        INSERT INTO standings (
          competition_season_id, team_id, position, played, won, drawn, lost,
          goals_for, goals_against, goal_difference, points, form
        )
        VALUES (
          ${competitionSeasonId}, ${team.id}, ${entry.position}, ${entry.playedGames},
          ${entry.won}, ${entry.draw}, ${entry.lost},
          ${entry.goalsFor}, ${entry.goalsAgainst}, ${entry.goalDifference},
          ${entry.points}, ${entry.form}
        )
        ON CONFLICT (competition_season_id, team_id)
        DO UPDATE SET
          position = EXCLUDED.position,
          played = EXCLUDED.played,
          won = EXCLUDED.won,
          drawn = EXCLUDED.drawn,
          lost = EXCLUDED.lost,
          goals_for = EXCLUDED.goals_for,
          goals_against = EXCLUDED.goals_against,
          goal_difference = EXCLUDED.goal_difference,
          points = EXCLUDED.points,
          form = EXCLUDED.form,
          updated_at = now()
      `;
      upserted++;
    }

    summary[slug] = { fetched: standings.length, upserted, notFound };

    // Free-tier rate limit: 10 req/min. Wait 7 seconds between leagues.
    await new Promise((r) => setTimeout(r, 7000));
  }

  return NextResponse.json({
    success: true,
    summary,
    timestamp: new Date().toISOString(),
  });
}
