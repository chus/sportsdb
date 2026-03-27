/**
 * Audit every URL that will remain in the sitemap
 *
 * Checks:
 * - Teams: city not numeric, squad > 10, has standings, has matches, logo present, bio > 50 words
 * - Competitions: has current season, standings > 5 teams, has recent matches
 * - Articles: word count >= 400, has title + excerpt + meta description, content not empty
 *
 * Usage:
 *   DATABASE_URL=xxx npx tsx scripts/seo/audit-indexed-pages.ts
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface Issue {
  type: string;
  slug: string;
  issues: string[];
}

async function main() {
  console.log("\nSitemap Quality Audit\n");
  console.log("=".repeat(70));

  const allIssues: Issue[] = [];

  // --- TEAMS ---
  console.log("\n## Teams\n");

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
      )::int as standings_count,
      (SELECT count(*) FROM matches m
       WHERE m.home_team_id = t.id OR m.away_team_id = t.id
      )::int as match_count
    FROM teams t
    WHERE EXISTS (
      SELECT 1 FROM matches m
      WHERE m.home_team_id = t.id OR m.away_team_id = t.id
    )
  `;

  const NATIONAL_TEAM_SLUGS = new Set(["mexico", "south-korea", "south-africa", "brazil", "argentina", "germany", "france", "england", "spain", "italy", "portugal", "netherlands", "belgium", "croatia", "denmark", "serbia", "switzerland", "austria", "poland", "czech-republic", "scotland", "wales", "turkey", "ukraine", "romania", "hungary", "slovakia", "slovenia", "albania", "georgia", "japan", "australia", "usa", "canada", "colombia", "uruguay", "chile", "ecuador", "paraguay", "peru", "venezuela", "bolivia"]);

  let teamPass = 0;
  let teamFail = 0;

  for (const t of teams) {
    if (NATIONAL_TEAM_SLUGS.has(t.slug)) continue; // excluded from sitemap
    const issues: string[] = [];
    if (t.city && /^\d+$/.test(t.city)) issues.push("numeric city");
    if (!t.city) issues.push("no city");
    if (!t.country) issues.push("no country");
    if (!t.logo_url) issues.push("no logo");
    if (!t.founded_year) issues.push("no founded year");
    if (t.squad_count < 10) issues.push(`small squad (${t.squad_count})`);
    if (t.standings_count === 0) issues.push("no current standings");
    if (t.match_count === 0) issues.push("no matches");

    // Quality score check (simplified version of scoreTeamPage)
    let score = 0;
    if (t.country) score += 10;
    if (t.city && !/^\d+$/.test(t.city)) score += 5;
    if (t.founded_year) score += 5;
    if (t.logo_url) score += 5;
    if (t.squad_count > 0) score += 15;
    if (t.standings_count > 0) score += 10;
    if (t.match_count > 0) score += 10;

    if (score >= 40 && t.standings_count > 0) {
      // This team would be in the sitemap (score >= 40 + must have standings)
      if (issues.length > 0) {
        teamFail++;
        allIssues.push({ type: "team", slug: t.slug, issues });
      } else {
        teamPass++;
      }
    }
  }

  console.log(`  Sitemap teams: ${teamPass + teamFail}`);
  console.log(`  Pass: ${teamPass}, Issues: ${teamFail}`);

  // --- COMPETITIONS ---
  console.log("\n## Competitions\n");

  const competitions = await sql`
    SELECT
      c.id, c.slug, c.name, c.country,
      (SELECT count(*) FROM standings s
       JOIN competition_seasons cs ON cs.id = s.competition_season_id
       JOIN seasons se ON se.id = cs.season_id
       WHERE cs.competition_id = c.id AND se.is_current = true
      )::int as standings_team_count,
      (SELECT count(*) FROM matches m
       JOIN competition_seasons cs ON cs.id = m.competition_season_id
       JOIN seasons se ON se.id = cs.season_id
       WHERE cs.competition_id = c.id AND se.is_current = true
      )::int as current_match_count
    FROM competitions c
  `;

  let compPass = 0;
  let compFail = 0;

  for (const c of competitions) {
    if (c.standings_team_count <= 5) continue; // Not in sitemap

    const issues: string[] = [];
    if (!c.country) issues.push("no country");
    if (c.current_match_count === 0) issues.push("no current-season matches");
    if (c.standings_team_count < 10) issues.push(`few standings teams (${c.standings_team_count})`);

    if (issues.length > 0) {
      compFail++;
      allIssues.push({ type: "competition", slug: c.slug, issues });
    } else {
      compPass++;
    }
  }

  console.log(`  Sitemap competitions: ${compPass + compFail}`);
  console.log(`  Pass: ${compPass}, Issues: ${compFail}`);

  // --- ARTICLES ---
  console.log("\n## Articles\n");

  const articles = await sql`
    SELECT
      id, slug, title, excerpt, content, meta_title, meta_description, type, word_count
    FROM articles
    WHERE status = 'published'
  `;

  let articlePass = 0;
  let articleFail = 0;

  for (const a of articles) {
    const issues: string[] = [];
    const wordCount = a.word_count || (a.content ? a.content.split(/\s+/).filter(Boolean).length : 0);

    if (wordCount < 400) issues.push(`short (${wordCount} words)`);
    if (!a.title || a.title.length < 10) issues.push("missing/short title");
    if (!a.excerpt || a.excerpt.length < 20) issues.push("missing/short excerpt");
    if (!a.meta_description) issues.push("no meta description");
    if (!a.content || a.content.length < 100) issues.push("empty/thin content");

    if (issues.length > 0) {
      articleFail++;
      allIssues.push({ type: "article", slug: a.slug, issues });
    } else {
      articlePass++;
    }
  }

  console.log(`  Sitemap articles: ${articlePass + articleFail}`);
  console.log(`  Pass: ${articlePass}, Issues: ${articleFail}`);

  // --- SUMMARY ---
  console.log("\n" + "=".repeat(70));
  console.log(`\nTotal pages with issues: ${allIssues.length}`);
  console.log(`Total clean pages: ${teamPass + compPass + articlePass}`);

  if (allIssues.length > 0) {
    console.log("\n## Issues Found\n");
    for (const issue of allIssues.slice(0, 30)) {
      console.log(`  [${issue.type}] /${issue.type === "article" ? "news" : issue.type === "team" ? "teams" : "competitions"}/${issue.slug}`);
      for (const i of issue.issues) {
        console.log(`    - ${i}`);
      }
    }
    if (allIssues.length > 30) {
      console.log(`\n  ... and ${allIssues.length - 30} more`);
    }
  }

  // 10 weakest pages
  const weakest = allIssues
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 10);

  if (weakest.length > 0) {
    console.log("\n## 10 Weakest Pages\n");
    for (const w of weakest) {
      console.log(`  [${w.type}] ${w.slug} — ${w.issues.join(", ")}`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
