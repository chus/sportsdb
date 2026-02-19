/**
 * Fetch standings from TheSportsDB for leagues not covered by football-data.org
 *
 * TheSportsDB API is free and covers South American leagues
 *
 * Usage: npx tsx scripts/fetch-thesportsdb-standings.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// TheSportsDB league IDs mapped to our slugs
const LEAGUE_MAP: Record<string, { id: string; season: string }> = {
  "brasileirao-serie-a": { id: "4351", season: "2025" },
  "liga-profesional-argentina": { id: "4406", season: "2026" }, // Argentine uses calendar year
  "liga-mx": { id: "4350", season: "2024-2025" },
  "mls": { id: "4346", season: "2025" },
  "eredivisie": { id: "4337", season: "2024-2025" },
  "primeira-liga": { id: "4344", season: "2024-2025" }, // Portuguese league
};

interface TheSportsDBStanding {
  idStanding: string;
  intRank: string;
  idTeam: string;
  strTeam: string;
  strBadge: string;
  intPlayed: string;
  intWin: string;
  intLoss: string;
  intDraw: string;
  intGoalsFor: string;
  intGoalsAgainst: string;
  intGoalDifference: string;
  intPoints: string;
  strForm: string;
}

async function fetchStandings(leagueId: string, season: string): Promise<TheSportsDBStanding[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=${leagueId}&s=${season}`;
  console.log(`  Fetching: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  Failed to fetch: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.table || [];
}

async function getTeamByName(name: string): Promise<{ id: string; slug: string } | null> {
  // Normalize team names
  const normalizedName = name
    .replace(/\s+(FC|CF|SC|AC|AS|SS|US|Calcio)$/i, "")
    .replace(/^(FC|CF|SC|AC|AS|SS|US)\s+/i, "")
    .trim();

  // Try exact match first
  const exact = await sql`
    SELECT id, slug FROM teams
    WHERE name = ${name} OR short_name = ${name}
    LIMIT 1
  `;
  if (exact.length > 0) return exact[0];

  // Try normalized match
  const normalized = await sql`
    SELECT id, slug FROM teams
    WHERE name ILIKE ${`%${normalizedName}%`} OR short_name ILIKE ${`%${normalizedName}%`}
    LIMIT 1
  `;
  if (normalized.length > 0) return normalized[0];

  return null;
}

async function ensureTeamExists(standing: TheSportsDBStanding, country: string): Promise<string | null> {
  // First try to find existing team
  let team = await getTeamByName(standing.strTeam);

  if (team) {
    // Update logo if we have one from TheSportsDB
    if (standing.strBadge) {
      await sql`
        UPDATE teams SET logo_url = ${standing.strBadge.replace('/tiny', '')}
        WHERE id = ${team.id} AND logo_url IS NULL
      `;
    }
    return team.id;
  }

  // Create new team
  const slug = standing.strTeam
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const result = await sql`
    INSERT INTO teams (name, slug, country, logo_url)
    VALUES (${standing.strTeam}, ${slug}, ${country}, ${standing.strBadge?.replace('/tiny', '') || null})
    ON CONFLICT (slug) DO UPDATE SET logo_url = COALESCE(teams.logo_url, EXCLUDED.logo_url)
    RETURNING id
  `;

  // Add to search index
  await sql`
    INSERT INTO search_index (id, entity_type, slug, name, subtitle, meta)
    VALUES (${result[0].id}, 'team', ${slug}, ${standing.strTeam}, ${country}, null)
    ON CONFLICT (id) DO NOTHING
  `;

  console.log(`    Created team: ${standing.strTeam}`);
  return result[0].id;
}

async function main() {
  console.log("=== Fetching TheSportsDB Standings ===\n");

  for (const [slug, config] of Object.entries(LEAGUE_MAP)) {
    console.log(`\nProcessing ${slug}...`);

    // Get competition and current season
    const comp = await sql`
      SELECT c.id, c.country, cs.id as competition_season_id
      FROM competitions c
      JOIN competition_seasons cs ON cs.competition_id = c.id
      JOIN seasons s ON s.id = cs.season_id
      WHERE c.slug = ${slug} AND s.is_current = true
      LIMIT 1
    `;

    if (comp.length === 0) {
      console.log(`  Competition ${slug} not found or no current season`);
      continue;
    }

    const competitionSeasonId = comp[0].competition_season_id;
    const country = comp[0].country;
    console.log(`  Competition season ID: ${competitionSeasonId}, Country: ${country}`);

    // Fetch standings from API
    const standings = await fetchStandings(config.id, config.season);
    console.log(`  Fetched ${standings.length} teams`);

    if (standings.length === 0) {
      console.log(`  No standings data available`);
      continue;
    }

    let inserted = 0;
    let created = 0;

    for (const entry of standings) {
      const teamId = await ensureTeamExists(entry, country);

      if (!teamId) {
        console.log(`  Could not find/create team: ${entry.strTeam}`);
        continue;
      }

      // Upsert standing
      await sql`
        INSERT INTO standings (
          competition_season_id, team_id, position, played, won, drawn, lost,
          goals_for, goals_against, goal_difference, points, form
        )
        VALUES (
          ${competitionSeasonId}, ${teamId}, ${parseInt(entry.intRank)}, ${parseInt(entry.intPlayed)},
          ${parseInt(entry.intWin)}, ${parseInt(entry.intDraw)}, ${parseInt(entry.intLoss)},
          ${parseInt(entry.intGoalsFor)}, ${parseInt(entry.intGoalsAgainst)}, ${parseInt(entry.intGoalDifference)},
          ${parseInt(entry.intPoints)}, ${entry.strForm || null}
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
      inserted++;
    }

    console.log(`  Inserted: ${inserted} standings`);

    // Small delay to be nice to the API
    await new Promise(r => setTimeout(r, 1000));
  }

  // Show final counts
  const counts = await sql`
    SELECT c.name, COUNT(s.id) as standings
    FROM competitions c
    JOIN competition_seasons cs ON cs.competition_id = c.id
    JOIN standings s ON s.competition_season_id = cs.id
    GROUP BY c.name
    ORDER BY standings DESC
  `;
  console.log("\nStandings per competition:");
  counts.forEach((c: { name: string; standings: number }) => console.log(`  ${c.name}: ${c.standings}`));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
