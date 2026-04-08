/**
 * Fetch Player Season Stats
 *
 * Fetches top scorers from football-data.org for each competition and
 * populates the player_season_stats table with goals, assists, appearances.
 *
 * Usage:
 *   FOOTBALL_DATA_API_KEY=xxx npx tsx scripts/fetch-player-stats.ts
 *   FOOTBALL_DATA_API_KEY=xxx npx tsx scripts/fetch-player-stats.ts --dry-run
 *   FOOTBALL_DATA_API_KEY=xxx npx tsx scripts/fetch-player-stats.ts --league=PL
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

if (!API_KEY) {
  console.error("FOOTBALL_DATA_API_KEY environment variable is required");
  console.error("Usage: FOOTBALL_DATA_API_KEY=xxx npx tsx scripts/fetch-player-stats.ts");
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const DRY_RUN = process.argv.includes("--dry-run");
const LEAGUE_FLAG = process.argv.find((a) => a.startsWith("--league="));
const SINGLE_LEAGUE = LEAGUE_FLAG ? LEAGUE_FLAG.split("=")[1] : null;

const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

// football-data.org code → DB competition slug mapping
const COMPETITION_MAP: Record<string, string[]> = {
  PL: ["premier-league"],
  PD: ["primera-division", "la-liga"],
  BL1: ["bundesliga"],
  SA: ["serie-a"],
  FL1: ["ligue-1"],
  CL: ["uefa-champions-league", "champions-league"],
  ELC: ["championship"],
  DED: ["eredivisie"],
  PPL: ["primeira-liga"],
  WC: ["fifa-world-cup-2026", "world-cup"],
  EC: ["european-championship"],
};

const COMPETITIONS = SINGLE_LEAGUE
  ? [SINGLE_LEAGUE]
  : Object.keys(COMPETITION_MAP);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSince = now - lastRequestTime;
  if (timeSince < RATE_LIMIT_MS) {
    const wait = RATE_LIMIT_MS - timeSince;
    console.log(`  Rate limit: waiting ${Math.round(wait / 1000)}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  const res = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY! },
  });

  if (res.status === 429) {
    console.log("  Rate limited by API! Waiting 60s...");
    await new Promise((r) => setTimeout(r, 60000));
    return rateLimitedFetch(url);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }

  return res.json();
}

interface ApiScorer {
  player: {
    id: number;
    name: string;
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    position: string | null;
  };
  team: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  playedMatches: number;
  goals: number;
  assists: number | null;
  penalties: number | null;
}

interface ScorersResponse {
  competition: { id: number; name: string; code: string };
  season: { id: number; startDate: string; endDate: string };
  scorers: ApiScorer[];
}

async function main() {
  console.log("=== Fetch Player Season Stats ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (SINGLE_LEAGUE) console.log(`League filter: ${SINGLE_LEAGUE}`);
  console.log();

  // ---- Pre-load DB data ----

  console.log("Loading players from database...");
  const allPlayers = await sql`
    SELECT id, name, slug FROM players
  `;
  const playerSlugMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const p of allPlayers) {
    playerSlugMap.set(p.slug, p as any);
  }
  console.log(`  ${allPlayers.length} players loaded`);

  console.log("Loading teams from database...");
  const allTeams = await sql`
    SELECT id, name, short_name, slug FROM teams
  `;
  const teamSlugMap = new Map<string, { id: string; name: string; slug: string }>();
  const teamNameSlugMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const t of allTeams) {
    teamSlugMap.set(t.slug, t as any);
    // Also index by slugified name and short_name for fuzzy matching
    teamNameSlugMap.set(slugify(t.name), t as any);
    if (t.short_name) {
      teamNameSlugMap.set(slugify(t.short_name), t as any);
    }
  }
  console.log(`  ${allTeams.length} teams loaded`);

  console.log("Loading competition seasons...");
  const compSeasons = await sql`
    SELECT cs.id, c.slug as comp_slug
    FROM competition_seasons cs
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE s.is_current = true
  `;
  const compSeasonMap = new Map<string, string>();
  for (const cs of compSeasons) {
    compSeasonMap.set(cs.comp_slug, cs.id);
  }
  console.log(`  ${compSeasons.length} current competition seasons found`);
  console.log(`  Slugs: ${Array.from(compSeasonMap.keys()).join(", ")}`);
  console.log();

  // ---- Fetch and process ----

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkippedNoPlayer = 0;
  let totalSkippedNoTeam = 0;
  let totalSkippedNoCompSeason = 0;

  for (const compCode of COMPETITIONS) {
    console.log(`\n--- ${compCode} ---`);

    const possibleSlugs = COMPETITION_MAP[compCode];
    if (!possibleSlugs) {
      console.log(`  Unknown competition code: ${compCode}`);
      continue;
    }

    // Find competition_season_id
    let compSeasonId: string | undefined;
    for (const slug of possibleSlugs) {
      compSeasonId = compSeasonMap.get(slug);
      if (compSeasonId) break;
    }

    if (!compSeasonId) {
      console.log(`  No current season found for ${compCode} (tried: ${possibleSlugs.join(", ")})`);
      totalSkippedNoCompSeason++;
      continue;
    }
    console.log(`  Competition season ID: ${compSeasonId}`);

    // Fetch scorers
    let data: ScorersResponse;
    try {
      data = await rateLimitedFetch(
        `${BASE_URL}/competitions/${compCode}/scorers?limit=100`
      );
    } catch (err: any) {
      console.log(`  Skipping ${compCode}: ${err.message}`);
      continue;
    }

    if (!data.scorers || data.scorers.length === 0) {
      console.log(`  No scorers data for ${compCode}`);
      continue;
    }

    console.log(`  Fetched ${data.scorers.length} scorers`);

    for (const scorer of data.scorers) {
      // Match player
      const playerSlug = slugify(scorer.player.name);
      const dbPlayer = playerSlugMap.get(playerSlug);

      if (!dbPlayer) {
        totalSkippedNoPlayer++;
        continue;
      }

      // Match team
      const teamSlug = slugify(scorer.team.name);
      const teamShortSlug = slugify(scorer.team.shortName);
      const dbTeam =
        teamSlugMap.get(teamSlug) ||
        teamSlugMap.get(teamShortSlug) ||
        teamNameSlugMap.get(teamSlug) ||
        teamNameSlugMap.get(teamShortSlug);

      if (!dbTeam) {
        totalSkippedNoTeam++;
        continue;
      }

      const appearances = scorer.playedMatches || 0;
      const goals = scorer.goals || 0;
      const assists = scorer.assists || 0;

      if (DRY_RUN) {
        console.log(
          `  [DRY-RUN] ${dbPlayer.name} (${dbTeam.name}): ${goals}G ${assists}A ${appearances}apps`
        );
        totalInserted++;
      } else {
        // Upsert: insert or update on conflict
        const result = await sql`
          INSERT INTO player_season_stats (
            player_id, team_id, competition_season_id,
            appearances, goals, assists,
            yellow_cards, red_cards, minutes_played, clean_sheets,
            updated_at
          ) VALUES (
            ${dbPlayer.id}, ${dbTeam.id}, ${compSeasonId},
            ${appearances}, ${goals}, ${assists},
            0, 0, 0, 0,
            NOW()
          )
          ON CONFLICT (player_id, team_id, competition_season_id)
          DO UPDATE SET
            appearances = EXCLUDED.appearances,
            goals = EXCLUDED.goals,
            assists = EXCLUDED.assists,
            updated_at = NOW()
          RETURNING id
        `;
        if (result.length > 0) {
          totalInserted++;
        }
      }
    }

    console.log(`  Processed ${data.scorers.length} entries for ${compCode}`);
  }

  // ---- Summary ----

  console.log("\n=== Summary ===");
  console.log(`Stats upserted: ${totalInserted}`);
  console.log(`Skipped (player not found): ${totalSkippedNoPlayer}`);
  console.log(`Skipped (team not found): ${totalSkippedNoTeam}`);
  console.log(`Skipped (no competition season): ${totalSkippedNoCompSeason}`);

  if (!DRY_RUN) {
    const [count] = await sql`SELECT count(*) FROM player_season_stats`;
    console.log(`\nTotal rows in player_season_stats: ${count.count}`);

    // Show top 10 scorers
    const topScorers = await sql`
      SELECT p.name, t.name as team, pss.goals, pss.assists, pss.appearances
      FROM player_season_stats pss
      JOIN players p ON p.id = pss.player_id
      JOIN teams t ON t.id = pss.team_id
      ORDER BY pss.goals DESC
      LIMIT 10
    `;
    console.log("\nTop 10 Scorers:");
    topScorers.forEach((s, i) => {
      console.log(
        `  ${i + 1}. ${s.name} (${s.team}) - ${s.goals}G ${s.assists}A ${s.appearances}apps`
      );
    });
  }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
