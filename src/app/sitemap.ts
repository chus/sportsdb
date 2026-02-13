import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { players, teams, competitions, venues } from "@/lib/db/schema";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // Fetch all entities
  const [allPlayers, allTeams, allCompetitions, allVenues] = await Promise.all([
    db.select({ slug: players.slug, updatedAt: players.updatedAt }).from(players),
    db.select({ slug: teams.slug, updatedAt: teams.updatedAt }).from(teams),
    db.select({ slug: competitions.slug, updatedAt: competitions.updatedAt }).from(competitions),
    db.select({ slug: venues.slug, updatedAt: venues.updatedAt }).from(venues),
  ]);

  // Player pages
  const playerPages: MetadataRoute.Sitemap = allPlayers.map((player) => ({
    url: `${BASE_URL}/players/${player.slug}`,
    lastModified: player.updatedAt || new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Team pages
  const teamPages: MetadataRoute.Sitemap = allTeams.map((team) => ({
    url: `${BASE_URL}/teams/${team.slug}`,
    lastModified: team.updatedAt || new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Competition pages
  const competitionPages: MetadataRoute.Sitemap = allCompetitions.map((comp) => ({
    url: `${BASE_URL}/competitions/${comp.slug}`,
    lastModified: comp.updatedAt || new Date(),
    changeFrequency: "daily",
    priority: 0.9,
  }));

  // Venue pages (if we have a venue page)
  const venuePages: MetadataRoute.Sitemap = allVenues.map((venue) => ({
    url: `${BASE_URL}/venues/${venue.slug}`,
    lastModified: venue.updatedAt || new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...competitionPages,
    ...teamPages,
    ...playerPages,
    ...venuePages,
  ];
}
