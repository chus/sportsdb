/**
 * Backfill word_count column for all articles
 *
 * Usage:
 *   DATABASE_URL=xxx npx tsx scripts/seo/backfill-article-word-counts.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("\nBackfilling article word counts...\n");

  const articles = await sql`
    SELECT id, title, content, type, word_count FROM articles
  `;

  console.log(`Found ${articles.length} articles`);

  let updated = 0;
  const typeCounts: Record<string, { total: number; sum: number; min: number; max: number }> = {};

  for (const article of articles) {
    const wordCount = article.content
      ? article.content.split(/\s+/).filter(Boolean).length
      : 0;

    // Track stats by type
    const type = article.type || "unknown";
    if (!typeCounts[type]) {
      typeCounts[type] = { total: 0, sum: 0, min: Infinity, max: 0 };
    }
    typeCounts[type].total++;
    typeCounts[type].sum += wordCount;
    typeCounts[type].min = Math.min(typeCounts[type].min, wordCount);
    typeCounts[type].max = Math.max(typeCounts[type].max, wordCount);

    if (article.word_count !== wordCount) {
      await sql`UPDATE articles SET word_count = ${wordCount} WHERE id = ${article.id}`;
      updated++;
    }
  }

  console.log(`\nUpdated ${updated} articles\n`);

  // Print stats by type
  console.log("Word count stats by type:");
  console.log("-".repeat(70));
  console.log(
    "Type".padEnd(20) +
    "Count".padStart(6) +
    "Avg".padStart(8) +
    "Min".padStart(8) +
    "Max".padStart(8) +
    "Under 600".padStart(12)
  );
  console.log("-".repeat(70));

  for (const [type, stats] of Object.entries(typeCounts).sort((a, b) => b[1].total - a[1].total)) {
    const avg = Math.round(stats.sum / stats.total);
    console.log(
      type.padEnd(20) +
      String(stats.total).padStart(6) +
      String(avg).padStart(8) +
      String(stats.min).padStart(8) +
      String(stats.max).padStart(8)
    );
  }

  // Report articles under 600 words
  const shortArticles = await sql`
    SELECT id, title, type, word_count FROM articles
    WHERE word_count < 600 AND status = 'published'
    ORDER BY word_count ASC
  `;

  if (shortArticles.length > 0) {
    console.log(`\n${shortArticles.length} published articles under 600 words:`);
    for (const a of shortArticles.slice(0, 20)) {
      console.log(`  [${a.word_count} words] [${a.type}] ${a.title}`);
    }
    if (shortArticles.length > 20) {
      console.log(`  ... and ${shortArticles.length - 20} more`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
