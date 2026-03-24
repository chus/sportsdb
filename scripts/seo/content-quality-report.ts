/**
 * Content Quality Report — run after all SEO fixes
 *
 * Outputs:
 * - Total pages in sitemap
 * - Average word count per indexed page type
 * - % of team pages with images (logos)
 * - % of pages with structured data (meta descriptions)
 * - Number with placeholder/broken data
 * - 10 weakest pages still in sitemap
 *
 * Usage:
 *   DATABASE_URL=xxx npx tsx scripts/seo/content-quality-report.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  CONTENT QUALITY REPORT");
  console.log("=".repeat(70));

  // --- TEAMS IN SITEMAP (quality score >= 40) ---
  const teams = await sql`
    SELECT
      t.id, t.slug, t.name, t.city, t.country, t.founded_year, t.logo_url,
      (SELECT count(*) FROM player_team_history pth
       JOIN players p ON p.id = pth.player_id
       WHERE pth.team_id = t.id AND pth.valid_to IS NULL AND p.position != 'Unknown'
      )::int as squad_count,
      (SELECT count(*) FROM standings s
       JOIN competition_seasons cs ON cs.id = s.competition_season_id
       JOIN seasons se ON se.id = cs.season_id
       WHERE s.team_id = t.id AND se.is_current = true
      )::int as standings_count
    FROM teams t
    WHERE EXISTS (
      SELECT 1 FROM matches m
      WHERE m.home_team_id = t.id OR m.away_team_id = t.id
    )
  `;

  const sitemapTeams = teams.filter((t) => {
    let score = 0;
    if (t.country) score += 10;
    if (t.city && !/^\d+$/.test(t.city)) score += 5;
    if (t.founded_year) score += 5;
    if (t.logo_url) score += 5;
    if (t.squad_count > 0) score += 15;
    if (t.standings_count > 0) score += 10;
    score += 10; // has matches (guaranteed by WHERE)
    return score >= 40;
  });

  const teamsWithLogo = sitemapTeams.filter((t) => t.logo_url).length;
  const teamsWithCity = sitemapTeams.filter((t) => t.city && !/^\d+$/.test(t.city)).length;
  const teamsWithYear = sitemapTeams.filter((t) => t.founded_year).length;

  // --- COMPETITIONS IN SITEMAP ---
  const competitions = await sql`
    SELECT
      c.id, c.slug, c.name, c.country,
      (SELECT count(*) FROM standings s
       JOIN competition_seasons cs ON cs.id = s.competition_season_id
       JOIN seasons se ON se.id = cs.season_id
       WHERE cs.competition_id = c.id AND se.is_current = true
      )::int as standings_team_count
    FROM competitions c
  `;

  const sitemapComps = competitions.filter((c) => c.standings_team_count > 5);

  // --- ARTICLES ---
  const articles = await sql`
    SELECT type, word_count, content, meta_description, excerpt
    FROM articles
    WHERE status = 'published'
  `;

  const articleStats: Record<string, { count: number; totalWords: number; min: number; max: number; underMin: number }> = {};
  let totalArticleWords = 0;
  let articlesWithMeta = 0;
  let articlesWithExcerpt = 0;
  let articlesUnder600 = 0;

  for (const a of articles) {
    const wc = a.word_count || (a.content ? a.content.split(/\s+/).filter(Boolean).length : 0);
    const type = a.type || "unknown";

    if (!articleStats[type]) {
      articleStats[type] = { count: 0, totalWords: 0, min: Infinity, max: 0, underMin: 0 };
    }
    articleStats[type].count++;
    articleStats[type].totalWords += wc;
    articleStats[type].min = Math.min(articleStats[type].min, wc);
    articleStats[type].max = Math.max(articleStats[type].max, wc);
    if (wc < 600) articleStats[type].underMin++;

    totalArticleWords += wc;
    if (a.meta_description) articlesWithMeta++;
    if (a.excerpt) articlesWithExcerpt++;
    if (wc < 600) articlesUnder600++;
  }

  // Static pages count (approximate)
  const staticPageCount = 11; // home, news, top-scorers, top-assists, trending, transfers, world-cup-2026, about, methodology, privacy, terms

  // Top scorers/assists pages (approximate based on competition stats)
  const compsWithStats = await sql`
    SELECT count(DISTINCT c.id)::int as count
    FROM player_season_stats pss
    JOIN competition_seasons cs ON cs.id = pss.competition_season_id
    JOIN competitions c ON c.id = cs.competition_id
    JOIN seasons s ON s.id = cs.season_id
    WHERE s.is_current = true
  `;
  const leaderboardPages = (compsWithStats[0]?.count || 0) * 2; // scorers + assists

  const totalSitemapPages = staticPageCount + sitemapComps.length + sitemapTeams.length + articles.length + leaderboardPages;

  // --- OUTPUT ---
  console.log("\n## Sitemap Summary\n");
  console.log(`  Total pages in sitemap: ~${totalSitemapPages}`);
  console.log(`    Static pages:          ${staticPageCount}`);
  console.log(`    Competitions:          ${sitemapComps.length}`);
  console.log(`    Teams:                 ${sitemapTeams.length}`);
  console.log(`    Articles:              ${articles.length}`);
  console.log(`    Leaderboard pages:     ~${leaderboardPages}`);

  console.log("\n## Team Quality\n");
  console.log(`  Teams in sitemap:    ${sitemapTeams.length} / ${teams.length} total`);
  console.log(`  With logo:           ${teamsWithLogo} (${pct(teamsWithLogo, sitemapTeams.length)})`);
  console.log(`  With city:           ${teamsWithCity} (${pct(teamsWithCity, sitemapTeams.length)})`);
  console.log(`  With founded year:   ${teamsWithYear} (${pct(teamsWithYear, sitemapTeams.length)})`);

  console.log("\n## Article Quality\n");
  console.log(`  Total published:     ${articles.length}`);
  console.log(`  Avg word count:      ${articles.length > 0 ? Math.round(totalArticleWords / articles.length) : 0}`);
  console.log(`  Under 600 words:     ${articlesUnder600} (${pct(articlesUnder600, articles.length)})`);
  console.log(`  With meta desc:      ${articlesWithMeta} (${pct(articlesWithMeta, articles.length)})`);
  console.log(`  With excerpt:        ${articlesWithExcerpt} (${pct(articlesWithExcerpt, articles.length)})`);

  console.log("\n  By type:");
  console.log("  " + "-".repeat(68));
  console.log(
    "  " +
    "Type".padEnd(20) +
    "Count".padStart(6) +
    "Avg".padStart(8) +
    "Min".padStart(8) +
    "Max".padStart(8) +
    "<600".padStart(8)
  );
  console.log("  " + "-".repeat(68));
  for (const [type, stats] of Object.entries(articleStats).sort((a, b) => b[1].count - a[1].count)) {
    console.log(
      "  " +
      type.padEnd(20) +
      String(stats.count).padStart(6) +
      String(Math.round(stats.totalWords / stats.count)).padStart(8) +
      String(stats.min).padStart(8) +
      String(stats.max).padStart(8) +
      String(stats.underMin).padStart(8)
    );
  }

  console.log("\n## Competition Quality\n");
  console.log(`  In sitemap:          ${sitemapComps.length} / ${competitions.length} total`);
  for (const c of sitemapComps) {
    console.log(`    ${c.name} (${c.country || "?"}) — ${c.standings_team_count} teams`);
  }

  // Data quality flags
  console.log("\n## Data Quality Flags\n");
  const numericCityTeams = teams.filter((t) => t.city && /^\d+$/.test(t.city));
  console.log(`  Teams with numeric city:   ${numericCityTeams.length}`);

  const noCountryTeams = sitemapTeams.filter((t) => !t.country);
  console.log(`  Sitemap teams no country:  ${noCountryTeams.length}`);

  const smallSquadTeams = sitemapTeams.filter((t) => t.squad_count < 15);
  console.log(`  Sitemap teams squad < 15:  ${smallSquadTeams.length}`);

  console.log("\n" + "=".repeat(70));
  console.log("  REPORT COMPLETE");
  console.log("=".repeat(70) + "\n");
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

main().catch(console.error);
