/**
 * Fetch match data from football-data.org API
 *
 * Free tier: 10 requests/minute
 * Get API key at: https://www.football-data.org/client/register
 *
 * Usage:
 *   FOOTBALL_DATA_API_KEY=xxx npx tsx scripts/fetch-matches.ts
 *   FOOTBALL_DATA_API_KEY=xxx npx tsx scripts/fetch-matches.ts --league=PL
 *   FOOTBALL_DATA_API_KEY=xxx npx tsx scripts/fetch-matches.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!API_KEY) {
  console.error("FOOTBALL_DATA_API_KEY environment variable is required");
  console.error("Get a free API key at: https://www.football-data.org/client/register");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Football-data.org league codes to our slugs
const LEAGUE_MAPPING: Record<string, { code: string; slug: string; country: string }> = {
  PL: { code: "PL", slug: "premier-league", country: "England" },
  PD: { code: "PD", slug: "la-liga", country: "Spain" },
  BL1: { code: "BL1", slug: "bundesliga", country: "Germany" },
  SA: { code: "SA", slug: "serie-a", country: "Italy" },
  FL1: { code: "FL1", slug: "ligue-1", country: "France" },
  // CL: { code: "CL", slug: "champions-league", country: "Europe" },
};

interface Match {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: { id: number; name: string; shortName: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; crest: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  venue: string | null;
  referees: { name: string }[];
}

interface ApiResponse {
  competition: { id: number; name: string; code: string };
  matches: Match[];
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMatches(leagueCode: string): Promise<ApiResponse | null> {
  const url = `https://api.football-data.org/v4/competitions/${leagueCode}/matches`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": API_KEY!,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log("Rate limited, waiting 60 seconds...");
        await delay(60000);
        return fetchMatches(leagueCode);
      }
      console.error(`Error fetching ${leagueCode}: ${response.status} ${response.statusText}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error(`Error fetching ${leagueCode}:`, error);
    return null;
  }
}

function mapStatus(apiStatus: string): string {
  const statusMap: Record<string, string> = {
    SCHEDULED: "scheduled",
    TIMED: "scheduled",
    IN_PLAY: "live",
    PAUSED: "half_time",
    FINISHED: "finished",
    SUSPENDED: "suspended",
    POSTPONED: "postponed",
    CANCELLED: "cancelled",
    AWARDED: "finished",
  };
  return statusMap[apiStatus] || "scheduled";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getOrCreateTeam(
  team: Match["homeTeam"],
  country: string,
  dryRun: boolean
): Promise<string | null> {
  const slug = slugify(team.name);

  // Check if team exists
  const existing = await sql`SELECT id FROM teams WHERE slug = ${slug}`;

  if (existing.length > 0) {
    // Update logo if we have one and they don't
    if (team.crest && !dryRun) {
      await sql`
        UPDATE teams SET logo_url = ${team.crest}
        WHERE slug = ${slug} AND logo_url IS NULL
      `;
    }
    return existing[0].id;
  }

  if (dryRun) {
    console.log(`  [DRY-RUN] Would create team: ${team.name}`);
    return null;
  }

  // Create team
  const result = await sql`
    INSERT INTO teams (name, short_name, slug, country, logo_url)
    VALUES (${team.name}, ${team.shortName}, ${slug}, ${country}, ${team.crest})
    RETURNING id
  `;

  console.log(`  Created team: ${team.name}`);
  return result[0].id;
}

async function getCompetitionSeasonId(
  competitionSlug: string,
  seasonLabel: string
): Promise<string | null> {
  const result = await sql`
    SELECT cs.id FROM competition_seasons cs
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE c.slug = ${competitionSlug}
    AND s.label = ${seasonLabel}
  `;

  if (result.length === 0) {
    // Try to create season and competition_season
    const seasonResult = await sql`
      SELECT id FROM seasons WHERE label = ${seasonLabel}
    `;

    if (seasonResult.length === 0) {
      console.log(`  Season ${seasonLabel} not found, skipping...`);
      return null;
    }

    const compResult = await sql`
      SELECT id FROM competitions WHERE slug = ${competitionSlug}
    `;

    if (compResult.length === 0) {
      console.log(`  Competition ${competitionSlug} not found, skipping...`);
      return null;
    }

    // Create competition_season
    const csResult = await sql`
      INSERT INTO competition_seasons (competition_id, season_id)
      VALUES (${compResult[0].id}, ${seasonResult[0].id})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    if (csResult.length > 0) {
      return csResult[0].id;
    }

    // Try to fetch again
    const retry = await sql`
      SELECT cs.id FROM competition_seasons cs
      JOIN competitions c ON c.id = cs.competition_id
      JOIN seasons s ON s.id = cs.season_id
      WHERE c.slug = ${competitionSlug}
      AND s.label = ${seasonLabel}
    `;
    return retry.length > 0 ? retry[0].id : null;
  }

  return result[0].id;
}

async function processMatches(dryRun: boolean, specificLeague?: string) {
  const leagues = specificLeague
    ? { [specificLeague]: LEAGUE_MAPPING[specificLeague] }
    : LEAGUE_MAPPING;

  if (specificLeague && !LEAGUE_MAPPING[specificLeague]) {
    console.error(`Unknown league code: ${specificLeague}`);
    console.error("Available leagues:", Object.keys(LEAGUE_MAPPING).join(", "));
    process.exit(1);
  }

  let totalMatches = 0;
  let insertedMatches = 0;

  for (const [code, league] of Object.entries(leagues)) {
    console.log(`\nFetching ${league.slug} (${code})...`);

    const data = await fetchMatches(code);
    if (!data) continue;

    console.log(`  Found ${data.matches.length} matches`);
    totalMatches += data.matches.length;

    // Group matches by season (based on year)
    const matchesBySeason = new Map<string, Match[]>();

    for (const match of data.matches) {
      const matchDate = new Date(match.utcDate);
      const year = matchDate.getFullYear();
      const month = matchDate.getMonth();

      // Football seasons span two years (Aug-May)
      // If month is Aug-Dec, season is YYYY/YYYY+1
      // If month is Jan-Jul, season is YYYY-1/YYYY
      const seasonYear = month >= 7 ? year : year - 1;
      const seasonLabel = `${seasonYear}/${seasonYear + 1}`;

      if (!matchesBySeason.has(seasonLabel)) {
        matchesBySeason.set(seasonLabel, []);
      }
      matchesBySeason.get(seasonLabel)!.push(match);
    }

    for (const [seasonLabel, matches] of matchesBySeason) {
      console.log(`  Processing ${matches.length} matches for ${seasonLabel}...`);

      const competitionSeasonId = await getCompetitionSeasonId(league.slug, seasonLabel);
      if (!competitionSeasonId) {
        console.log(`  Skipping season ${seasonLabel} - not found`);
        continue;
      }

      for (const match of matches) {
        // Get or create teams
        const homeTeamId = await getOrCreateTeam(match.homeTeam, league.country, dryRun);
        const awayTeamId = await getOrCreateTeam(match.awayTeam, league.country, dryRun);

        if (!homeTeamId || !awayTeamId) {
          if (dryRun) {
            console.log(`  [DRY-RUN] Would insert match: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          }
          continue;
        }

        if (dryRun) {
          console.log(`  [DRY-RUN] Would insert: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          insertedMatches++;
          continue;
        }

        // Insert match
        try {
          await sql`
            INSERT INTO matches (
              competition_season_id,
              home_team_id,
              away_team_id,
              scheduled_at,
              status,
              home_score,
              away_score,
              matchday,
              referee,
              external_id
            ) VALUES (
              ${competitionSeasonId},
              ${homeTeamId},
              ${awayTeamId},
              ${match.utcDate},
              ${mapStatus(match.status)},
              ${match.score.fullTime.home},
              ${match.score.fullTime.away},
              ${match.matchday},
              ${match.referees?.[0]?.name || null},
              ${"fd-" + match.id}
            )
            ON CONFLICT (external_id) DO UPDATE SET
              status = EXCLUDED.status,
              home_score = EXCLUDED.home_score,
              away_score = EXCLUDED.away_score
          `;
          insertedMatches++;
        } catch (error: any) {
          if (!error.message?.includes("duplicate")) {
            console.error(`  Error inserting match:`, error.message);
          }
        }
      }
    }

    // Rate limiting: 10 requests per minute
    console.log("  Waiting 7 seconds (rate limit)...");
    await delay(7000);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total matches found: ${totalMatches}`);
  console.log(`Matches ${dryRun ? "would be" : ""} inserted/updated: ${insertedMatches}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const leagueArg = args.find((a) => a.startsWith("--league="));
const specificLeague = leagueArg?.split("=")[1];

console.log("=== Match Data Fetcher ===");
console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
if (specificLeague) {
  console.log(`League: ${specificLeague}`);
}

processMatches(dryRun, specificLeague).then(() => {
  console.log("\nDone!");
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
