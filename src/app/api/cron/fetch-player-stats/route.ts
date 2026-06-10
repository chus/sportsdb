import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { resolveTeam, resolvePlayer } from "@/lib/ingestion/resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fetch top-scorer stats from football-data.org and upsert into
 * player_season_stats so player pages render goals / assists / appearances
 * for the current season.
 *
 * Without these rows, every player page tells Google "this player has
 * never played a match" — the second-biggest content gap behind missing
 * standings.
 *
 * Two groups so each run stays under the 60-second function timeout
 * (free tier is 10 req/min → 6.5 s between calls):
 *   ?group=top5      (default)  PL, PD, BL1, SA, FL1
 *   ?group=secondary            DED, PPL, ELC, CL
 *
 * Schedule both groups in vercel.json on staggered times.
 */

const COMPETITION_GROUPS: Record<string, Record<string, string[]>> = {
  top5: {
    PL: ["premier-league"],
    PD: ["primera-division", "la-liga"],
    BL1: ["bundesliga"],
    SA: ["serie-a"],
    FL1: ["ligue-1"],
  },
  secondary: {
    DED: ["eredivisie"],
    PPL: ["primeira-liga"],
    ELC: ["championship"],
    CL: ["uefa-champions-league", "champions-league"],
  },
};

interface ApiScorer {
  player: { id: number; name: string };
  team: { id: number; name: string; shortName: string };
  playedMatches: number;
  goals: number;
  assists: number | null;
}

interface ScorersResponse {
  scorers: ApiScorer[];
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
  const competitionMap = COMPETITION_GROUPS[groupParam];
  if (!competitionMap) {
    return NextResponse.json(
      { error: `Unknown group "${groupParam}". Valid: ${Object.keys(COMPETITION_GROUPS).join(", ")}` },
      { status: 400 },
    );
  }

  const sql = neon(DATABASE_URL);

  // Pre-load the identity fast path from the external_ids mapping table:
  // most entities resolve from these maps with zero round trips. Misses
  // fall through to resolveTeam/resolvePlayer which link by name once
  // and write the mapping.
  const [playerIds, teamIds, compSeasons] = await Promise.all([
    sql`
      SELECT p.id, p.slug, x.provider_id
      FROM external_ids x JOIN players p ON p.id = x.entity_id
      WHERE x.entity_type = 'player' AND x.provider = 'fd'
    `,
    sql`
      SELECT t.id, t.slug, x.provider_id
      FROM external_ids x JOIN teams t ON t.id = x.entity_id
      WHERE x.entity_type = 'team' AND x.provider = 'fd'
    `,
    sql`
      SELECT cs.id, c.slug as comp_slug
      FROM competition_seasons cs
      JOIN competitions c ON c.id = cs.competition_id
      JOIN seasons s ON s.id = cs.season_id
      WHERE s.is_current = true
    `,
  ]);

  const playerByExternalId = new Map<string, { id: string; slug: string }>();
  for (const p of playerIds as Array<{ id: string; slug: string; provider_id: string }>) {
    playerByExternalId.set(`fd-player-${p.provider_id}`, { id: p.id, slug: p.slug });
  }
  const teamByExternalId = new Map<string, { id: string; slug: string }>();
  for (const t of teamIds as Array<{ id: string; slug: string; provider_id: string }>) {
    teamByExternalId.set(`fd-team-${t.provider_id}`, { id: t.id, slug: t.slug });
  }

  const compSeasonMap = new Map<string, string>();
  for (const cs of compSeasons as Array<{ id: string; comp_slug: string }>) {
    compSeasonMap.set(cs.comp_slug, cs.id);
  }

  const summary: Record<string, {
    upserted: number;
    missingPlayer: number;
    missingTeam: number;
    skipped?: string;
  }> = {};

  for (const [code, possibleSlugs] of Object.entries(competitionMap)) {
    let compSeasonId: string | undefined;
    for (const slug of possibleSlugs) {
      compSeasonId = compSeasonMap.get(slug);
      if (compSeasonId) break;
    }
    if (!compSeasonId) {
      summary[code] = { upserted: 0, missingPlayer: 0, missingTeam: 0, skipped: "no current season" };
      continue;
    }

    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/scorers?limit=100`,
      { headers: { "X-Auth-Token": API_KEY } },
    );
    if (!res.ok) {
      summary[code] = { upserted: 0, missingPlayer: 0, missingTeam: 0, skipped: `api ${res.status}` };
      // Don't let one league failure abort the rest of the run.
      await new Promise((r) => setTimeout(r, 6500));
      continue;
    }

    const data = (await res.json()) as ScorersResponse;
    let upserted = 0;
    let missingPlayer = 0;
    let missingTeam = 0;

    for (const scorer of data.scorers ?? []) {
      // Identity-first: external_id map (zero round trips), then the
      // resolver (links by name once + stamps the provider ID).
      const dbPlayer =
        playerByExternalId.get(`fd-player-${scorer.player.id}`) ??
        (await resolvePlayer(sql, "fd", scorer.player.id, scorer.player.name));
      if (!dbPlayer) {
        missingPlayer++;
        continue;
      }

      const dbTeam =
        teamByExternalId.get(`fd-team-${scorer.team.id}`) ??
        (await resolveTeam(sql, "fd", scorer.team.id, scorer.team.name));
      if (!dbTeam) {
        missingTeam++;
        continue;
      }

      await sql`
        INSERT INTO player_season_stats (
          player_id, team_id, competition_season_id,
          appearances, goals, assists,
          yellow_cards, red_cards, minutes_played, clean_sheets,
          updated_at
        ) VALUES (
          ${dbPlayer.id}, ${dbTeam.id}, ${compSeasonId},
          ${scorer.playedMatches || 0}, ${scorer.goals || 0}, ${scorer.assists || 0},
          0, 0, 0, 0,
          NOW()
        )
        ON CONFLICT (player_id, team_id, competition_season_id)
        DO UPDATE SET
          appearances = EXCLUDED.appearances,
          goals = EXCLUDED.goals,
          assists = EXCLUDED.assists,
          updated_at = NOW()
      `;
      upserted++;
    }

    summary[code] = { upserted, missingPlayer, missingTeam };

    // football-data.org free tier: 10 req/min. Six and a half seconds
    // between leagues stays comfortably under the limit and the run as
    // a whole stays under the 60-second function timeout.
    await new Promise((r) => setTimeout(r, 6500));
  }

  return NextResponse.json({
    success: true,
    group: groupParam,
    summary,
    timestamp: new Date().toISOString(),
  });
}
