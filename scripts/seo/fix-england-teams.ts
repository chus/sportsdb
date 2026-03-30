/**
 * Fix England team data: replace garbage city values and add Wikidata IDs
 *
 * Part A: Hardcoded city lookup for Premier League teams
 * Part B: Targeted Wikidata SPARQL queries per team (avoids bulk UK timeout)
 *
 * Usage:
 *   npx tsx scripts/seo/fix-england-teams.ts --dry-run
 *   npx tsx scripts/seo/fix-england-teams.ts
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { sparqlQuery, val, qid } from "../wikidata/sparql";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const dryRun = process.argv.includes("--dry-run");

// Hardcoded city values for England teams
const ENGLAND_CITIES: Record<string, string> = {
  "AFC Bournemouth": "Bournemouth",
  "Arsenal F.C.": "London",
  "Aston Villa F.C.": "Birmingham",
  "Brentford F.C.": "London",
  "Brighton & Hove Albion F.C.": "Brighton",
  "Chelsea F.C.": "London",
  "Crystal Palace F.C.": "London",
  "Everton F.C.": "Liverpool",
  "Fulham F.C.": "London",
  "Ipswich Town F.C.": "Ipswich",
  "Leicester City F.C.": "Leicester",
  "Liverpool F.C.": "Liverpool",
  "Manchester City F.C.": "Manchester",
  "Manchester United F.C.": "Manchester",
  "Newcastle United F.C.": "Newcastle upon Tyne",
  "Nottingham Forest F.C.": "Nottingham",
  "Southampton F.C.": "Southampton",
  "Tottenham Hotspur F.C.": "London",
  "West Ham United F.C.": "London",
  "Wolverhampton Wanderers F.C.": "Wolverhampton",
  // Championship / additional
  "Leeds United F.C.": "Leeds",
  "Sheffield United F.C.": "Sheffield",
  "Burnley F.C.": "Burnley",
  "Sunderland A.F.C.": "Sunderland",
  "Middlesbrough F.C.": "Middlesbrough",
  "Norwich City F.C.": "Norwich",
  "Watford F.C.": "Watford",
  "West Bromwich Albion F.C.": "West Bromwich",
  "Luton Town F.C.": "Luton",
  "Coventry City F.C.": "Coventry",
};

// Wikidata search labels for England teams (without F.C. suffix for better matching)
const WIKIDATA_SEARCH: Record<string, string> = {
  "AFC Bournemouth": "AFC Bournemouth",
  "Arsenal F.C.": "Arsenal F.C.",
  "Aston Villa F.C.": "Aston Villa F.C.",
  "Brentford F.C.": "Brentford F.C.",
  "Brighton & Hove Albion F.C.": "Brighton & Hove Albion F.C.",
  "Chelsea F.C.": "Chelsea F.C.",
  "Crystal Palace F.C.": "Crystal Palace F.C.",
  "Everton F.C.": "Everton F.C.",
  "Fulham F.C.": "Fulham F.C.",
  "Ipswich Town F.C.": "Ipswich Town F.C.",
  "Leicester City F.C.": "Leicester City F.C.",
  "Liverpool F.C.": "Liverpool F.C.",
  "Manchester City F.C.": "Manchester City F.C.",
  "Manchester United F.C.": "Manchester United F.C.",
  "Newcastle United F.C.": "Newcastle United F.C.",
  "Nottingham Forest F.C.": "Nottingham Forest F.C.",
  "Southampton F.C.": "Southampton F.C.",
  "Tottenham Hotspur F.C.": "Tottenham Hotspur F.C.",
  "West Ham United F.C.": "West Ham United F.C.",
  "Wolverhampton Wanderers F.C.": "Wolverhampton Wanderers F.C.",
};

async function main() {
  console.log(`\nEngland Team Fix${dryRun ? " (DRY RUN)" : ""}\n`);

  // Get all real England teams (not national teams, those should be deleted first)
  const teams = await sql`
    SELECT id, name, city, wikidata_id, founded_year, logo_url
    FROM teams WHERE country = 'England'
    ORDER BY name
  `;

  console.log(`${teams.length} England teams found\n`);

  let citiesFixed = 0;
  let wdMatched = 0;
  let logosAdded = 0;

  for (const team of teams) {
    const updates: string[] = [];

    // Part A: Fix city
    const correctCity = ENGLAND_CITIES[team.name];
    const cityIsGarbage = !team.city || /^\d+$/.test(team.city) || team.city.includes(".mw-parser");
    if (correctCity && cityIsGarbage) {
      updates.push(`city=${correctCity}`);
      citiesFixed++;
    }

    // Part B: Wikidata lookup
    let wikidataId = team.wikidata_id;
    let foundedYear = team.founded_year;
    let logoUrl = team.logo_url;

    if (!wikidataId) {
      const searchLabel = WIKIDATA_SEARCH[team.name] || team.name;
      // Escape quotes for SPARQL
      const escaped = searchLabel.replace(/"/g, '\\"');

      const query = `
        SELECT ?item ?itemLabel ?inception ?locationLabel ?logo WHERE {
          ?item rdfs:label "${escaped}"@en .
          ?item wdt:P31/wdt:P279* wd:Q476028 .
          OPTIONAL { ?item wdt:P571 ?inception . }
          OPTIONAL { ?item wdt:P131 ?location . }
          OPTIONAL { ?item wdt:P154 ?logo . }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
        } LIMIT 3
      `;

      try {
        const results = await sparqlQuery(query);
        if (results.length > 0) {
          const r = results[0];
          wikidataId = qid(val(r, "item")!);
          const inception = val(r, "inception");
          if (!foundedYear && inception) {
            const yr = parseInt(inception.substring(0, 4), 10);
            if (yr > 1800 && yr < 2030) foundedYear = yr;
          }
          const logo = val(r, "logo");
          if (!logoUrl && logo) logoUrl = logo;

          updates.push(`wikidata=${wikidataId}`);
          wdMatched++;
          if (logo && !team.logo_url) {
            updates.push("logo");
            logosAdded++;
          }
        } else {
          console.log(`  ✗ ${team.name}: no Wikidata match`);
        }
      } catch (err) {
        console.log(`  ✗ ${team.name}: SPARQL error - ${(err as Error).message}`);
      }
    }

    if (updates.length > 0) {
      console.log(`  ✓ ${team.name}: ${updates.join(", ")}`);
      if (!dryRun) {
        const newCity = correctCity && cityIsGarbage ? correctCity : team.city;
        await sql`
          UPDATE teams SET
            city = ${newCity},
            wikidata_id = ${wikidataId},
            founded_year = ${foundedYear},
            logo_url = COALESCE(logo_url, ${logoUrl}),
            updated_at = NOW()
          WHERE id = ${team.id}
        `;
      }
    }
  }

  console.log(`\n${"═".repeat(40)}`);
  console.log(`  Cities fixed:    ${citiesFixed}`);
  console.log(`  Wikidata matched: ${wdMatched}`);
  console.log(`  Logos added:     ${logosAdded}`);
  console.log(`${"═".repeat(40)}\n`);
}

main().catch(console.error);
