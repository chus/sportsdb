import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { resolveTeam } from "@/lib/ingestion/resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fetch current-season league standings from football-data.org and upsert
 * them into the standings table.
 *
 * Scheduled because team and competition pages render "No standings data"
 * when this table is empty — which Google reads as thin content and drops
 * from the index.
 *
 * Two groups so each run stays under the 60-second function timeout
 * (free tier is 10 req/min → 6.5 s between calls):
 *   ?group=top5      (default)  PL, PD, BL1, SA, FL1
 *   ?group=secondary            DED, PPL, ELC, CL
 *
 * Schedule both groups in vercel.json on staggered times.
 */

const LEAGUE_GROUPS: Record<string, Record<string, string>> = {
  top5: {
    PL: "premier-league",
    PD: "la-liga",
    BL1: "bundesliga",
    SA: "serie-a",
    FL1: "ligue-1",
  },
  secondary: {
    DED: "eredivisie",
    PPL: "primeira-liga",
    ELC: "championship",
    CL: "uefa-champions-league",
  },
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

export async function GET(request: NextRequest) {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

  if (!DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "Missing FOOTBALL_DATA_API_KEY" }, { status: 500 });
  }

  const groupParam = request.nextUrl.searchParams.get("group") ?? "top5";
  const leagueMap = LEAGUE_GROUPS[groupParam];
  if (!leagueMap) {
    return NextResponse.json(
      { error: `Unknown group "${groupParam}". Valid: ${Object.keys(LEAGUE_GROUPS).join(", ")}` },
      { status: 400 },
    );
  }

  const sql = neon(DATABASE_URL);
  const summary: Record<string, { fetched: number; upserted: number; notFound: number }> = {};

  for (const [code, slug] of Object.entries(leagueMap)) {
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

    // Guard: football-data.org rolls its "current season" to the upcoming
    // campaign before ours does, returning a pre-season table where every
    // team sits at position 1 with 0 played / 0 points. Upserting that over
    // our real (just-completed) season wipes the standings to zeros — this
    // is exactly what corrupted the Eredivisie table. API-Football (Pro,
    // primary) owns standings now; only let fd refresh a league when it
    // actually returns a played table.
    const hasPlayedGames = standings.some((s) => s.playedGames > 0);
    if (standings.length === 0 || !hasPlayedGames) {
      summary[slug] = { fetched: standings.length, upserted: 0, notFound: 0 };
      await new Promise((r) => setTimeout(r, 7000));
      continue;
    }

    let upserted = 0;
    let notFound = 0;

    for (const entry of standings) {
      // Identity-first: provider team ID is authoritative; name matching
      // only links once and stamps the ID. No creation here — an unknown
      // team in standings means our team set has a gap worth surfacing.
      const team = await resolveTeam(sql, "fd", entry.team.id, entry.team.name);
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
    group: groupParam,
    summary,
    timestamp: new Date().toISOString(),
  });
}
