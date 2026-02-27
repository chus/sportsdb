import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { players, teams, competitions, venues, articles, competitionSeasons, seasons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
    {
      url: `${BASE_URL}/news`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/trending`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/top-scorers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // Fetch all entities
  const [allPlayers, allTeams, allCompetitions, allVenues, allArticles, allCompetitionSeasons] = await Promise.all([
    db.select({ slug: players.slug, updatedAt: players.updatedAt }).from(players),
    db.select({ slug: teams.slug, updatedAt: teams.updatedAt }).from(teams),
    db.select({ slug: competitions.slug, updatedAt: competitions.updatedAt }).from(competitions),
    db.select({ slug: venues.slug, updatedAt: venues.updatedAt }).from(venues),
    db.select({
      slug: articles.slug,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
      .from(articles)
      .where(eq(articles.status, "published")),
    db.select({
      competitionSlug: competitions.slug,
      seasonLabel: seasons.label,
    })
      .from(competitionSeasons)
      .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
      .innerJoin(seasons, eq(competitionSeasons.seasonId, seasons.id)),
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

  // Venue pages
  const venuePages: MetadataRoute.Sitemap = allVenues.map((venue) => ({
    url: `${BASE_URL}/venues/${venue.slug}`,
    lastModified: venue.updatedAt || new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Article pages
  const articlePages: MetadataRoute.Sitemap = allArticles.map((article) => ({
    url: `${BASE_URL}/news/${article.slug}`,
    lastModified: article.updatedAt || article.publishedAt || new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Competition season pages
  const competitionSeasonPages: MetadataRoute.Sitemap = allCompetitionSeasons.map((cs) => ({
    url: `${BASE_URL}/competitions/${cs.competitionSlug}/${cs.seasonLabel.replace("/", "-")}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    ...staticPages,
    ...competitionPages,
    ...competitionSeasonPages,
    ...teamPages,
    ...playerPages,
    ...venuePages,
    ...articlePages,
  ];
}
