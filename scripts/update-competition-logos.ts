/**
 * Update competition logos
 * Uses Wikipedia Commons URLs for major leagues
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

const COMPETITION_LOGOS: Record<string, string> = {
  "premier-league":
    "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg",
  "la-liga":
    "https://upload.wikimedia.org/wikipedia/commons/5/54/LaLiga_EA_Sports_2023_Vertical_Logo.svg",
  bundesliga:
    "https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg",
  "serie-a":
    "https://upload.wikimedia.org/wikipedia/commons/e/e9/Serie_A_logo_2022.svg",
  "ligue-1":
    "https://upload.wikimedia.org/wikipedia/en/c/c7/Ligue1_Uber_Eats_logo.svg",
  eredivisie:
    "https://upload.wikimedia.org/wikipedia/commons/0/0f/Eredivisie_nuovo_logo.png",
  "primeira-liga":
    "https://upload.wikimedia.org/wikipedia/commons/0/0e/Liga_Portugal_logo.png",
  mls: "https://upload.wikimedia.org/wikipedia/commons/7/76/MLS_crest_logo_RGB_gradient.svg",
  "brasileirao-serie-a":
    "https://upload.wikimedia.org/wikipedia/pt/4/42/Campeonato_Brasileiro_S%C3%A9rie_A_logo.png",
  "liga-mx":
    "https://upload.wikimedia.org/wikipedia/commons/9/96/Liga_MX_logo.svg",
  "liga-profesional-argentina":
    "https://upload.wikimedia.org/wikipedia/commons/6/61/Liga_Profesional_de_F%C3%BAtbol_%28Argentina%29_-_2021.svg",
  "liga-betplay":
    "https://upload.wikimedia.org/wikipedia/commons/4/48/Liga_BetPlay_DIMAYOR.svg",
  "liga-1-peru":
    "https://upload.wikimedia.org/wikipedia/commons/a/a7/Liga_1_de_F%C3%BAtbol_Profesional.svg",
  "liga-pro-ecuador":
    "https://upload.wikimedia.org/wikipedia/commons/c/c1/LigaPro_de_Ecuador.svg",
  "primera-division-de-chile":
    "https://upload.wikimedia.org/wikipedia/commons/7/70/Chilean_Primera_Divisi%C3%B3n_logo.svg",
  "primera-division-de-uruguay":
    "https://upload.wikimedia.org/wikipedia/commons/1/1e/Primera_Divisi%C3%B3n_de_Uruguay.png",
  "primera-division-de-paraguay":
    "https://upload.wikimedia.org/wikipedia/commons/6/6c/Division_de_Honor_Paraguay.png",
  "primera-division-de-bolivia":
    "https://upload.wikimedia.org/wikipedia/commons/c/ca/Divisi%C3%B3n_Profesional_Bolivia.png",
  "primera-division-de-venezuela":
    "https://upload.wikimedia.org/wikipedia/en/7/78/Liga_FUTVE.svg",
};

async function main() {
  console.log("Updating competition logos...\n");

  let updated = 0;
  for (const [slug, logoUrl] of Object.entries(COMPETITION_LOGOS)) {
    const result = await sql`
      UPDATE competitions
      SET logo_url = ${logoUrl}
      WHERE slug = ${slug} AND logo_url IS NULL
      RETURNING name
    `;

    if (result.length > 0) {
      console.log(`  ✓ ${result[0].name}`);
      updated++;
    }
  }

  console.log(`\nUpdated ${updated} competition logos`);
}

main().catch(console.error);
