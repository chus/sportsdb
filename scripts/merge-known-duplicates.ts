/**
 * Merge a curated list of confirmed duplicate club rows.
 *
 * The data-health canary surfaced clubs split across two team rows: an
 * fd-mapped row carrying the full canonical name + historical players/
 * standings, and an af-mapped row carrying the short name + the live
 * fixtures. API-Football sends short names ("Bayern München", "Rennes")
 * that the name matcher couldn't bridge to the fd canonical ("FC Bayern
 * Munich", "Stade Rennais FC"), so a second row was created and the af
 * mapping stamped on it — every future af sync then resolved via that
 * mapping and kept the split alive.
 *
 * Unlike merge-duplicate-teams.ts (heuristic, walks all af teams), this
 * is an explicit allow-list: each pair was eyeballed against league +
 * standings position so we never merge two genuinely different clubs
 * (e.g. the three distinct "Nacional" clubs a normalizer wrongly groups).
 *
 * Direction: af short-name row → fd canonical row. The af external_id
 * moves onto the canonical, so subsequent af syncs resolve there.
 *
 * Usage:
 *   npx tsx scripts/merge-known-duplicates.ts --dry-run
 *   npx tsx scripts/merge-known-duplicates.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const DRY_RUN = process.argv.includes("--dry-run");

// dupe slug → canonical slug. Verified pairs only.
const PAIRS: Array<[string, string]> = [
  ["bayern-munchen", "fc-bayern-munich"],
  ["bayer-leverkusen", "bayer-04-leverkusen"],
  ["rennes", "stade-rennais-fc"],
  ["famalicao", "f-c-famalicao"],
  ["celta-vigo", "rc-celta-de-vigo"],
  ["alaves", "deportivo-alaves"],
  ["paris-saint-germain", "paris-saint-germain-fc"],
];

async function mergeTeam(
  sql: ReturnType<typeof neon>,
  dupeId: string,
  canonId: string,
  label: string,
) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would merge ${label}`);
    return;
  }

  // Provider mappings move first — conflict-safe: only move a mapping if
  // the canonical doesn't already hold the same (provider, provider_id,
  // entity_type), then drop whatever's left on the dupe.
  await sql`
    UPDATE external_ids x SET entity_id = ${canonId}
    WHERE x.entity_id = ${dupeId} AND x.entity_type = 'team'
      AND NOT EXISTS (
        SELECT 1 FROM external_ids y
        WHERE y.provider = x.provider AND y.provider_id = x.provider_id
          AND y.entity_type = x.entity_type AND y.entity_id = ${canonId}
      )
  `;
  await sql`DELETE FROM external_ids WHERE entity_id = ${dupeId} AND entity_type = 'team'`;

  // Matches: simple repoint (slug uniqueness is unaffected).
  await sql`UPDATE matches SET home_team_id = ${canonId} WHERE home_team_id = ${dupeId}`;
  await sql`UPDATE matches SET away_team_id = ${canonId} WHERE away_team_id = ${dupeId}`;

  // player_team_history: unique (player_id, team_id, valid_from) —
  // repoint the rows that won't collide, drop the rest.
  await sql`
    UPDATE player_team_history pth SET team_id = ${canonId}
    WHERE team_id = ${dupeId}
      AND NOT EXISTS (
        SELECT 1 FROM player_team_history p2
        WHERE p2.player_id = pth.player_id AND p2.team_id = ${canonId} AND p2.valid_from = pth.valid_from
      )
  `;
  await sql`DELETE FROM player_team_history WHERE team_id = ${dupeId}`;

  // standings: unique (competition_season_id, team_id).
  await sql`
    UPDATE standings st SET team_id = ${canonId}
    WHERE team_id = ${dupeId}
      AND NOT EXISTS (
        SELECT 1 FROM standings s2
        WHERE s2.competition_season_id = st.competition_season_id AND s2.team_id = ${canonId}
      )
  `;
  await sql`DELETE FROM standings WHERE team_id = ${dupeId}`;

  // player_season_stats: unique (player_id, team_id, competition_season_id).
  await sql`
    UPDATE player_season_stats ps SET team_id = ${canonId}
    WHERE team_id = ${dupeId}
      AND NOT EXISTS (
        SELECT 1 FROM player_season_stats p2
        WHERE p2.player_id = ps.player_id AND p2.team_id = ${canonId}
          AND p2.competition_season_id = ps.competition_season_id
      )
  `;
  await sql`DELETE FROM player_season_stats WHERE team_id = ${dupeId}`;

  // Plain repoints.
  await sql`UPDATE match_lineups SET team_id = ${canonId} WHERE team_id = ${dupeId}`;
  await sql`UPDATE match_events SET team_id = ${canonId} WHERE team_id = ${dupeId}`;
  await sql`UPDATE transfers SET from_team_id = ${canonId} WHERE from_team_id = ${dupeId}`;
  await sql`UPDATE transfers SET to_team_id = ${canonId} WHERE to_team_id = ${dupeId}`;
  await sql`
    UPDATE article_teams at2 SET team_id = ${canonId}
    WHERE team_id = ${dupeId}
      AND NOT EXISTS (SELECT 1 FROM article_teams a2 WHERE a2.article_id = at2.article_id AND a2.team_id = ${canonId})
  `;
  await sql`DELETE FROM article_teams WHERE team_id = ${dupeId}`;
  await sql`DELETE FROM team_seasons WHERE team_id = ${dupeId}`;
  await sql`DELETE FROM team_venue_history WHERE team_id = ${dupeId}`;
  await sql`UPDATE competition_seasons SET champion_team_id = ${canonId} WHERE champion_team_id = ${dupeId}`;
  await sql`DELETE FROM search_index WHERE id = ${dupeId}`;

  await sql`DELETE FROM teams WHERE id = ${dupeId}`;
  console.log(`  merged ${label}`);
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  let merged = 0;

  for (const [dupeSlug, canonSlug] of PAIRS) {
    const [dupe] = (await sql`SELECT id, name FROM teams WHERE slug = ${dupeSlug} LIMIT 1`) as Array<{ id: string; name: string }>;
    const [canon] = (await sql`SELECT id, name FROM teams WHERE slug = ${canonSlug} LIMIT 1`) as Array<{ id: string; name: string }>;
    if (!dupe) {
      console.log(`  skip: dupe ${dupeSlug} not found (already merged?)`);
      continue;
    }
    if (!canon) {
      console.log(`  ⚠ skip: canonical ${canonSlug} not found — would orphan ${dupeSlug}`);
      continue;
    }
    await mergeTeam(sql, dupe.id, canon.id, `"${dupe.name}" (${dupeSlug}) → "${canon.name}" (${canonSlug})`);
    merged++;
  }

  console.log(`\n${DRY_RUN ? "[dry-run] would merge" : "merged"} ${merged} duplicate teams`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
