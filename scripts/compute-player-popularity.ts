/**
 * Compute players.popularity_score from real on-pitch output.
 *
 * popularity_score was 0 for every player, which crippled the comparison
 * matrix: the sitemap and generateStaticParams had no way to pick which
 * players are worth comparing, so /compare pages — the ONE format that
 * ranks on page 1 in GSC — were never put in the sitemap or internally
 * linked. This gives a usable ranking.
 *
 * Score = goals*4 + assists*3 + appearances + rating bonus. Attackers
 * (the most-compared players) rise; within a position, regular starters
 * and high performers rank above fringe players. Used to drive the compare
 * matrix, internal "Compare with" links, and static pre-rendering.
 *
 * Run after stats syncs. Mirrored as a step in update-player-quality cron.
 *   npx tsx scripts/compute-player-popularity.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const res = await sql`
    UPDATE players p SET popularity_score = sub.score, updated_at = NOW()
    FROM (
      SELECT pl.id,
        GREATEST(0,
          COALESCE(s.g, 0) * 4 + COALESCE(s.a, 0) * 3 + COALESCE(s.apps, 0)
          + COALESCE(ROUND(GREATEST(r.ar - 6, 0) * 30)::int, 0)
        ) AS score
      FROM players pl
      LEFT JOIN (
        SELECT player_id, SUM(goals) g, SUM(assists) a, SUM(appearances) apps
        FROM player_season_stats GROUP BY player_id
      ) s ON s.player_id = pl.id
      LEFT JOIN (
        SELECT player_id, AVG(rating) ar
        FROM player_match_stats WHERE rating IS NOT NULL GROUP BY player_id
      ) r ON r.player_id = pl.id
    ) sub
    WHERE p.id = sub.id AND p.popularity_score IS DISTINCT FROM sub.score
    RETURNING p.id
  `;
  console.log(`Updated popularity_score for ${res.length} players`);

  const top = await sql`
    SELECT name, position, popularity_score FROM players
    WHERE is_indexable = true ORDER BY popularity_score DESC LIMIT 10
  `;
  console.log("Top indexable players:");
  for (const t of top as Array<{ name: string; position: string; popularity_score: number }>) {
    console.log(`  ${t.popularity_score}  ${t.name} (${t.position})`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
