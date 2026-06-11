/**
 * Merge duplicate team rows into their canonical siblings.
 *
 * Old API-Football syncs created teams under short names ("Liverpool")
 * while the canonical rows use full names ("Liverpool FC") — every
 * reference (squads, standings, matches, lineups, stats) then split
 * across the two rows. This walks all af-mapped teams, finds the
 * canonical sibling via the smart matcher, repoints every referencing
 * table with conflict-safe updates, moves the provider mappings, and
 * deletes the duplicate.
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-teams.ts --dry-run
 *   npx tsx scripts/merge-duplicate-teams.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { findTeamByName, TEAM_NAME_ALIASES } from "../src/lib/seo/team-matcher";

const DRY_RUN = process.argv.includes("--dry-run");

async function mergeTeam(sql: ReturnType<typeof neon>, dupeId: string, canonId: string, label: string) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would merge ${label}`);
    return;
  }

  // Provider mappings move first — entity_id is not part of the PK so
  // this never conflicts.
  await sql`UPDATE external_ids SET entity_id = ${canonId} WHERE entity_id = ${dupeId}`;

  // Matches: simple repoint (slug uniqueness is unaffected).
  await sql`UPDATE matches SET home_team_id = ${canonId} WHERE home_team_id = ${dupeId}`;
  await sql`UPDATE matches SET away_team_id = ${canonId} WHERE away_team_id = ${dupeId}`;

  // player_team_history: unique (player_id, team_id, valid_from) —
  // repoint the rows that won't collide, drop the rest (the canonical
  // row already has the stint).
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

  const afTeams = (await sql`
    SELECT t.id, t.name, t.slug FROM external_ids x
    JOIN teams t ON t.id = x.entity_id
    WHERE x.entity_type = 'team' AND x.provider = 'af'
  `) as Array<{ id: string; name: string; slug: string }>;

  let merged = 0;
  for (const t of afTeams) {
    // findTeamByName prefers exact name first — for a dupe named
    // "Liverpool" it returns the dupe itself, so resolve the canonical
    // by excluding self: check whether a DIFFERENT row matches better.
    const canon = await findTeamByName(sql, t.name);
    if (!canon || canon.id === t.id) {
      // The alias map bridges nicknames ("Wolves") that exact-name
      // matching short-circuits on.
      const aliasSlug = TEAM_NAME_ALIASES[t.name];
      if (aliasSlug && aliasSlug !== t.slug) {
        const aliasRow = (await sql`SELECT id, slug FROM teams WHERE slug = ${aliasSlug} LIMIT 1`) as Array<{ id: string; slug: string }>;
        if (aliasRow[0] && aliasRow[0].id !== t.id) {
          await mergeTeam(sql, t.id, aliasRow[0].id, `"${t.name}" (${t.slug}) → ${aliasRow[0].slug}`);
          merged++;
          continue;
        }
      }
      // Exact-name self-match: retry against the fd-mapped sibling set.
      const sibling = (await sql`
        SELECT t2.id, t2.slug FROM teams t2
        JOIN external_ids x2 ON x2.entity_id = t2.id AND x2.entity_type = 'team' AND x2.provider = 'fd'
        WHERE t2.id != ${t.id}
          AND (t2.name ILIKE ${t.name + " %"} OR t2.name ILIKE ${"% " + t.name} OR replace(t2.name, '.', '') ILIKE ${"%" + t.name + "%"})
        LIMIT 1
      `) as Array<{ id: string; slug: string }>;
      if (!sibling[0]) continue;
      await mergeTeam(sql, t.id, sibling[0].id, `"${t.name}" (${t.slug}) → ${sibling[0].slug}`);
      merged++;
      continue;
    }
    await mergeTeam(sql, t.id, canon.id, `"${t.name}" (${t.slug}) → ${canon.slug}`);
    merged++;
  }

  console.log(`\n${DRY_RUN ? "[dry-run] would merge" : "merged"} ${merged} duplicate teams`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
