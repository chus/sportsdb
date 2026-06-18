import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Recalibrate the `players.is_indexable` flag for every player based on
 * the latest quality signals (stats, lineups, articles, transfers,
 * career rows, current team, biographical completeness).
 *
 * Runs weekly so the sitemap gate stays in sync with the
 * fetch-player-stats cron's data. Without this, players who acquire
 * new season stats stay flagged as un-indexable forever, and the
 * sitemap under-emits player URLs.
 *
 * Mirrors scripts/update-player-quality.ts. Single LATERAL JOIN query
 * scores every player in one trip; the UPDATEs are chunked to keep the
 * request under the 60-second function timeout.
 */

interface PlayerRow {
  id: string;
  position: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  image_url: string | null;
  career_count: number;
  current_team: number;
  stats_count: number;
  lineup_count: number;
  article_count: number;
  transfer_count: number;
  is_indexable: boolean;
}

function scorePlayer(p: PlayerRow): number {
  let score = 0;
  if (p.position && p.position !== "Unknown") score += 10;
  if (p.nationality) score += 10;
  if (p.date_of_birth) score += 5;
  if (p.height_cm) score += 3;
  if (p.preferred_foot) score += 2;
  if (p.image_url) score += 5;
  if (Number(p.career_count) >= 1) score += 10;
  if (Number(p.career_count) >= 2) score += 5;
  if (Number(p.current_team) > 0) score += 10;
  if (Number(p.stats_count) > 0) score += 20;
  if (Number(p.lineup_count) > 0) score += 10;
  if (Number(p.article_count) > 0) score += 10;

  // Hard content gate: bio-only profiles cap at 35 (Tier C, noindex).
  // Pages with zero on-pitch / article / transfer evidence are Google
  // "Crawled - currently not indexed" candidates regardless of metadata.
  const hasRealContent =
    Number(p.stats_count) > 0 ||
    Number(p.lineup_count) > 0 ||
    Number(p.article_count) > 0 ||
    Number(p.transfer_count) > 0;
  if (!hasRealContent) {
    score = Math.min(score, 35);
  }

  return score;
}

async function verifyCronSecret() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }

  const sql = neon(DATABASE_URL);

  const players = (await sql`
    SELECT
      p.id,
      p.position,
      p.nationality,
      p.date_of_birth,
      p.height_cm,
      p.preferred_foot,
      p.image_url,
      p.is_indexable,
      COALESCE(career.cnt, 0) as career_count,
      COALESCE(current_team.cnt, 0) as current_team,
      COALESCE(stats.cnt, 0) as stats_count,
      COALESCE(lineups.cnt, 0) as lineup_count,
      COALESCE(articles.cnt, 0) as article_count,
      COALESCE(xfers.cnt, 0) as transfer_count
    FROM players p
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM player_team_history WHERE player_id = p.id
    ) career ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM player_team_history WHERE player_id = p.id AND valid_to IS NULL
    ) current_team ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM player_season_stats WHERE player_id = p.id
    ) stats ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM match_lineups WHERE player_id = p.id
    ) lineups ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM article_players WHERE player_id = p.id
    ) articles ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as cnt FROM transfers WHERE player_id = p.id
    ) xfers ON true
  `) as PlayerRow[];

  const tierCounts = { A: 0, B: 0, C: 0, D: 0 };
  const toSetTrue: string[] = [];
  const toSetFalse: string[] = [];

  for (const p of players) {
    const score = scorePlayer(p);
    if (score >= 60) tierCounts.A++;
    else if (score >= 40) tierCounts.B++;
    else if (score >= 20) tierCounts.C++;
    else tierCounts.D++;

    const isIndexable = score >= 40;
    if (isIndexable && !p.is_indexable) toSetTrue.push(p.id);
    else if (!isIndexable && p.is_indexable) toSetFalse.push(p.id);
  }

  // Chunked UPDATEs keep individual queries small even at high deltas.
  const CHUNK = 500;
  for (let i = 0; i < toSetTrue.length; i += CHUNK) {
    const chunk = toSetTrue.slice(i, i + CHUNK);
    await sql`UPDATE players SET is_indexable = true, updated_at = NOW() WHERE id = ANY(${chunk}::uuid[])`;
  }
  for (let i = 0; i < toSetFalse.length; i += CHUNK) {
    const chunk = toSetFalse.slice(i, i + CHUNK);
    await sql`UPDATE players SET is_indexable = false, updated_at = NOW() WHERE id = ANY(${chunk}::uuid[])`;
  }

  // Refresh popularity_score from real output (goals/assists/appearances +
  // rating). Drives the /compare matrix, internal "Compare with" links, and
  // compare pre-rendering. Mirrors scripts/compute-player-popularity.ts.
  const popResult = await sql`
    UPDATE players p SET popularity_score = sub.score
    FROM (
      SELECT pl.id,
        GREATEST(0,
          COALESCE(s.g, 0) * 4 + COALESCE(s.a, 0) * 3 + COALESCE(s.apps, 0)
          + COALESCE(ROUND(GREATEST(r.ar - 6, 0) * 30)::int, 0)
        ) AS score
      FROM players pl
      LEFT JOIN (SELECT player_id, SUM(goals) g, SUM(assists) a, SUM(appearances) apps FROM player_season_stats GROUP BY player_id) s ON s.player_id = pl.id
      LEFT JOIN (SELECT player_id, AVG(rating) ar FROM player_match_stats WHERE rating IS NOT NULL GROUP BY player_id) r ON r.player_id = pl.id
    ) sub
    WHERE p.id = sub.id AND p.popularity_score IS DISTINCT FROM sub.score
    RETURNING p.id
  `;

  return NextResponse.json({
    success: true,
    totalPlayers: players.length,
    tierCounts,
    totalIndexable: tierCounts.A + tierCounts.B,
    flippedToTrue: toSetTrue.length,
    flippedToFalse: toSetFalse.length,
    popularityUpdated: popResult.length,
    timestamp: new Date().toISOString(),
  });
}
