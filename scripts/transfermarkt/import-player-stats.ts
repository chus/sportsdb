/**
 * Import player season stats from Transfermarkt appearances.csv
 *
 * Aggregates match-level appearances into season stats for all matched players.
 *
 * Usage:
 *   npx tsx scripts/transfermarkt/import-player-stats.ts
 *   npx tsx scripts/transfermarkt/import-player-stats.ts --dry-run
 */

import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

interface Appearance {
  player_id: string;
  player_club_id: string;
  date: string;
  goals: string;
  assists: string;
  minutes_played: string;
  yellow_cards: string;
  red_cards: string;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter(Boolean);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] || ""));
    return row;
  });
}

function getSeason(dateStr: string): string {
  // Date format: YYYY-MM-DD
  const [year, month] = dateStr.split("-").map(Number);
  // Football season spans two years (Aug-May)
  // If month is Aug-Dec, season is current/next year
  // If month is Jan-Jul, season is prev/current year
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

interface SeasonStats {
  playerId: number;
  teamTmId: number;
  season: string;
  appearances: number;
  goals: number;
  assists: number;
  minutes: number;
  yellowCards: number;
  redCards: number;
}

async function main() {
  console.log(`\nImport Player Stats from Transfermarkt${dryRun ? " (DRY RUN)" : ""}\n`);

  // Load appearances CSV
  console.log("Loading appearances.csv...");
  const csv = readFileSync("data/transfermarkt/appearances.csv", "utf-8");
  const appearances = parseCsv(csv) as unknown as Appearance[];
  console.log(`  Loaded ${appearances.length} appearances\n`);

  // Aggregate by player + team + season
  console.log("Aggregating stats by player/team/season...");
  const statsMap = new Map<string, SeasonStats>();

  for (const app of appearances) {
    const playerId = parseInt(app.player_id);
    const teamTmId = parseInt(app.player_club_id);
    const season = getSeason(app.date);
    const key = `${playerId}-${teamTmId}-${season}`;

    let stats = statsMap.get(key);
    if (!stats) {
      stats = {
        playerId,
        teamTmId,
        season,
        appearances: 0,
        goals: 0,
        assists: 0,
        minutes: 0,
        yellowCards: 0,
        redCards: 0,
      };
      statsMap.set(key, stats);
    }

    stats.appearances++;
    stats.goals += parseInt(app.goals) || 0;
    stats.assists += parseInt(app.assists) || 0;
    stats.minutes += parseInt(app.minutes_played) || 0;
    stats.yellowCards += parseInt(app.yellow_cards) || 0;
    stats.redCards += parseInt(app.red_cards) || 0;
  }

  console.log(`  Aggregated into ${statsMap.size} player-season entries\n`);

  // Get players with transfermarkt_id
  console.log("Loading matched players from database...");
  const players = await sql`
    SELECT id, transfermarkt_id FROM players WHERE transfermarkt_id IS NOT NULL
  `;
  const playerByTmId = new Map<number, string>();
  for (const p of players) {
    playerByTmId.set(p.transfermarkt_id, p.id);
  }
  console.log(`  ${players.length} players with TM ID\n`);

  // Get teams with transfermarkt_id
  console.log("Loading matched teams from database...");
  const teams = await sql`
    SELECT id, transfermarkt_id FROM teams WHERE transfermarkt_id IS NOT NULL
  `;
  const teamByTmId = new Map<number, string>();
  for (const t of teams) {
    teamByTmId.set(t.transfermarkt_id, t.id);
  }
  console.log(`  ${teams.length} teams with TM ID\n`);

  // Get competition seasons
  console.log("Loading competition seasons...");
  const compSeasons = await sql`
    SELECT cs.id, s.label as season_label
    FROM competition_seasons cs
    JOIN seasons s ON s.id = cs.season_id
  `;
  // Build map: season label (e.g., "2024/25") → first competition_season_id
  // Also support "2024-25" format
  const seasonToCompSeasonId = new Map<string, string>();
  for (const cs of compSeasons) {
    const seasonLabel = cs.season_label; // e.g., "2024/25"
    if (!seasonToCompSeasonId.has(seasonLabel)) {
      seasonToCompSeasonId.set(seasonLabel, cs.id);
    }
    // Also map with dash format
    const dashFormat = seasonLabel.replace("/", "-");
    if (!seasonToCompSeasonId.has(dashFormat)) {
      seasonToCompSeasonId.set(dashFormat, cs.id);
    }
  }
  console.log(`  ${compSeasons.length} competition seasons\n`);

  // Insert stats
  console.log("Inserting player season stats...");
  let inserted = 0;
  let skippedNoPlayer = 0;
  let skippedNoTeam = 0;
  let skippedNoSeason = 0;

  const allStats = Array.from(statsMap.values());

  // Process in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < allStats.length; i += BATCH_SIZE) {
    const batch = allStats.slice(i, i + BATCH_SIZE);

    for (const stats of batch) {
      const dbPlayerId = playerByTmId.get(stats.playerId);
      if (!dbPlayerId) {
        skippedNoPlayer++;
        continue;
      }

      const dbTeamId = teamByTmId.get(stats.teamTmId);
      if (!dbTeamId) {
        skippedNoTeam++;
        continue;
      }

      // Convert season format: "2024-2025" → "2024-25" and "2024/25"
      const seasonDash = stats.season.replace(/(\d{4})-(\d{4})/, (_, y1, y2) =>
        `${y1}-${y2.slice(2)}`
      );
      const seasonSlash = stats.season.replace(/(\d{4})-(\d{4})/, (_, y1, y2) =>
        `${y1}/${y2.slice(2)}`
      );
      const compSeasonId = seasonToCompSeasonId.get(seasonDash) || seasonToCompSeasonId.get(seasonSlash);
      if (!compSeasonId) {
        skippedNoSeason++;
        continue;
      }

      if (!dryRun) {
        await sql`
          INSERT INTO player_season_stats (
            player_id, team_id, competition_season_id,
            appearances, goals, assists, minutes_played,
            yellow_cards, red_cards, clean_sheets,
            updated_at
          ) VALUES (
            ${dbPlayerId}, ${dbTeamId}, ${compSeasonId},
            ${stats.appearances}, ${stats.goals}, ${stats.assists}, ${stats.minutes},
            ${stats.yellowCards}, ${stats.redCards}, 0,
            NOW()
          )
          ON CONFLICT (player_id, team_id, competition_season_id)
          DO UPDATE SET
            appearances = GREATEST(player_season_stats.appearances, EXCLUDED.appearances),
            goals = GREATEST(player_season_stats.goals, EXCLUDED.goals),
            assists = GREATEST(player_season_stats.assists, EXCLUDED.assists),
            minutes_played = GREATEST(player_season_stats.minutes_played, EXCLUDED.minutes_played),
            yellow_cards = GREATEST(player_season_stats.yellow_cards, EXCLUDED.yellow_cards),
            red_cards = GREATEST(player_season_stats.red_cards, EXCLUDED.red_cards),
            updated_at = NOW()
        `;
      }
      inserted++;
    }

    if ((i + BATCH_SIZE) % 10000 === 0 || i + BATCH_SIZE >= allStats.length) {
      console.log(`  Processed ${Math.min(i + BATCH_SIZE, allStats.length)}/${allStats.length}...`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Inserted/Updated: ${inserted}`);
  console.log(`Skipped (no player match): ${skippedNoPlayer}`);
  console.log(`Skipped (no team match): ${skippedNoTeam}`);
  console.log(`Skipped (no season match): ${skippedNoSeason}`);

  if (!dryRun) {
    const [count] = await sql`SELECT count(*) FROM player_season_stats`;
    console.log(`\nTotal rows in player_season_stats: ${count.count}`);
  }

  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
