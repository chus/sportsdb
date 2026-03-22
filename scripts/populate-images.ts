/**
 * Populate Images Script
 *
 * Batch-updates image URLs from the API-Football CDN for teams, competitions,
 * and players that have API-Football external IDs but are missing images.
 *
 * CDN pattern: https://media.api-sports.io/football/{type}/{id}.png
 *
 * Usage:
 *   npx tsx scripts/populate-images.ts --all                    # Update all entity types
 *   npx tsx scripts/populate-images.ts --teams                  # Teams only
 *   npx tsx scripts/populate-images.ts --competitions           # Competitions only
 *   npx tsx scripts/populate-images.ts --players                # Players only
 *   npx tsx scripts/populate-images.ts --all --validate         # HEAD-check each URL first
 *   npx tsx scripts/populate-images.ts --all --dry-run          # Preview without writing
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq, sql, and, isNull, like, or } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient, { schema });

const CDN_BASE = "https://media.api-sports.io/football";

// Competition slug → API-Football league ID mapping
const LEAGUE_MAP: Record<string, number> = {
  "liga-profesional-argentina": 128,
  "liga-mx": 262,
  "mls": 253,
  "brasileirao-serie-a": 71,
  "premier-league": 39,
  "la-liga": 140,
  "bundesliga": 78,
  "serie-a": 135,
  "ligue-1": 61,
  "eredivisie": 88,
  "primeira-liga": 94,
};

// ============================================================
// CLI ARGS
// ============================================================

const args = process.argv.slice(2);
const doTeams = args.includes("--teams") || args.includes("--all");
const doCompetitions = args.includes("--competitions") || args.includes("--all");
const doPlayers = args.includes("--players") || args.includes("--all");
const validate = args.includes("--validate");
const dryRun = args.includes("--dry-run");

if (!doTeams && !doCompetitions && !doPlayers) {
  console.log("Usage: npx tsx scripts/populate-images.ts [--teams] [--competitions] [--players] [--all] [--validate] [--dry-run]");
  process.exit(1);
}

// ============================================================
// HELPERS
// ============================================================

function extractAfId(externalId: string): number | null {
  if (!externalId.startsWith("af-")) return null;
  const num = parseInt(externalId.replace("af-", ""), 10);
  return isNaN(num) ? null : num;
}

async function validateUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function validateBatch(urls: { url: string; id: string }[]): Promise<Set<string>> {
  const validIds = new Set<string>();
  const BATCH_SIZE = 10;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ({ url, id }) => {
        const ok = await validateUrl(url);
        return { id, ok };
      })
    );
    for (const { id, ok } of results) {
      if (ok) validIds.add(id);
    }
  }

  return validIds;
}

// ============================================================
// POPULATE: TEAMS
// ============================================================

async function populateTeamLogos() {
  console.log("\n== Teams ==");

  const teams = await db
    .select({ id: schema.teams.id, name: schema.teams.name, externalId: schema.teams.externalId, logoUrl: schema.teams.logoUrl })
    .from(schema.teams)
    .where(
      and(
        like(schema.teams.externalId, "af-%"),
        or(isNull(schema.teams.logoUrl), eq(schema.teams.logoUrl, ""))
      )
    );

  console.log(`   Found ${teams.length} teams with af-* ID and no logo`);

  if (teams.length === 0) return;

  const updates: { id: string; name: string; url: string }[] = [];

  for (const team of teams) {
    const afIdNum = extractAfId(team.externalId!);
    if (!afIdNum) continue;
    updates.push({
      id: team.id,
      name: team.name,
      url: `${CDN_BASE}/teams/${afIdNum}.png`,
    });
  }

  if (validate) {
    console.log(`   Validating ${updates.length} URLs...`);
    const validIds = await validateBatch(updates.map((u) => ({ url: u.url, id: u.id })));
    const invalid = updates.filter((u) => !validIds.has(u.id));
    if (invalid.length > 0) {
      console.log(`   Skipping ${invalid.length} invalid URLs`);
      for (const inv of invalid) console.log(`     - ${inv.name}`);
    }
    updates.splice(0, updates.length, ...updates.filter((u) => validIds.has(u.id)));
  }

  if (dryRun) {
    console.log(`   [DRY RUN] Would update ${updates.length} teams:`);
    for (const u of updates.slice(0, 10)) console.log(`     ${u.name} → ${u.url}`);
    if (updates.length > 10) console.log(`     ... and ${updates.length - 10} more`);
    return;
  }

  let count = 0;
  for (const u of updates) {
    await db
      .update(schema.teams)
      .set({ logoUrl: u.url, updatedAt: new Date() })
      .where(eq(schema.teams.id, u.id));
    count++;
  }

  console.log(`   Updated ${count} team logos`);
}

// ============================================================
// POPULATE: COMPETITIONS
// ============================================================

async function populateCompetitionLogos() {
  console.log("\n== Competitions ==");

  let count = 0;

  for (const [slug, apiId] of Object.entries(LEAGUE_MAP)) {
    const [comp] = await db
      .select({ id: schema.competitions.id, name: schema.competitions.name, logoUrl: schema.competitions.logoUrl })
      .from(schema.competitions)
      .where(eq(schema.competitions.slug, slug))
      .limit(1);

    if (!comp) {
      console.log(`   ? No competition found for slug: ${slug}`);
      continue;
    }

    if (comp.logoUrl && comp.logoUrl !== "") {
      continue; // Already has a logo
    }

    const url = `${CDN_BASE}/leagues/${apiId}.png`;

    if (validate) {
      const ok = await validateUrl(url);
      if (!ok) {
        console.log(`   ! Invalid URL for ${comp.name}: ${url}`);
        continue;
      }
    }

    if (dryRun) {
      console.log(`   [DRY RUN] ${comp.name} → ${url}`);
      count++;
      continue;
    }

    await db
      .update(schema.competitions)
      .set({ logoUrl: url, updatedAt: new Date() })
      .where(eq(schema.competitions.id, comp.id));

    console.log(`   + ${comp.name}`);
    count++;
  }

  console.log(`   Updated ${count} competition logos`);
}

// ============================================================
// POPULATE: PLAYERS
// ============================================================

async function populatePlayerImages() {
  console.log("\n== Players ==");

  const players = await db
    .select({ id: schema.players.id, name: schema.players.name, externalId: schema.players.externalId, imageUrl: schema.players.imageUrl })
    .from(schema.players)
    .where(
      and(
        like(schema.players.externalId, "af-%"),
        or(isNull(schema.players.imageUrl), eq(schema.players.imageUrl, ""))
      )
    );

  console.log(`   Found ${players.length} players with af-* ID and no image`);

  if (players.length === 0) return;

  const updates: { id: string; name: string; url: string }[] = [];

  for (const player of players) {
    const afIdNum = extractAfId(player.externalId!);
    if (!afIdNum) continue;
    updates.push({
      id: player.id,
      name: player.name,
      url: `${CDN_BASE}/players/${afIdNum}.png`,
    });
  }

  if (validate) {
    console.log(`   Validating ${updates.length} URLs (batches of 10)...`);
    const validIds = await validateBatch(updates.map((u) => ({ url: u.url, id: u.id })));
    const invalid = updates.filter((u) => !validIds.has(u.id));
    if (invalid.length > 0) {
      console.log(`   Skipping ${invalid.length} invalid URLs`);
    }
    updates.splice(0, updates.length, ...updates.filter((u) => validIds.has(u.id)));
  }

  if (dryRun) {
    console.log(`   [DRY RUN] Would update ${updates.length} players:`);
    for (const u of updates.slice(0, 10)) console.log(`     ${u.name} → ${u.url}`);
    if (updates.length > 10) console.log(`     ... and ${updates.length - 10} more`);
    return;
  }

  // Batch update in chunks
  const CHUNK_SIZE = 100;
  let count = 0;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((u) =>
        db
          .update(schema.players)
          .set({ imageUrl: u.url, updatedAt: new Date() })
          .where(eq(schema.players.id, u.id))
      )
    );
    count += chunk.length;
    if (updates.length > CHUNK_SIZE) {
      console.log(`   Progress: ${count}/${updates.length}`);
    }
  }

  console.log(`   Updated ${count} player images`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("Populate Images from API-Football CDN");
  console.log("=".repeat(50));
  if (dryRun) console.log("[DRY RUN MODE]");
  if (validate) console.log("[VALIDATION ENABLED]");

  if (doTeams) await populateTeamLogos();
  if (doCompetitions) await populateCompetitionLogos();
  if (doPlayers) await populatePlayerImages();

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
