/**
 * Match SportsDB teams to Wikidata entities and enrich data
 *
 * Strategy: Pre-fetch all football clubs per country from Wikidata,
 * then match locally by normalized name.
 *
 * Enriches: foundedYear, city, logoUrl (never overwrites existing values)
 *
 * Usage:
 *   npx tsx scripts/wikidata/enrich-teams.ts
 *   npx tsx scripts/wikidata/enrich-teams.ts --dry-run
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { sparqlQuery, val, qid } from "./sparql";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// Map country names to Wikidata Q-IDs
// Map country names to Wikidata Q-IDs for P17 (country) property
// English/Scottish clubs use P17=Q145 (UK), so we map both to UK
const COUNTRY_QID: Record<string, string[]> = {
  England: ["Q21", "Q145"],  // England OR United Kingdom
  Scotland: ["Q22", "Q145"],
  "United Kingdom": ["Q145"],
  Germany: ["Q183"],
  France: ["Q142"],
  Spain: ["Q29"],
  Italy: ["Q38"],
  Brazil: ["Q155"],
  Argentina: ["Q414"],
  Portugal: ["Q45"],
  Netherlands: ["Q55"],
  Belgium: ["Q31"],
  Turkey: ["Q43"],
  USA: ["Q30"], "United States": ["Q30"],
  Mexico: ["Q96"],
  Colombia: ["Q739"],
  Chile: ["Q298"],
  Uruguay: ["Q77"],
  Paraguay: ["Q733"],
  Bolivia: ["Q750"],
  Venezuela: ["Q717"],
};

interface DbTeam {
  id: string;
  name: string;
  short_name: string | null;
  country: string;
  city: string | null;
  founded_year: number | null;
  wikidata_id: string | null;
  logo_url: string | null;
}

async function main() {
  console.log(`\n🏟️  Wikidata Team Enrichment${dryRun ? " (DRY RUN)" : ""}\n`);

  const teams: DbTeam[] = await sql`
    SELECT id, name, short_name, country, city, founded_year, wikidata_id, logo_url
    FROM teams
    WHERE wikidata_id IS NULL
    ORDER BY country, name
  `;

  console.log(`${teams.length} teams without Wikidata ID`);

  // Group by country
  const byCountry = new Map<string, DbTeam[]>();
  for (const t of teams) {
    const existing = byCountry.get(t.country) || [];
    existing.push(t);
    byCountry.set(t.country, existing);
  }

  let matched = 0;
  let enriched = 0;
  let countryIdx = 0;

  for (const [country, countryTeams] of byCountry) {
    countryIdx++;
    const countryQids = COUNTRY_QID[country];
    if (!countryQids) {
      console.log(`  Skipping ${country} (no QID mapping)`);
      continue;
    }

    // Query all football clubs in this country (handle multiple QIDs with VALUES)
    const countryValues = countryQids.map((q) => `wd:${q}`).join(" ");
    const query = `
      SELECT ?item ?itemLabel ?inception ?locationLabel ?logo WHERE {
        VALUES ?country { ${countryValues} }
        ?item wdt:P31/wdt:P279* wd:Q476028 .
        ?item wdt:P17 ?country .
        OPTIONAL { ?item wdt:P571 ?inception . }
        OPTIONAL { ?item wdt:P131 ?location . }
        OPTIONAL { ?item wdt:P154 ?logo . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Build name → result lookup
      const wdLookup = new Map<string, typeof results[0]>();
      for (const r of results) {
        const label = val(r, "itemLabel");
        if (label) {
          wdLookup.set(normalize(label), r);
        }
      }

      for (const team of countryTeams) {
        const normName = normalize(team.name);
        const normShort = team.short_name ? normalize(team.short_name) : null;

        // Try full name, then short name
        let r = wdLookup.get(normName) || (normShort ? wdLookup.get(normShort) : undefined);

        // Try without common suffixes (FC, AFC, etc.)
        if (!r) {
          const stripped = normName.replace(/\b(fc|afc|sc|cf|ssc|fk|bk)\b/g, "").trim().replace(/\s+/g, " ");
          r = wdLookup.get(stripped);
        }

        // Try substring match (e.g. "Manchester United" in "Manchester United FC")
        if (!r) {
          for (const [wdName, wdResult] of wdLookup) {
            if (wdName.includes(normName) || normName.includes(wdName)) {
              r = wdResult;
              break;
            }
          }
        }

        if (!r) continue;

        const wikidataId = qid(val(r, "item")!);
        const inceptionStr = val(r, "inception");
        const foundedYear = inceptionStr ? parseInt(inceptionStr.substring(0, 4), 10) : null;
        const city = val(r, "locationLabel");
        const logo = val(r, "logo");

        matched++;

        const updates: string[] = [];
        if (!team.founded_year && foundedYear && foundedYear > 1800 && foundedYear < 2030) updates.push("foundedYear");
        if (!team.city && city) updates.push("city");
        if (!team.logo_url && logo) updates.push("logo");

        if (!dryRun) {
          await sql`
            UPDATE teams SET
              wikidata_id = ${wikidataId},
              founded_year = COALESCE(founded_year, ${foundedYear && foundedYear > 1800 && foundedYear < 2030 ? foundedYear : null}),
              city = COALESCE(city, ${city}),
              logo_url = COALESCE(logo_url, ${logo}),
              updated_at = NOW()
            WHERE id = ${team.id}
          `;
        }

        if (updates.length > 0) enriched++;
      }

      console.log(`  ${country}: ${results.length} WD clubs, matched ${countryTeams.filter((t) => !t.wikidata_id).length > 0 ? "" : "all "}teams`);
    } catch (err) {
      console.error(`  Error for ${country}: ${(err as Error).message}`);
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log(`  Matched:   ${matched}`);
  console.log(`  Enriched:  ${enriched}`);
  console.log("═══════════════════════════════════════\n");
}

main().catch(console.error);
