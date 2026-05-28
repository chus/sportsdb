import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { findTeamByName } from "@/lib/seo/team-matcher";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  const API_KEY =
    process.env.FOOTBALL_DATA_API_KEY ?? "226de578459844eeb0c5539b1859ed1e";
  if (!DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
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

  // Pre-load lookups once. Two thousand-row scans beat thousands of
  // per-scorer round trips.
  const [allPlayers, allTeams, compSeasons] = await Promise.all([
    sql`SELECT id, name, slug FROM players`,
    sql`SELECT id, name, short_name, slug FROM teams`,
    sql`
      SELECT cs.id, c.slug as comp_slug
      FROM competition_seasons cs
      JOIN competitions c ON c.id = cs.competition_id
      JOIN seasons s ON s.id = cs.season_id
      WHERE s.is_current = true
    `,
  ]);

  const playerSlugMap = new Map<string, { id: string; name: string }>();
  for (const p of allPlayers as Array<{ id: string; name: string; slug: string }>) {
    playerSlugMap.set(p.slug, { id: p.id, name: p.name });
  }

  const teamSlugMap = new Map<string, { id: string; name: string }>();
  const teamNameSlugMap = new Map<string, { id: string; name: string }>();
  for (const t of allTeams as Array<{ id: string; name: string; short_name: string | null; slug: string }>) {
    teamSlugMap.set(t.slug, { id: t.id, name: t.name });
    teamNameSlugMap.set(slugify(t.name), { id: t.id, name: t.name });
    if (t.short_name) teamNameSlugMap.set(slugify(t.short_name), { id: t.id, name: t.name });
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
      const playerSlug = slugify(scorer.player.name);
      const dbPlayer = playerSlugMap.get(playerSlug);
      if (!dbPlayer) {
        missingPlayer++;
        continue;
      }

      // First try the pre-loaded in-memory slug maps (fast path for the
      // common case), then fall back to the shared findTeamByName matcher
      // which handles year suffixes, punctuation, diacritics, and aliases.
      const teamSlug = slugify(scorer.team.name);
      const teamShortSlug = slugify(scorer.team.shortName);
      let dbTeam:
        | { id: string; name?: string; slug?: string }
        | undefined =
        teamSlugMap.get(teamSlug) ||
        teamSlugMap.get(teamShortSlug) ||
        teamNameSlugMap.get(teamSlug) ||
        teamNameSlugMap.get(teamShortSlug);
      if (!dbTeam) {
        const hit = await findTeamByName(sql, scorer.team.name);
        if (hit) dbTeam = { id: hit.id, slug: hit.slug };
      }
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
