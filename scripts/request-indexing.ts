/**
 * One-shot script to request re-indexing of all important pages.
 * Uses Google Indexing API (200/day limit) + IndexNow (unlimited).
 *
 * Usage: npx tsx scripts/request-indexing.ts
 *        npx tsx scripts/request-indexing.ts --dry-run
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { submitUrlsToGoogle, submitUrlsToIndexNow, pingGoogleSitemap } from "../src/lib/seo/indexnow";

const sql = neon(process.env.DATABASE_URL!);
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("🔍 Collecting all indexable URLs...\n");

  // Static pages
  const staticPaths = [
    "/",
    "/news",
    "/about",
    "/contact",
    "/methodology",
    "/privacy",
    "/terms",
    "/top-scorers",
    "/top-assists",
    "/transfers",
    "/trending",
    "/venues",
    "/games",
  ];

  // Competitions
  const competitions = await sql`SELECT slug FROM competitions ORDER BY name`;
  const compPaths = competitions.flatMap((c) => [
    `/competitions/${c.slug}`,
    `/top-scorers/${c.slug}`,
    `/top-assists/${c.slug}`,
  ]);

  // Teams with standings (quality pages)
  const teams = await sql`
    SELECT DISTINCT t.slug FROM teams t
    JOIN standings s ON s.team_id = t.id
    WHERE t.slug IS NOT NULL
    ORDER BY t.slug
  `;
  const teamPaths = teams.map((t) => `/teams/${t.slug}`);

  // Published articles
  const articles = await sql`
    SELECT slug FROM articles
    WHERE status = 'published'
    ORDER BY published_at DESC
  `;
  const articlePaths = articles.map((a) => `/news/${a.slug}`);

  // Finished matches with articles (same as sitemap)
  const matches = await sql`
    SELECT m.slug FROM matches m
    WHERE m.status = 'finished'
      AND m.home_score IS NOT NULL
      AND m.slug IS NOT NULL
      AND EXISTS (SELECT 1 FROM articles a WHERE a.match_id = m.id AND a.status = 'published')
    ORDER BY m.scheduled_at DESC
    LIMIT 200
  `;
  const matchPaths = matches.map((m) => `/matches/${m.slug}`);

  const allPaths = [...staticPaths, ...compPaths, ...teamPaths, ...articlePaths, ...matchPaths];

  console.log(`📊 URLs collected:`);
  console.log(`   Static pages:  ${staticPaths.length}`);
  console.log(`   Competitions:  ${compPaths.length}`);
  console.log(`   Teams:         ${teamPaths.length}`);
  console.log(`   Articles:      ${articlePaths.length}`);
  console.log(`   Matches:       ${matchPaths.length}`);
  console.log(`   ─────────────────────`);
  console.log(`   Total:         ${allPaths.length}\n`);

  if (dryRun) {
    console.log("🏁 Dry run — sample URLs:");
    allPaths.slice(0, 20).forEach((p) => console.log(`   ${p}`));
    return;
  }

  // IndexNow: submit ALL URLs in both locales (no daily limit).
  // English URLs are at the root path; Spanish gets /es prefix.
  const indexNowPaths = [
    ...allPaths,
    ...allPaths.map((p) => `/es${p === "/" ? "" : p}`),
  ];
  console.log(`📡 Submitting ${indexNowPaths.length} URLs (en + es) to IndexNow (Bing/Yandex)...`);
  await submitUrlsToIndexNow(indexNowPaths);
  console.log("   ✅ IndexNow done\n");

  // Google Indexing API: submit top 200 (daily quota)
  // Prioritize: articles first (content), then matches, then teams, then static
  const googlePaths = [
    ...articlePaths,
    ...matchPaths,
    ...staticPaths,
    ...compPaths,
    ...teamPaths,
  ].slice(0, 200);

  console.log(`🔎 Submitting ${googlePaths.length} URLs to Google Indexing API...`);
  const result = await submitUrlsToGoogle(googlePaths);
  console.log(`   ✅ Submitted: ${result.submitted}`);
  if (result.errors.length > 0) {
    console.log(`   ⚠️  Errors: ${result.errors.length}`);
    result.errors.slice(0, 5).forEach((e) => console.log(`      ${e}`));
  }

  // Ping Google sitemap
  console.log("\n📌 Pinging Google sitemap refresh...");
  await pingGoogleSitemap();
  console.log("   ✅ Done");

  console.log("\n🎉 All indexing requests submitted!");
}

main().catch(console.error);
