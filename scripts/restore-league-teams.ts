/**
 * Recreate league teams that are missing from the teams table.
 *
 * For every covered league, fetch the current standings from
 * football-data.org and create a teams row for any club the
 * findTeamByName matcher can't resolve. Names, short names, crests,
 * and country come from the API.
 *
 * Written after the SEO cleanup scripts (cleanup-garbage-teams.ts)
 * over-matched and deleted 9 legitimate La Liga clubs (Atlético Madrid,
 * Real Betis, Athletic Club, ...) plus clubs in other leagues — their
 * naming patterns ("Club Atlético de...", "Real ...") tripped the
 * person-name / national-team heuristics. Safe to re-run any time;
 * existing teams are never touched.
 *
 * Usage: npx tsx scripts/restore-league-teams.ts [--dry-run]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { findTeamByName } from "../src/lib/seo/team-matcher";

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) {
  console.error("FOOTBALL_DATA_API_KEY environment variable is required");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

const LEAGUES: Record<string, string> = {
  PL: "England",
  PD: "Spain",
  BL1: "Germany",
  SA: "Italy",
  FL1: "France",
  DED: "Netherlands",
  PPL: "Portugal",
  ELC: "England",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  let created = 0;

  for (const [code, country] of Object.entries(LEAGUES)) {
    console.log(`\n--- ${code} (${country}) ---`);
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${code}/standings`,
      { headers: { "X-Auth-Token": API_KEY! } },
    );
    if (!res.ok) {
      console.warn(`  api ${res.status}, skipping`);
      await new Promise((r) => setTimeout(r, 6500));
      continue;
    }
    const data = await res.json();
    const table = data.standings?.[0]?.table ?? [];

    for (const entry of table) {
      const t = entry.team;
      const hit = await findTeamByName(sql, t.name);
      if (hit) continue;

      const slug = slugify(t.name);
      console.log(`  + creating "${t.name}" (${slug})`);
      if (!DRY_RUN) {
        await sql`
          INSERT INTO teams (external_id, name, short_name, slug, country, logo_url, team_type)
          VALUES (${`fd-team-${t.id}`}, ${t.name}, ${t.shortName}, ${slug}, ${country}, ${t.crest}, 'club')
          ON CONFLICT (slug) DO NOTHING
        `;
      }
      created++;
    }
    await new Promise((r) => setTimeout(r, 6500));
  }

  console.log(`\n${DRY_RUN ? "[dry-run] would create" : "created"} ${created} teams`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
