/**
 * Seed Additional Competitions
 *
 * Adds La Liga, Bundesliga, Serie A, and Ligue 1 with their teams.
 *
 * Usage: npx tsx scripts/seed-competitions.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface CompetitionData {
  name: string;
  country: string;
  type: "league";
  foundedYear: number;
  teams: {
    name: string;
    shortName?: string;
    city: string;
    foundedYear?: number;
    primaryColor?: string;
  }[];
}

const COMPETITIONS: CompetitionData[] = [
  {
    name: "La Liga",
    country: "Spain",
    type: "league",
    foundedYear: 1929,
    teams: [
      { name: "Real Madrid", shortName: "Real Madrid", city: "Madrid", foundedYear: 1902, primaryColor: "#FFFFFF" },
      { name: "Barcelona", shortName: "Barca", city: "Barcelona", foundedYear: 1899, primaryColor: "#A50044" },
      { name: "Atletico Madrid", shortName: "Atleti", city: "Madrid", foundedYear: 1903, primaryColor: "#CB3524" },
      { name: "Sevilla FC", shortName: "Sevilla", city: "Seville", foundedYear: 1890, primaryColor: "#D40E17" },
      { name: "Real Betis", shortName: "Betis", city: "Seville", foundedYear: 1907, primaryColor: "#00954C" },
      { name: "Real Sociedad", shortName: "Real Sociedad", city: "San Sebastian", foundedYear: 1909, primaryColor: "#0067B1" },
      { name: "Athletic Bilbao", shortName: "Athletic", city: "Bilbao", foundedYear: 1898, primaryColor: "#EE2523" },
      { name: "Villarreal CF", shortName: "Villarreal", city: "Villarreal", foundedYear: 1923, primaryColor: "#FFE600" },
      { name: "Valencia CF", shortName: "Valencia", city: "Valencia", foundedYear: 1919, primaryColor: "#EE7F00" },
      { name: "Getafe CF", shortName: "Getafe", city: "Getafe", foundedYear: 1983, primaryColor: "#005999" },
      { name: "Celta Vigo", shortName: "Celta", city: "Vigo", foundedYear: 1923, primaryColor: "#8AC3EE" },
      { name: "Osasuna", shortName: "Osasuna", city: "Pamplona", foundedYear: 1920, primaryColor: "#D91A21" },
      { name: "Rayo Vallecano", shortName: "Rayo", city: "Madrid", foundedYear: 1924, primaryColor: "#E5231B" },
      { name: "Mallorca", shortName: "Mallorca", city: "Palma", foundedYear: 1916, primaryColor: "#E30613" },
      { name: "Girona FC", shortName: "Girona", city: "Girona", foundedYear: 1930, primaryColor: "#CD2E3A" },
      { name: "Las Palmas", shortName: "Las Palmas", city: "Las Palmas", foundedYear: 1949, primaryColor: "#FFD200" },
      { name: "Deportivo Alaves", shortName: "Alaves", city: "Vitoria-Gasteiz", foundedYear: 1921, primaryColor: "#0033A0" },
      { name: "Leganes", shortName: "Leganes", city: "Leganes", foundedYear: 1928, primaryColor: "#005BAA" },
      { name: "Espanyol", shortName: "Espanyol", city: "Barcelona", foundedYear: 1900, primaryColor: "#007FC8" },
      { name: "Real Valladolid", shortName: "Valladolid", city: "Valladolid", foundedYear: 1928, primaryColor: "#6C2D82" },
    ],
  },
  {
    name: "Bundesliga",
    country: "Germany",
    type: "league",
    foundedYear: 1963,
    teams: [
      { name: "Bayern Munich", shortName: "Bayern", city: "Munich", foundedYear: 1900, primaryColor: "#DC052D" },
      { name: "Borussia Dortmund", shortName: "Dortmund", city: "Dortmund", foundedYear: 1909, primaryColor: "#FDE100" },
      { name: "RB Leipzig", shortName: "Leipzig", city: "Leipzig", foundedYear: 2009, primaryColor: "#DD0741" },
      { name: "Bayer Leverkusen", shortName: "Leverkusen", city: "Leverkusen", foundedYear: 1904, primaryColor: "#E32221" },
      { name: "Eintracht Frankfurt", shortName: "Frankfurt", city: "Frankfurt", foundedYear: 1899, primaryColor: "#E1000F" },
      { name: "VfB Stuttgart", shortName: "Stuttgart", city: "Stuttgart", foundedYear: 1893, primaryColor: "#E32219" },
      { name: "Borussia Monchengladbach", shortName: "Gladbach", city: "Monchengladbach", foundedYear: 1900, primaryColor: "#000000" },
      { name: "VfL Wolfsburg", shortName: "Wolfsburg", city: "Wolfsburg", foundedYear: 1945, primaryColor: "#65B32E" },
      { name: "SC Freiburg", shortName: "Freiburg", city: "Freiburg", foundedYear: 1904, primaryColor: "#000000" },
      { name: "TSG Hoffenheim", shortName: "Hoffenheim", city: "Sinsheim", foundedYear: 1899, primaryColor: "#1C63B7" },
      { name: "Union Berlin", shortName: "Union Berlin", city: "Berlin", foundedYear: 1966, primaryColor: "#EB1923" },
      { name: "Werder Bremen", shortName: "Bremen", city: "Bremen", foundedYear: 1899, primaryColor: "#1D9053" },
      { name: "FC Augsburg", shortName: "Augsburg", city: "Augsburg", foundedYear: 1907, primaryColor: "#BA3733" },
      { name: "Mainz 05", shortName: "Mainz", city: "Mainz", foundedYear: 1905, primaryColor: "#C3141E" },
      { name: "FC Koln", shortName: "Koln", city: "Cologne", foundedYear: 1948, primaryColor: "#ED1C24" },
      { name: "Heidenheim", shortName: "Heidenheim", city: "Heidenheim", foundedYear: 1846, primaryColor: "#003D7C" },
      { name: "St. Pauli", shortName: "St. Pauli", city: "Hamburg", foundedYear: 1910, primaryColor: "#6D4C3D" },
      { name: "Holstein Kiel", shortName: "Kiel", city: "Kiel", foundedYear: 1900, primaryColor: "#003D7C" },
    ],
  },
  {
    name: "Serie A",
    country: "Italy",
    type: "league",
    foundedYear: 1898,
    teams: [
      { name: "Inter Milan", shortName: "Inter", city: "Milan", foundedYear: 1908, primaryColor: "#010E80" },
      { name: "AC Milan", shortName: "Milan", city: "Milan", foundedYear: 1899, primaryColor: "#FB090B" },
      { name: "Juventus", shortName: "Juve", city: "Turin", foundedYear: 1897, primaryColor: "#000000" },
      { name: "Napoli", shortName: "Napoli", city: "Naples", foundedYear: 1926, primaryColor: "#12A0D7" },
      { name: "AS Roma", shortName: "Roma", city: "Rome", foundedYear: 1927, primaryColor: "#8E1F2F" },
      { name: "Lazio", shortName: "Lazio", city: "Rome", foundedYear: 1900, primaryColor: "#87D8F7" },
      { name: "Atalanta", shortName: "Atalanta", city: "Bergamo", foundedYear: 1907, primaryColor: "#1E71B8" },
      { name: "Fiorentina", shortName: "Fiorentina", city: "Florence", foundedYear: 1926, primaryColor: "#482E92" },
      { name: "Bologna FC", shortName: "Bologna", city: "Bologna", foundedYear: 1909, primaryColor: "#1A2F48" },
      { name: "Torino FC", shortName: "Torino", city: "Turin", foundedYear: 1906, primaryColor: "#8B0000" },
      { name: "Udinese", shortName: "Udinese", city: "Udine", foundedYear: 1896, primaryColor: "#000000" },
      { name: "Genoa CFC", shortName: "Genoa", city: "Genoa", foundedYear: 1893, primaryColor: "#A51E36" },
      { name: "Empoli FC", shortName: "Empoli", city: "Empoli", foundedYear: 1920, primaryColor: "#00529F" },
      { name: "Cagliari", shortName: "Cagliari", city: "Cagliari", foundedYear: 1920, primaryColor: "#A02136" },
      { name: "Parma Calcio", shortName: "Parma", city: "Parma", foundedYear: 1913, primaryColor: "#FFEF00" },
      { name: "Hellas Verona", shortName: "Verona", city: "Verona", foundedYear: 1903, primaryColor: "#003D7C" },
      { name: "Como 1907", shortName: "Como", city: "Como", foundedYear: 1907, primaryColor: "#003D7C" },
      { name: "Lecce", shortName: "Lecce", city: "Lecce", foundedYear: 1908, primaryColor: "#F5E100" },
      { name: "Venezia FC", shortName: "Venezia", city: "Venice", foundedYear: 1907, primaryColor: "#FC6A00" },
      { name: "Monza", shortName: "Monza", city: "Monza", foundedYear: 1912, primaryColor: "#C8102E" },
    ],
  },
  {
    name: "Ligue 1",
    country: "France",
    type: "league",
    foundedYear: 1932,
    teams: [
      { name: "Paris Saint-Germain", shortName: "PSG", city: "Paris", foundedYear: 1970, primaryColor: "#004170" },
      { name: "AS Monaco", shortName: "Monaco", city: "Monaco", foundedYear: 1924, primaryColor: "#E03A3E" },
      { name: "Olympique Marseille", shortName: "Marseille", city: "Marseille", foundedYear: 1899, primaryColor: "#2FAEE0" },
      { name: "Olympique Lyon", shortName: "Lyon", city: "Lyon", foundedYear: 1950, primaryColor: "#0047AB" },
      { name: "LOSC Lille", shortName: "Lille", city: "Lille", foundedYear: 1944, primaryColor: "#D41E25" },
      { name: "OGC Nice", shortName: "Nice", city: "Nice", foundedYear: 1904, primaryColor: "#000000" },
      { name: "Stade Rennais", shortName: "Rennes", city: "Rennes", foundedYear: 1901, primaryColor: "#E4002B" },
      { name: "RC Lens", shortName: "Lens", city: "Lens", foundedYear: 1906, primaryColor: "#FFD700" },
      { name: "Stade Brestois", shortName: "Brest", city: "Brest", foundedYear: 1950, primaryColor: "#E4002B" },
      { name: "Stade de Reims", shortName: "Reims", city: "Reims", foundedYear: 1931, primaryColor: "#E4002B" },
      { name: "RC Strasbourg", shortName: "Strasbourg", city: "Strasbourg", foundedYear: 1906, primaryColor: "#0070B8" },
      { name: "Toulouse FC", shortName: "Toulouse", city: "Toulouse", foundedYear: 1970, primaryColor: "#862076" },
      { name: "Montpellier HSC", shortName: "Montpellier", city: "Montpellier", foundedYear: 1974, primaryColor: "#003366" },
      { name: "FC Nantes", shortName: "Nantes", city: "Nantes", foundedYear: 1943, primaryColor: "#FCE300" },
      { name: "AJ Auxerre", shortName: "Auxerre", city: "Auxerre", foundedYear: 1905, primaryColor: "#1D1D8D" },
      { name: "Angers SCO", shortName: "Angers", city: "Angers", foundedYear: 1919, primaryColor: "#000000" },
      { name: "AS Saint-Etienne", shortName: "St-Etienne", city: "Saint-Etienne", foundedYear: 1919, primaryColor: "#007A33" },
      { name: "Le Havre AC", shortName: "Le Havre", city: "Le Havre", foundedYear: 1872, primaryColor: "#1C5BA3" },
    ],
  },
];

async function main() {
  console.log("Seeding Additional Competitions");
  console.log("=".repeat(50));

  for (const compData of COMPETITIONS) {
    console.log(`\nProcessing ${compData.name}...`);

    // Check if competition exists
    const existing = await db
      .select()
      .from(schema.competitions)
      .where(eq(schema.competitions.slug, slugify(compData.name)))
      .limit(1);

    let competitionId: string;

    if (existing.length > 0) {
      console.log(`  Competition already exists`);
      competitionId = existing[0].id;
    } else {
      // Create competition
      const [competition] = await db
        .insert(schema.competitions)
        .values({
          name: compData.name,
          slug: slugify(compData.name),
          country: compData.country,
          type: compData.type,
          foundedYear: compData.foundedYear,
        })
        .returning();

      competitionId = competition.id;
      console.log(`  Created competition: ${compData.name}`);
    }

    // Add teams
    let teamsCreated = 0;
    let teamsSkipped = 0;

    for (const teamData of compData.teams) {
      const teamSlug = slugify(teamData.name);

      // Check if team exists
      const existingTeam = await db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.slug, teamSlug))
        .limit(1);

      if (existingTeam.length > 0) {
        teamsSkipped++;
        continue;
      }

      // Create team
      await db.insert(schema.teams).values({
        name: teamData.name,
        shortName: teamData.shortName,
        slug: teamSlug,
        country: compData.country,
        city: teamData.city,
        foundedYear: teamData.foundedYear,
        primaryColor: teamData.primaryColor,
      });
      teamsCreated++;
    }

    console.log(`  Teams: ${teamsCreated} created, ${teamsSkipped} already existed`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("Seeding complete!");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
