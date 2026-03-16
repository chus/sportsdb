import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import {
  players,
  teams,
  competitions,
  venues,
  articles,
  competitionSeasons,
  seasons,
  playerSeasonStats,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getDistinctNationalities,
  getDistinctTeamCountries,
} from "@/lib/queries/leaderboards";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

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
      url: `${BASE_URL}/top-scorers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/top-assists`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/trending`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/news`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/world-cup-2026`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/players/nationality`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/teams/country`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  // Get competitions that actually have player stats (for top-scorers/assists pages)
  const competitionsWithStats = await db
    .selectDistinct({ slug: competitions.slug })
    .from(playerSeasonStats)
    .innerJoin(
      competitionSeasons,
      eq(playerSeasonStats.competitionSeasonId, competitionSeasons.id)
    )
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id));

  const competitionSlugsWithStats = new Set(competitionsWithStats.map((c) => c.slug));

  // Fetch all entities
  const [
    allPlayers,
    allTeams,
    allCompetitions,
    allVenues,
    allArticles,
    allCompetitionSeasons,
    nationalities,
    teamCountries,
  ] = await Promise.all([
    db
      .select({
        slug: players.slug,
        updatedAt: players.updatedAt,
        position: players.position,
      })
      .from(players),
    db.select({ slug: teams.slug, updatedAt: teams.updatedAt }).from(teams),
    db
      .select({ slug: competitions.slug, updatedAt: competitions.updatedAt })
      .from(competitions),
    db.select({ slug: venues.slug, updatedAt: venues.updatedAt }).from(venues),
    db
      .select({
        slug: articles.slug,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(eq(articles.status, "published")),
    db
      .select({
        competitionSlug: competitions.slug,
        seasonLabel: seasons.label,
      })
      .from(competitionSeasons)
      .innerJoin(
        competitions,
        eq(competitionSeasons.competitionId, competitions.id)
      )
      .innerJoin(seasons, eq(competitionSeasons.seasonId, seasons.id)),
    getDistinctNationalities(),
    getDistinctTeamCountries(),
  ]);

  // Helper: add hreflang alternates to a URL
  function withHreflang(url: string) {
    return { en: url, es: url };
  }

  // Player pages — filter out Unknown position
  const playerPages: MetadataRoute.Sitemap = allPlayers
    .filter((player) => player.position !== "Unknown")
    .map((player) => ({
      url: `${BASE_URL}/players/${player.slug}`,
      lastModified: player.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: { languages: withHreflang(`${BASE_URL}/players/${player.slug}`) },
    }));

  // Team pages
  const teamPages: MetadataRoute.Sitemap = allTeams.map((team) => ({
    url: `${BASE_URL}/teams/${team.slug}`,
    lastModified: team.updatedAt || new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
    alternates: { languages: withHreflang(`${BASE_URL}/teams/${team.slug}`) },
  }));

  // Competition pages
  const competitionPages: MetadataRoute.Sitemap = allCompetitions.map(
    (comp) => ({
      url: `${BASE_URL}/competitions/${comp.slug}`,
      lastModified: comp.updatedAt || new Date(),
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: withHreflang(`${BASE_URL}/competitions/${comp.slug}`) },
    })
  );

  // Venue pages
  const venuePages: MetadataRoute.Sitemap = allVenues.map((venue) => ({
    url: `${BASE_URL}/venues/${venue.slug}`,
    lastModified: venue.updatedAt || new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
    alternates: { languages: withHreflang(`${BASE_URL}/venues/${venue.slug}`) },
  }));

  // Article pages
  const articlePages: MetadataRoute.Sitemap = allArticles.map((article) => ({
    url: `${BASE_URL}/news/${article.slug}`,
    lastModified: article.updatedAt || article.publishedAt || new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
    alternates: { languages: withHreflang(`${BASE_URL}/news/${article.slug}`) },
  }));

  // Competition season pages
  const competitionSeasonPages: MetadataRoute.Sitemap =
    allCompetitionSeasons.map((cs) => ({
      url: `${BASE_URL}/competitions/${cs.competitionSlug}/${cs.seasonLabel.replace("/", "-")}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // Top scorers/assists by competition — only for competitions with actual stats
  const topScorerCompPages: MetadataRoute.Sitemap = allCompetitions
    .filter((comp) => competitionSlugsWithStats.has(comp.slug))
    .map((comp) => ({
      url: `${BASE_URL}/top-scorers/${comp.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  const topAssistCompPages: MetadataRoute.Sitemap = allCompetitions
    .filter((comp) => competitionSlugsWithStats.has(comp.slug))
    .map((comp) => ({
      url: `${BASE_URL}/top-assists/${comp.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  // Players by nationality
  const nationalityPages: MetadataRoute.Sitemap = nationalities.map((n) => ({
    url: `${BASE_URL}/players/nationality/${encodeURIComponent(n.nationality)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  // Teams by country
  const teamCountryPages: MetadataRoute.Sitemap = teamCountries.map((c) => ({
    url: `${BASE_URL}/teams/country/${encodeURIComponent(c.country)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  // Note: Compare pages excluded from sitemap — they are discoverable
  // via internal links but don't need to be submitted directly to Google.

  return [
    ...staticPages,
    ...competitionPages,
    ...competitionSeasonPages,
    ...teamPages,
    ...playerPages,
    ...venuePages,
    ...articlePages,
    ...topScorerCompPages,
    ...topAssistCompPages,
    ...nationalityPages,
    ...teamCountryPages,
  ];
}
