import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import {
  teams,
  competitions,
  articles,
  matches,
  competitionSeasons,
  seasons,
  playerSeasonStats,
  standings,
  venues,
  players,
} from "@/lib/db/schema";
import { eq, sql, or, and, isNotNull, ne, desc } from "drizzle-orm";
import { scoreTeamPage } from "@/lib/seo/page-quality";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages — only substantial content pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/news`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
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
      url: `${BASE_URL}/transfers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/venues`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/world-cup-2026`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/methodology`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ];

  // Competitions that have player stats (for top-scorers/assists pages)
  const competitionsWithStats = await db
    .selectDistinct({ slug: competitions.slug })
    .from(playerSeasonStats)
    .innerJoin(
      competitionSeasons,
      eq(playerSeasonStats.competitionSeasonId, competitionSeasons.id)
    )
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id));

  const competitionSlugsWithStats = new Set(competitionsWithStats.map((c) => c.slug));

  // Fetch only what we need — teams, competitions, articles, venues, matches, players
  const [allTeams, allCompetitions, allArticles, allVenues, finishedMatches, indexablePlayers, topPlayerPairs] = await Promise.all([
    // Teams with quality-relevant data for filtering
    db
      .selectDistinct({
        slug: teams.slug,
        updatedAt: teams.updatedAt,
        country: teams.country,
        city: teams.city,
        foundedYear: teams.foundedYear,
        logoUrl: teams.logoUrl,
        squadCount: sql<number>`(
          SELECT count(*) FROM player_team_history pth
          JOIN players p ON p.id = pth.player_id
          WHERE pth.team_id = ${teams.id} AND pth.valid_to IS NULL AND p.position != 'Unknown'
        )`,
        standingsCount: sql<number>`(
          SELECT count(*) FROM standings s
          JOIN competition_seasons cs ON cs.id = s.competition_season_id
          JOIN seasons se ON se.id = cs.season_id
          WHERE s.team_id = ${teams.id} AND se.is_current = true
        )`,
      })
      .from(teams)
      .innerJoin(
        matches,
        or(eq(matches.homeTeamId, teams.id), eq(matches.awayTeamId, teams.id))
      ),
    // Competitions with current-season standings count
    db
      .selectDistinct({
        slug: competitions.slug,
        updatedAt: competitions.updatedAt,
        standingsTeamCount: sql<number>`(
          SELECT count(*) FROM standings s
          JOIN competition_seasons cs ON cs.id = s.competition_season_id
          JOIN seasons se ON se.id = cs.season_id
          WHERE cs.competition_id = ${competitions.id} AND se.is_current = true
        )`,
      })
      .from(competitions)
      .innerJoin(
        competitionSeasons,
        eq(competitionSeasons.competitionId, competitions.id)
      )
      .innerJoin(
        matches,
        eq(matches.competitionSeasonId, competitionSeasons.id)
      ),
    // Published articles
    db
      .select({
        slug: articles.slug,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(eq(articles.status, "published")),
    // Venues with Wikidata enrichment (quality gate: must have wikipedia or capacity)
    db
      .select({
        slug: venues.slug,
        updatedAt: venues.updatedAt,
        wikipediaUrl: venues.wikipediaUrl,
        capacity: venues.capacity,
        latitude: venues.latitude,
      })
      .from(venues)
      .where(
        or(
          isNotNull(venues.wikipediaUrl),
          isNotNull(venues.capacity),
        )
      ),
    // Finished matches with scores (quality gate: must have both teams scored)
    db.execute<{
      id: string;
      scheduled_at: string;
    }>(sql`
      SELECT m.id, m.scheduled_at
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at2 ON at2.id = m.away_team_id
      JOIN competition_seasons cs ON cs.id = m.competition_season_id
      JOIN seasons s ON s.id = cs.season_id
      WHERE m.status = 'finished'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
        AND s.is_current = true
      ORDER BY m.scheduled_at DESC
      LIMIT 500
    `),
    // Indexable players (quality score >= 40)
    db
      .select({
        slug: players.slug,
        updatedAt: players.updatedAt,
      })
      .from(players)
      .where(eq(players.isIndexable, true)),
    // Top players for compare matchup pages
    db
      .select({
        slug: players.slug,
      })
      .from(players)
      .where(ne(players.position, "Unknown"))
      .orderBy(desc(players.popularityScore))
      .limit(15),
  ]);

  // Team pages — only include teams that pass quality scoring (Tier A: score >= 40)
  // Exclude national teams (no squad data) and require current-season standings
  const NATIONAL_TEAM_SLUGS = new Set(["mexico", "south-korea", "south-africa", "brazil", "argentina", "germany", "france", "england", "spain", "italy", "portugal", "netherlands", "belgium", "croatia", "denmark", "serbia", "switzerland", "austria", "poland", "czech-republic", "scotland", "wales", "turkey", "ukraine", "romania", "hungary", "slovakia", "slovenia", "albania", "georgia", "japan", "australia", "usa", "canada", "colombia", "uruguay", "chile", "ecuador", "paraguay", "peru", "venezuela", "bolivia"]);
  const teamPages: MetadataRoute.Sitemap = allTeams
    .filter((team) => {
      if (NATIONAL_TEAM_SLUGS.has(team.slug)) return false; // exclude national teams
      if ((team.standingsCount ?? 0) === 0) return false; // hard gate: must have current standings
      const result = scoreTeamPage({
        country: team.country,
        city: team.city,
        foundedYear: team.foundedYear,
        logoUrl: team.logoUrl,
        squadSize: team.squadCount ?? 0,
        hasStandings: true,
        hasMatches: true,
      });
      return result.score >= 40; // Tier A only
    })
    .map((team) => ({
      url: `${BASE_URL}/teams/${team.slug}`,
      lastModified: team.updatedAt || new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // Competition pages — only those with current-season standings having > 5 teams
  const competitionPages: MetadataRoute.Sitemap = allCompetitions
    .filter((comp) => (comp.standingsTeamCount ?? 0) > 5)
    .map((comp) => ({
      url: `${BASE_URL}/competitions/${comp.slug}`,
      lastModified: comp.updatedAt || new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    }));

  // Article pages — all published articles (strongest content)
  const articlePages: MetadataRoute.Sitemap = allArticles.map((article) => ({
    url: `${BASE_URL}/news/${article.slug}`,
    lastModified: article.updatedAt || article.publishedAt || new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Top scorers/assists by competition — current season only
  const competitionPageSlugs = new Set(competitionPages.map((p) => {
    const parts = p.url.split("/");
    return parts[parts.length - 1];
  }));

  const topScorerCompPages: MetadataRoute.Sitemap = allCompetitions
    .filter((comp) => competitionSlugsWithStats.has(comp.slug) && competitionPageSlugs.has(comp.slug))
    .map((comp) => ({
      url: `${BASE_URL}/top-scorers/${comp.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  const topAssistCompPages: MetadataRoute.Sitemap = allCompetitions
    .filter((comp) => competitionSlugsWithStats.has(comp.slug) && competitionPageSlugs.has(comp.slug))
    .map((comp) => ({
      url: `${BASE_URL}/top-assists/${comp.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  // Venue pages — enriched venues with Wikipedia or capacity data
  const venuePages: MetadataRoute.Sitemap = allVenues.map((venue) => ({
    url: `${BASE_URL}/venues/${venue.slug}`,
    lastModified: venue.updatedAt || new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Match pages — finished current-season matches with scores
  const matchPages: MetadataRoute.Sitemap = finishedMatches.rows.map((match) => ({
    url: `${BASE_URL}/matches/${match.id}`,
    lastModified: new Date(match.scheduled_at),
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  // Player pages — only quality-gated indexable players
  const playerPages: MetadataRoute.Sitemap = indexablePlayers.map((player) => ({
    url: `${BASE_URL}/players/${player.slug}`,
    lastModified: player.updatedAt || new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Compare matchup pages — top player pairs (C(15,2) = 105 pages)
  const comparePages: MetadataRoute.Sitemap = [];
  for (let i = 0; i < topPlayerPairs.length; i++) {
    for (let j = i + 1; j < topPlayerPairs.length; j++) {
      comparePages.push({
        url: `${BASE_URL}/compare/${topPlayerPairs[i].slug}-vs-${topPlayerPairs[j].slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.5,
      });
    }
  }

  // Matches hub page
  const matchesHubPage: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/matches`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 0.8,
    },
  ];

  return [
    ...staticPages,
    ...matchesHubPage,
    ...competitionPages,
    ...teamPages,
    ...playerPages,
    ...venuePages,
    ...matchPages,
    ...articlePages,
    ...topScorerCompPages,
    ...topAssistCompPages,
    ...comparePages,
  ];
}
