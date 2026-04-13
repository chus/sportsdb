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
      url: `${BASE_URL}/competitions`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/teams`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/players`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
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
      url: `${BASE_URL}/compare`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/venues`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/compare/players`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/world-cup-2026`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Hub / browse pages
    {
      url: `${BASE_URL}/teams/country`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/players/position`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/players/nationality`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
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
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
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

  // Historical season labels per competition (for /top-scorers/[slug]/[season] and /top-assists/[slug]/[season])
  const historicalSeasonPairs = await db
    .selectDistinct({
      compSlug: competitions.slug,
      seasonLabel: seasons.label,
      isCurrent: seasons.isCurrent,
    })
    .from(playerSeasonStats)
    .innerJoin(competitionSeasons, eq(playerSeasonStats.competitionSeasonId, competitionSeasons.id))
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .innerJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .where(eq(seasons.isCurrent, false));

  // Fetch only what we need — teams, competitions, articles, venues, matches, players, hub data
  const [allTeams, allCompetitions, allArticles, allVenues, finishedMatches, indexablePlayers, topPlayerPairs, teamCountries, playerNationalities] = await Promise.all([
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
    // Finished matches with scores (quality gate: must have both teams scored).
    // Slug must be set — we no longer expose UUID URLs in the sitemap.
    // Hard gate: must have a published article. Without an article, the page
    // is just a scoreboard row which Google treats as "Crawled - not indexed".
    db.execute<{
      id: string;
      slug: string;
      scheduled_at: string;
    }>(sql`
      SELECT m.id, m.slug, m.scheduled_at
      FROM matches m
      JOIN teams ht ON ht.id = m.home_team_id
      JOIN teams at2 ON at2.id = m.away_team_id
      JOIN competition_seasons cs ON cs.id = m.competition_season_id
      JOIN seasons s ON s.id = cs.season_id
      WHERE m.status = 'finished'
        AND m.home_score IS NOT NULL
        AND m.away_score IS NOT NULL
        AND m.slug IS NOT NULL
        AND s.is_current = true
        AND EXISTS (
          SELECT 1 FROM articles a
          WHERE a.match_id = m.id AND a.status = 'published'
        )
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
    // Distinct team countries with 3+ teams (for /teams/country/[country])
    db
      .selectDistinct({ country: teams.country })
      .from(teams)
      .where(isNotNull(teams.country))
      .groupBy(teams.country)
      .having(sql`count(*) >= 3`),
    // Distinct player nationalities with 5+ players (for /players/nationality/[country])
    db
      .select({ nationality: players.nationality })
      .from(players)
      .where(and(isNotNull(players.nationality), eq(players.isIndexable, true)))
      .groupBy(players.nationality)
      .having(sql`count(*) >= 5`),
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

  // Historical season top-scorers/assists pages (e.g. /top-scorers/premier-league/2023-24)
  const historicalSeasonPages: MetadataRoute.Sitemap = historicalSeasonPairs
    .filter((pair) => competitionPageSlugs.has(pair.compSlug))
    .flatMap((pair) => {
      const seasonUrl = pair.seasonLabel.replace("/", "-");
      return [
        {
          url: `${BASE_URL}/top-scorers/${pair.compSlug}/${seasonUrl}`,
          lastModified: new Date(),
          changeFrequency: "yearly" as const,
          priority: 0.4,
        },
        {
          url: `${BASE_URL}/top-assists/${pair.compSlug}/${seasonUrl}`,
          lastModified: new Date(),
          changeFrequency: "yearly" as const,
          priority: 0.4,
        },
      ];
    });

  // Venue pages — enriched venues with Wikipedia or capacity data
  const venuePages: MetadataRoute.Sitemap = allVenues.map((venue) => ({
    url: `${BASE_URL}/venues/${venue.slug}`,
    lastModified: venue.updatedAt || new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  // Match pages — finished current-season matches with scores (slug-based URLs only)
  const matchPages: MetadataRoute.Sitemap = finishedMatches.rows.map((match) => ({
    url: `${BASE_URL}/matches/${match.slug}`,
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

  // Teams-by-country pages (e.g. /teams/country/england)
  const teamCountryPages: MetadataRoute.Sitemap = teamCountries
    .filter((row) => row.country)
    .map((row) => ({
      url: `${BASE_URL}/teams/country/${encodeURIComponent(row.country!.toLowerCase())}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

  // Players-by-position pages (e.g. /players/position/forward)
  const POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"];
  const playerPositionPages: MetadataRoute.Sitemap = POSITIONS.map((pos) => ({
    url: `${BASE_URL}/players/position/${pos}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Players-by-nationality pages (e.g. /players/nationality/Brazil)
  const playerNationalityPages: MetadataRoute.Sitemap = playerNationalities
    .filter((row) => row.nationality)
    .map((row) => ({
      url: `${BASE_URL}/players/nationality/${encodeURIComponent(row.nationality!)}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

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
    ...historicalSeasonPages,
    ...comparePages,
    ...teamCountryPages,
    ...playerPositionPages,
    ...playerNationalityPages,
  ];
}
