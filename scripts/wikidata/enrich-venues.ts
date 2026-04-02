/**
 * Match SportsDB venues to Wikidata entities and enrich data
 *
 * Strategy: Pre-fetch all football stadiums per country from Wikidata,
 * then match locally by normalized name.
 *
 * Enriches: wikidataId, capacity, openedYear, imageUrl, latitude, longitude, wikipediaUrl
 * Never overwrites existing non-null values.
 *
 * Usage:
 *   npx tsx scripts/wikidata/enrich-venues.ts
 *   npx tsx scripts/wikidata/enrich-venues.ts --dry-run
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
const COUNTRY_QID: Record<string, string[]> = {
  England: ["Q21", "Q145"],
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
  Venezuela: ["Q717"],
  Denmark: ["Q35"],
  Sweden: ["Q34"],
  Norway: ["Q20"],
  Poland: ["Q36"],
  Austria: ["Q40"],
  Switzerland: ["Q39"],
  "Czech Republic": ["Q213"], Czechia: ["Q213"],
  Croatia: ["Q224"],
  Serbia: ["Q403"],
  Ukraine: ["Q212"],
  Romania: ["Q218"],
  Hungary: ["Q28"],
  Greece: ["Q41"],
  Bulgaria: ["Q219"],
  Japan: ["Q17"],
  "South Korea": ["Q884"],
  Australia: ["Q408"],
  China: ["Q148"],
  "Saudi Arabia": ["Q851"],
  Morocco: ["Q1028"],
  Nigeria: ["Q1033"],
  Egypt: ["Q79"],
  "South Africa": ["Q258"],
};

interface DbVenue {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  capacity: number | null;
  opened_year: number | null;
  image_url: string | null;
  latitude: string | null;
  longitude: string | null;
  wikidata_id: string | null;
  wikipedia_url: string | null;
}

async function main() {
  console.log(`\n🏟️  Wikidata Venue Enrichment${dryRun ? " (DRY RUN)" : ""}\n`);

  const venues: DbVenue[] = await sql`
    SELECT id, name, city, country, capacity, opened_year, image_url,
           latitude, longitude, wikidata_id, wikipedia_url
    FROM venues
    WHERE wikidata_id IS NULL
    ORDER BY country, name
  `;

  console.log(`${venues.length} venues without Wikidata ID`);

  // Group by country
  const byCountry = new Map<string, DbVenue[]>();
  for (const v of venues) {
    const country = v.country || "Unknown";
    const existing = byCountry.get(country) || [];
    existing.push(v);
    byCountry.set(country, existing);
  }

  let matched = 0;
  let enriched = 0;
  let countryIdx = 0;

  for (const [country, countryVenues] of byCountry) {
    countryIdx++;
    const countryQids = COUNTRY_QID[country];
    if (!countryQids) {
      console.log(`  Skipping ${country} (no QID mapping)`);
      continue;
    }

    // Query stadiums in this country
    // Q483110 = stadium, Q1076486 = sports venue — covers most football grounds
    const countryValues = countryQids.map((q) => `wd:${q}`).join(" ");
    const query = `
      SELECT ?item ?itemLabel ?capacity ?inception ?image ?lat ?lon ?wikipedia WHERE {
        VALUES ?country { ${countryValues} }
        {
          ?item wdt:P31/wdt:P279* wd:Q483110 .
        } UNION {
          ?item wdt:P31/wdt:P279* wd:Q1076486 .
        }
        ?item wdt:P17 ?country .
        OPTIONAL { ?item wdt:P1083 ?capacity . }
        OPTIONAL { ?item wdt:P571 ?inception . }
        OPTIONAL { ?item wdt:P18 ?image . }
        OPTIONAL {
          ?item p:P625 ?coordStatement .
          ?coordStatement psv:P625 ?coordValue .
          ?coordValue wikibase:geoLatitude ?lat ;
                      wikibase:geoLongitude ?lon .
        }
        OPTIONAL {
          ?wikipedia schema:about ?item ;
                    schema:isPartOf <https://en.wikipedia.org/> .
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
      }
    `;

    try {
      const results = await sparqlQuery(query);

      // Build name → merged result lookup
      const wdLookup = new Map<string, {
        wikidataId: string;
        capacity: number | null;
        openedYear: number | null;
        image: string | null;
        lat: number | null;
        lon: number | null;
        wikipedia: string | null;
      }>();

      for (const r of results) {
        const label = val(r, "itemLabel");
        if (!label) continue;
        const normLabel = normalize(label);
        if (wdLookup.has(normLabel)) continue; // keep first match

        const capacityStr = val(r, "capacity");
        const inceptionStr = val(r, "inception");
        const openedYear = inceptionStr ? parseInt(inceptionStr.substring(0, 4), 10) : null;
        const latStr = val(r, "lat");
        const lonStr = val(r, "lon");

        wdLookup.set(normLabel, {
          wikidataId: qid(val(r, "item")!),
          capacity: capacityStr ? parseInt(capacityStr, 10) : null,
          openedYear: openedYear && openedYear > 1800 && openedYear < 2030 ? openedYear : null,
          image: val(r, "image"),
          lat: latStr ? parseFloat(latStr) : null,
          lon: lonStr ? parseFloat(lonStr) : null,
          wikipedia: val(r, "wikipedia"),
        });
      }

      for (const venue of countryVenues) {
        const normName = normalize(venue.name);

        // Try exact match
        let data = wdLookup.get(normName);

        // Try without common suffixes (stadium, arena, ground, park, etc.)
        if (!data) {
          const stripped = normName
            .replace(/\b(stadium|arena|ground|park|field|centre|center)\b/g, "")
            .trim()
            .replace(/\s+/g, " ");
          if (stripped.length > 2) data = wdLookup.get(stripped);
        }

        // Try substring match
        if (!data) {
          for (const [wdName, wdData] of wdLookup) {
            if (wdName.includes(normName) || normName.includes(wdName)) {
              data = wdData;
              break;
            }
          }
        }

        if (!data) continue;

        matched++;

        const updates: string[] = [];
        if (!venue.capacity && data.capacity) updates.push("capacity");
        if (!venue.opened_year && data.openedYear) updates.push("openedYear");
        if (!venue.image_url && data.image) updates.push("image");
        if (!venue.latitude && data.lat) updates.push("coords");
        if (!venue.wikipedia_url && data.wikipedia) updates.push("wikipedia");

        if (updates.length > 0) enriched++;

        if (!dryRun) {
          await sql`
            UPDATE venues SET
              wikidata_id = ${data.wikidataId},
              capacity = COALESCE(capacity, ${data.capacity}),
              opened_year = COALESCE(opened_year, ${data.openedYear}),
              image_url = COALESCE(image_url, ${data.image}),
              latitude = COALESCE(latitude, ${data.lat ? String(data.lat) : null}),
              longitude = COALESCE(longitude, ${data.lon ? String(data.lon) : null}),
              wikipedia_url = COALESCE(wikipedia_url, ${data.wikipedia}),
              updated_at = NOW()
            WHERE id = ${venue.id}
          `;
        }

        if (dryRun && updates.length > 0) {
          console.log(`  [DRY] ${venue.name} → ${data.wikidataId} (${updates.join(", ")})`);
        }
      }

      console.log(`  ${country}: ${results.length} WD stadiums, matched ${matched} venues`);
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
