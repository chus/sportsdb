/**
 * Backfill article_players
 *
 * Scans all articles for player name mentions and inserts
 * matching rows into article_players.
 *
 * Usage: npx tsx scripts/backfill-article-players.ts
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Backfill article_players");
  console.log("=".repeat(50));

  // Load all articles
  const articles = await sql`
    SELECT id, slug, title, excerpt, content, primary_player_id
    FROM articles WHERE status = 'published'
  `;
  console.log(`Articles: ${articles.length}`);

  // Load all players — only those with real names (skip unknowns)
  // Use names with 2+ words to avoid false positives (e.g. "David" matching everything)
  const players = await sql`
    SELECT id, name, known_as, slug
    FROM players
    WHERE position != 'Unknown'
      AND length(name) > 3
  `;
  console.log(`Players: ${players.length}`);

  // Build lookup: only use full names (2+ words) to avoid false matches
  const playerLookup: { id: string; name: string; pattern: RegExp }[] = [];
  for (const p of players) {
    // Full name (e.g. "Lionel Messi")
    if (p.name && p.name.includes(" ")) {
      playerLookup.push({
        id: p.id,
        name: p.name,
        pattern: new RegExp(`\\b${escapeRegex(p.name)}\\b`, "i"),
      });
    }
    // Known as (e.g. "Messi") — only if 5+ chars to reduce false positives
    if (p.known_as && p.known_as.length >= 5 && p.known_as !== p.name) {
      playerLookup.push({
        id: p.id,
        name: p.known_as,
        pattern: new RegExp(`\\b${escapeRegex(p.known_as)}\\b`, "i"),
      });
    }
  }
  console.log(`Patterns: ${playerLookup.length}`);

  let totalLinked = 0;
  let totalArticles = 0;

  for (const article of articles) {
    const text = [article.title, article.excerpt, article.content]
      .filter(Boolean)
      .join(" ");

    const matchedPlayerIds = new Set<string>();

    // Check primaryPlayerId first
    if (article.primary_player_id) {
      matchedPlayerIds.add(article.primary_player_id);
    }

    // Scan text for player mentions
    for (const entry of playerLookup) {
      if (entry.pattern.test(text)) {
        matchedPlayerIds.add(entry.id);
      }
    }

    if (matchedPlayerIds.size === 0) continue;
    totalArticles++;

    for (const playerId of matchedPlayerIds) {
      const role =
        playerId === article.primary_player_id ? "featured" : "mentioned";
      try {
        await sql`
          INSERT INTO article_players (article_id, player_id, role)
          VALUES (${article.id}, ${playerId}, ${role})
          ON CONFLICT DO NOTHING
        `;
        totalLinked++;
      } catch {
        // skip constraint violations
      }
    }

    if (matchedPlayerIds.size > 0) {
      console.log(
        `  ${article.slug}: ${matchedPlayerIds.size} players linked`
      );
    }
  }

  console.log(`\nDone — ${totalLinked} links across ${totalArticles} articles`);

  const [count] = await sql`SELECT count(*)::int as c FROM article_players`;
  console.log(`Total rows in article_players: ${count.c}`);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
