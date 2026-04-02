/**
 * Deep Wikidata enrichment for players and teams that already have wikidataId
 *
 * Fetches additional properties not covered by initial enrichment:
 * - Players: Wikipedia URL, website, Instagram, Twitter
 * - Teams: Wikipedia URL, website, Instagram, Twitter, coach (P286)
 *
 * Never overwrites existing non-null values.
 *
 * Usage:
 *   npx tsx scripts/wikidata/enrich-deep.ts
 *   npx tsx scripts/wikidata/enrich-deep.ts --dry-run
 *   npx tsx scripts/wikidata/enrich-deep.ts --players-only
 *   npx tsx scripts/wikidata/enrich-deep.ts --teams-only
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { sparqlQuery, val, qid } from "./sparql";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");
const playersOnly = process.argv.includes("--players-only");
const teamsOnly = process.argv.includes("--teams-only");

const BATCH_SIZE = 50;

// ─── Player deep enrichment ─────────────────────────────────

interface DbPlayer {
  id: string;
  name: string;
  wikidata_id: string;
  website_url: string | null;
  wikipedia_url: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
}

async function enrichPlayers() {
  console.log("\n=== Deep Player Enrichment ===\n");

  const players: DbPlayer[] = await sql`
    SELECT id, name, wikidata_id, website_url, wikipedia_url,
           instagram_handle, twitter_handle
    FROM players
    WHERE wikidata_id IS NOT NULL
      AND (wikipedia_url IS NULL OR instagram_handle IS NULL OR twitter_handle IS NULL)
    ORDER BY popularity_score DESC NULLS LAST
  `;

  console.log(`${players.length} players with wikidataId needing deep enrichment`);

  let enriched = 0;

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);
    const qids = batch.map((p) => `wd:${p.wikidata_id}`).join(" ");

    // Fetch social media, website, and Wikipedia sitelink
    const query = `
      SELECT ?item ?website ?instagram ?twitter ?wikipedia WHERE {
        VALUES ?item { ${qids} }
        OPTIONAL { ?item wdt:P856 ?website . }
        OPTIONAL { ?item wdt:P2003 ?instagram . }
        OPTIONAL { ?item wdt:P2002 ?twitter . }
        OPTIONAL {
          ?wikipedia schema:about ?item ;
                    schema:isPartOf <https://en.wikipedia.org/> .
        }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Build lookup: wikidataId → result (merge multiple rows per entity)
      const lookup = new Map<string, {
        website: string | null;
        instagram: string | null;
        twitter: string | null;
        wikipedia: string | null;
      }>();

      for (const r of results) {
        const wdId = qid(val(r, "item")!);
        const existing = lookup.get(wdId) || {
          website: null, instagram: null, twitter: null, wikipedia: null,
        };
        if (!existing.website && val(r, "website")) existing.website = val(r, "website");
        if (!existing.instagram && val(r, "instagram")) existing.instagram = val(r, "instagram");
        if (!existing.twitter && val(r, "twitter")) existing.twitter = val(r, "twitter");
        if (!existing.wikipedia && val(r, "wikipedia")) existing.wikipedia = val(r, "wikipedia");
        lookup.set(wdId, existing);
      }

      for (const player of batch) {
        const data = lookup.get(player.wikidata_id);
        if (!data) continue;

        const updates: string[] = [];
        if (!player.website_url && data.website) updates.push("website");
        if (!player.wikipedia_url && data.wikipedia) updates.push("wikipedia");
        if (!player.instagram_handle && data.instagram) updates.push("instagram");
        if (!player.twitter_handle && data.twitter) updates.push("twitter");

        if (updates.length === 0) continue;

        if (!dryRun) {
          await sql`
            UPDATE players SET
              website_url = COALESCE(website_url, ${data.website}),
              wikipedia_url = COALESCE(wikipedia_url, ${data.wikipedia}),
              instagram_handle = COALESCE(instagram_handle, ${data.instagram}),
              twitter_handle = COALESCE(twitter_handle, ${data.twitter}),
              updated_at = NOW()
            WHERE id = ${player.id}
          `;
        }

        enriched++;
      }

      const pct = Math.min(100, Math.round(((i + batch.length) / players.length) * 100));
      process.stdout.write(`\r  Progress: ${i + batch.length}/${players.length} (${pct}%) | Enriched: ${enriched}`);
    } catch (err) {
      console.error(`\n  Error at batch ${i}: ${(err as Error).message}`);
    }
  }

  console.log(`\n  Players enriched: ${enriched}\n`);
  return enriched;
}

// ─── Team deep enrichment ────────────────────────────────────

interface DbTeam {
  id: string;
  name: string;
  wikidata_id: string;
  coach_name: string | null;
  website_url: string | null;
  wikipedia_url: string | null;
  instagram_handle: string | null;
  twitter_handle: string | null;
}

async function enrichTeams() {
  console.log("\n=== Deep Team Enrichment ===\n");

  const teams: DbTeam[] = await sql`
    SELECT id, name, wikidata_id, coach_name, website_url, wikipedia_url,
           instagram_handle, twitter_handle
    FROM teams
    WHERE wikidata_id IS NOT NULL
      AND (wikipedia_url IS NULL OR website_url IS NULL OR instagram_handle IS NULL
           OR twitter_handle IS NULL OR coach_name IS NULL)
    ORDER BY name
  `;

  console.log(`${teams.length} teams with wikidataId needing deep enrichment`);

  let enriched = 0;

  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = teams.slice(i, i + BATCH_SIZE);
    const qids = batch.map((t) => `wd:${t.wikidata_id}`).join(" ");

    // Fetch coach, social media, website, and Wikipedia sitelink
    const query = `
      SELECT ?item ?coachLabel ?website ?instagram ?twitter ?wikipedia WHERE {
        VALUES ?item { ${qids} }
        OPTIONAL { ?item wdt:P286 ?coach . }
        OPTIONAL { ?item wdt:P856 ?website . }
        OPTIONAL { ?item wdt:P2003 ?instagram . }
        OPTIONAL { ?item wdt:P2002 ?twitter . }
        OPTIONAL {
          ?wikipedia schema:about ?item ;
                    schema:isPartOf <https://en.wikipedia.org/> .
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Build lookup, merging multiple rows per entity
      const lookup = new Map<string, {
        coach: string | null;
        website: string | null;
        instagram: string | null;
        twitter: string | null;
        wikipedia: string | null;
      }>();

      for (const r of results) {
        const wdId = qid(val(r, "item")!);
        const existing = lookup.get(wdId) || {
          coach: null, website: null, instagram: null, twitter: null, wikipedia: null,
        };
        if (!existing.coach && val(r, "coachLabel")) existing.coach = val(r, "coachLabel");
        if (!existing.website && val(r, "website")) existing.website = val(r, "website");
        if (!existing.instagram && val(r, "instagram")) existing.instagram = val(r, "instagram");
        if (!existing.twitter && val(r, "twitter")) existing.twitter = val(r, "twitter");
        if (!existing.wikipedia && val(r, "wikipedia")) existing.wikipedia = val(r, "wikipedia");
        lookup.set(wdId, existing);
      }

      for (const team of batch) {
        const data = lookup.get(team.wikidata_id);
        if (!data) continue;

        const updates: string[] = [];
        if (!team.coach_name && data.coach) updates.push("coach");
        if (!team.website_url && data.website) updates.push("website");
        if (!team.wikipedia_url && data.wikipedia) updates.push("wikipedia");
        if (!team.instagram_handle && data.instagram) updates.push("instagram");
        if (!team.twitter_handle && data.twitter) updates.push("twitter");

        if (updates.length === 0) continue;

        if (!dryRun) {
          await sql`
            UPDATE teams SET
              coach_name = COALESCE(coach_name, ${data.coach}),
              website_url = COALESCE(website_url, ${data.website}),
              wikipedia_url = COALESCE(wikipedia_url, ${data.wikipedia}),
              instagram_handle = COALESCE(instagram_handle, ${data.instagram}),
              twitter_handle = COALESCE(twitter_handle, ${data.twitter}),
              updated_at = NOW()
            WHERE id = ${team.id}
          `;
        }

        enriched++;
      }

      const pct = Math.min(100, Math.round(((i + batch.length) / teams.length) * 100));
      process.stdout.write(`\r  Progress: ${i + batch.length}/${teams.length} (${pct}%) | Enriched: ${enriched}`);
    } catch (err) {
      console.error(`\n  Error at batch ${i}: ${(err as Error).message}`);
    }
  }

  console.log(`\n  Teams enriched: ${enriched}\n`);
  return enriched;
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔗 Wikidata Deep Enrichment${dryRun ? " (DRY RUN)" : ""}`);

  let playerCount = 0;
  let teamCount = 0;

  if (!teamsOnly) {
    playerCount = await enrichPlayers();
  }
  if (!playersOnly) {
    teamCount = await enrichTeams();
  }

  console.log("═══════════════════════════════════════");
  console.log(`  Players enriched: ${playerCount}`);
  console.log(`  Teams enriched:   ${teamCount}`);
  console.log("═══════════════════════════════════════\n");
}

main().catch(console.error);
