/**
 * Backfill match_events and match_lineups from API-Football
 *
 * Fetches events + lineups for finished matches that have af- externalIds.
 * Each fixture costs 1 API request. Progress is saved to resume across runs.
 *
 * Usage:
 *   npx tsx scripts/backfill-match-events.ts --limit=50
 *   npx tsx scripts/backfill-match-events.ts --limit=95 --reset  (start over)
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";
const DATABASE_URL = process.env.DATABASE_URL;

if (!API_KEY || !DATABASE_URL) {
  console.error("Missing API_FOOTBALL_KEY or DATABASE_URL in .env.local");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// --- CLI flags ---
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1]) : 50;
const RESET = args.includes("--reset");

// --- Rate limiting ---
const MAX_REQUESTS = 95;
let requestCount = 0;
const RATE_LIMIT_MS = 6500;
let lastRequestTime = 0;

async function apiFetch(endpoint: string): Promise<any> {
  if (requestCount >= MAX_REQUESTS) {
    throw new Error("Daily request budget exhausted");
  }

  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  lastRequestTime = Date.now();
  requestCount++;

  const url = `${BASE_URL}${endpoint}`;
  console.log(`  [${requestCount}/${MAX_REQUESTS}] GET ${endpoint}`);

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": API_KEY!,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();

  if (data.errors?.requests?.includes("request limit")) {
    console.error("  DAILY LIMIT REACHED");
    requestCount = MAX_REQUESTS;
    return { response: [] };
  }

  return data;
}

// --- Progress tracking ---
const PROGRESS_FILE = join(process.cwd(), "data", ".backfill-events-progress.json");

function loadProgress(): Set<string> {
  if (RESET || !existsSync(PROGRESS_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    return new Set(data.processed || []);
  } catch {
    return new Set();
  }
}

function saveProgress(processed: Set<string>) {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) {
    const { mkdirSync } = require("fs");
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ processed: [...processed], lastRun: new Date().toISOString() })
  );
}

// --- Player lookup ---
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function findPlayerId(
  apiPlayerId: number,
  playerName: string,
  teamId: string,
  playerCache: Map<string, string | null>
): Promise<string | null> {
  // 1. Check af- externalId
  const afKey = `af-${apiPlayerId}`;
  if (playerCache.has(afKey)) return playerCache.get(afKey)!;

  const [byExt] = await sql`SELECT id FROM players WHERE external_id = ${afKey} LIMIT 1`;
  if (byExt) {
    playerCache.set(afKey, byExt.id);
    return byExt.id;
  }

  // 2. Match by name within the team's current squad
  const nameSlug = slugify(playerName);
  const nameKey = `name-${nameSlug}-${teamId}`;
  if (playerCache.has(nameKey)) return playerCache.get(nameKey)!;

  // Try exact slug match first
  const [bySlug] = await sql`
    SELECT p.id FROM players p
    JOIN player_team_history pth ON pth.player_id = p.id
    WHERE p.slug = ${nameSlug} AND pth.team_id = ${teamId}
    LIMIT 1
  `;
  if (bySlug) {
    playerCache.set(nameKey, bySlug.id);
    playerCache.set(afKey, bySlug.id);
    return bySlug.id;
  }

  // Try name ILIKE
  const [byName] = await sql`
    SELECT p.id FROM players p
    JOIN player_team_history pth ON pth.player_id = p.id
    WHERE p.name ILIKE ${playerName} AND pth.team_id = ${teamId}
    LIMIT 1
  `;
  if (byName) {
    playerCache.set(nameKey, byName.id);
    playerCache.set(afKey, byName.id);
    return byName.id;
  }

  // Try broader name match (without team constraint)
  const [byNameGlobal] = await sql`
    SELECT id FROM players WHERE name ILIKE ${playerName} LIMIT 1
  `;
  if (byNameGlobal) {
    playerCache.set(nameKey, byNameGlobal.id);
    playerCache.set(afKey, byNameGlobal.id);
    return byNameGlobal.id;
  }

  playerCache.set(nameKey, null);
  playerCache.set(afKey, null);
  return null;
}

// --- Event type mapping ---
function mapEventType(type: string, detail: string): string | null {
  if (type === "Goal") {
    if (detail === "Own Goal") return "own_goal";
    if (detail === "Missed Penalty") return "penalty_missed";
    return "goal"; // Normal Goal, Penalty
  }
  if (type === "Card") {
    if (detail === "Yellow Card") return "yellow_card";
    return "red_card"; // Red Card, Second Yellow card
  }
  if (type === "subst") return "substitution";
  return null; // Skip Var and other types
}

// --- Main ---
async function main() {
  console.log("Backfill Match Events & Lineups");
  console.log("=".repeat(50));
  console.log(`Limit: ${LIMIT} matches per run`);

  const processed = loadProgress();
  console.log(`Already processed: ${processed.size} matches`);

  // Load team lookup
  const allTeams = await sql`SELECT id, external_id, slug, name FROM teams`;
  const teamByAfId = new Map<string, { id: string; slug: string }>();
  const teamBySlug = new Map<string, string>();
  for (const t of allTeams) {
    if (t.external_id?.startsWith("af-")) {
      teamByAfId.set(t.external_id, { id: t.id, slug: t.slug });
    }
    teamBySlug.set(t.slug, t.id);
  }

  // Get unprocessed af- matches
  const matches = await sql`
    SELECT id, external_id, home_team_id, away_team_id
    FROM matches
    WHERE external_id LIKE 'af-%'
      AND status = 'finished'
    ORDER BY scheduled_at DESC
  `;

  const unprocessed = matches.filter((m) => !processed.has(m.id));
  const batch = unprocessed.slice(0, LIMIT);
  console.log(`\nFound ${matches.length} AF finished matches, ${unprocessed.length} remaining, processing ${batch.length}`);

  const playerCache = new Map<string, string | null>();
  let eventsInserted = 0;
  let lineupsInserted = 0;
  let matchesProcessed = 0;
  let matchesFailed = 0;

  for (const match of batch) {
    const fixtureId = match.external_id.replace("af-", "");
    console.log(`\nMatch ${match.id} (fixture ${fixtureId})`);

    try {
      // Fetch events
      const eventsData = await apiFetch(`/fixtures/events?fixture=${fixtureId}`);
      const events = eventsData.response || [];

      for (const evt of events) {
        const eventType = mapEventType(evt.type, evt.detail);
        if (!eventType) continue;

        const teamAfId = `af-${evt.team?.id}`;
        const teamInfo = teamByAfId.get(teamAfId);
        const teamId = teamInfo?.id || match.home_team_id; // fallback

        const playerId = evt.player?.id
          ? await findPlayerId(evt.player.id, evt.player.name || "", teamId, playerCache)
          : null;

        let secondaryPlayerId: string | null = null;
        if (evt.assist?.id) {
          secondaryPlayerId = await findPlayerId(
            evt.assist.id,
            evt.assist.name || "",
            teamId,
            playerCache
          );
        }

        const description =
          eventType === "substitution"
            ? `${evt.player?.name || "?"} → ${evt.assist?.name || "?"}`
            : evt.detail || null;

        await sql`
          INSERT INTO match_events (match_id, type, minute, added_time, team_id, player_id, secondary_player_id, description)
          VALUES (${match.id}, ${eventType}, ${evt.time?.elapsed || 0}, ${evt.time?.extra || null},
                  ${teamId}, ${playerId}, ${secondaryPlayerId}, ${description})
          ON CONFLICT DO NOTHING
        `;
        eventsInserted++;
      }

      // Fetch lineups
      const lineupsData = await apiFetch(`/fixtures/lineups?fixture=${fixtureId}`);
      const lineups = lineupsData.response || [];

      for (const teamLineup of lineups) {
        const teamAfId = `af-${teamLineup.team?.id}`;
        const teamInfo = teamByAfId.get(teamAfId);
        const teamId = teamInfo?.id || match.home_team_id;

        const posMap: Record<string, string> = { G: "Goalkeeper", D: "Defender", M: "Midfielder", F: "Forward" };

        // Starters
        for (const entry of teamLineup.startXI || []) {
          const p = entry.player;
          if (!p?.id) continue;

          const playerId = await findPlayerId(p.id, p.name || "", teamId, playerCache);
          if (!playerId) continue;

          await sql`
            INSERT INTO match_lineups (match_id, team_id, player_id, shirt_number, position, is_starter)
            VALUES (${match.id}, ${teamId}, ${playerId}, ${p.number || null}, ${posMap[p.pos] || p.pos || null}, true)
            ON CONFLICT DO NOTHING
          `;
          lineupsInserted++;
        }

        // Substitutes
        for (const entry of teamLineup.substitutes || []) {
          const p = entry.player;
          if (!p?.id) continue;

          const playerId = await findPlayerId(p.id, p.name || "", teamId, playerCache);
          if (!playerId) continue;

          await sql`
            INSERT INTO match_lineups (match_id, team_id, player_id, shirt_number, position, is_starter)
            VALUES (${match.id}, ${teamId}, ${playerId}, ${p.number || null}, ${posMap[p.pos] || p.pos || null}, false)
            ON CONFLICT DO NOTHING
          `;
          lineupsInserted++;
        }
      }

      processed.add(match.id);
      matchesProcessed++;
      console.log(`  ✓ ${events.length} events, ${lineups.length > 0 ? "lineups" : "no lineups"}`);
    } catch (err: any) {
      if (err.message.includes("budget exhausted")) {
        console.log("\nBudget exhausted — saving progress and stopping");
        break;
      }
      console.log(`  ✗ ${err.message}`);
      matchesFailed++;
      processed.add(match.id); // skip on next run
    }
  }

  saveProgress(processed);

  console.log("\n" + "=".repeat(50));
  console.log(`Matches processed: ${matchesProcessed}`);
  console.log(`Matches failed: ${matchesFailed}`);
  console.log(`Events inserted: ${eventsInserted}`);
  console.log(`Lineups inserted: ${lineupsInserted}`);
  console.log(`Total processed (all runs): ${processed.size}`);
  console.log(`Remaining: ${matches.length - processed.size}`);
  console.log(`API requests used: ${requestCount}/${MAX_REQUESTS}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
