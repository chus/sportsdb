import { db } from "@/lib/db";
import {
  articles,
  articlePlayers,
  articleTeams,
  players,
  teams,
  matches,
  competitions,
  competitionSeasons,
  seasons,
} from "@/lib/db/schema";
import { eq, desc, and, or, isNotNull, sql } from "drizzle-orm";

export interface ArticleWithRelations {
  article: typeof articles.$inferSelect;
  competition: {
    name: string;
    slug: string;
  } | null;
  season: {
    label: string;
  } | null;
  primaryPlayer: {
    name: string;
    slug: string;
  } | null;
  primaryTeam: {
    name: string;
    slug: string;
    logoUrl: string | null;
  } | null;
  match?: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
  };
}

export async function getPublishedArticles(
  limit = 20,
  offset = 0,
  type?: string
): Promise<ArticleWithRelations[]> {
  let whereClause = eq(articles.status, "published");

  if (type) {
    whereClause = and(whereClause, eq(articles.type, type))!;
  }

  const results = await db
    .select({
      article: articles,
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
      primaryPlayer: {
        name: players.name,
        slug: players.slug,
      },
      primaryTeam: {
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
    })
    .from(articles)
    .leftJoin(
      competitionSeasons,
      eq(articles.competitionSeasonId, competitionSeasons.id)
    )
    .leftJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .leftJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .leftJoin(players, eq(articles.primaryPlayerId, players.id))
    .leftJoin(teams, eq(articles.primaryTeamId, teams.id))
    .where(whereClause)
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getArticleBySlug(
  slug: string
): Promise<ArticleWithRelations | null> {
  const [result] = await db
    .select({
      article: articles,
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
      primaryPlayer: {
        name: players.name,
        slug: players.slug,
      },
      primaryTeam: {
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
    })
    .from(articles)
    .leftJoin(
      competitionSeasons,
      eq(articles.competitionSeasonId, competitionSeasons.id)
    )
    .leftJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .leftJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .leftJoin(players, eq(articles.primaryPlayerId, players.id))
    .leftJoin(teams, eq(articles.primaryTeamId, teams.id))
    .where(eq(articles.slug, slug))
    .limit(1);

  return result || null;
}

export async function getRelatedArticles(
  articleId: string,
  competitionSeasonId?: string | null,
  primaryPlayerId?: string | null,
  primaryTeamId?: string | null,
  limit = 4
): Promise<ArticleWithRelations[]> {
  // Find articles related by competition, player, or team
  const conditions = [];

  if (competitionSeasonId) {
    conditions.push(eq(articles.competitionSeasonId, competitionSeasonId));
  }
  if (primaryPlayerId) {
    conditions.push(eq(articles.primaryPlayerId, primaryPlayerId));
  }
  if (primaryTeamId) {
    conditions.push(eq(articles.primaryTeamId, primaryTeamId));
  }

  if (conditions.length === 0) {
    return [];
  }

  const results = await db
    .select({
      article: articles,
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
      primaryPlayer: {
        name: players.name,
        slug: players.slug,
      },
      primaryTeam: {
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
    })
    .from(articles)
    .leftJoin(
      competitionSeasons,
      eq(articles.competitionSeasonId, competitionSeasons.id)
    )
    .leftJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .leftJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .leftJoin(players, eq(articles.primaryPlayerId, players.id))
    .leftJoin(teams, eq(articles.primaryTeamId, teams.id))
    .where(
      and(
        eq(articles.status, "published"),
        sql`${articles.id} != ${articleId}`,
        or(...conditions)
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  return results;
}

export async function getArticlesForPlayer(
  playerId: string,
  limit = 5
): Promise<ArticleWithRelations[]> {
  // Get articles where player is primary or mentioned
  const results = await db
    .select({
      article: articles,
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
      primaryPlayer: {
        name: players.name,
        slug: players.slug,
      },
      primaryTeam: {
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
    })
    .from(articles)
    .leftJoin(
      competitionSeasons,
      eq(articles.competitionSeasonId, competitionSeasons.id)
    )
    .leftJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .leftJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .leftJoin(players, eq(articles.primaryPlayerId, players.id))
    .leftJoin(teams, eq(articles.primaryTeamId, teams.id))
    .where(
      and(eq(articles.status, "published"), eq(articles.primaryPlayerId, playerId))
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  return results;
}

export async function getArticlesForTeam(
  teamId: string,
  limit = 5
): Promise<ArticleWithRelations[]> {
  const results = await db
    .select({
      article: articles,
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
      primaryPlayer: {
        name: players.name,
        slug: players.slug,
      },
      primaryTeam: {
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
    })
    .from(articles)
    .leftJoin(
      competitionSeasons,
      eq(articles.competitionSeasonId, competitionSeasons.id)
    )
    .leftJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .leftJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .leftJoin(players, eq(articles.primaryPlayerId, players.id))
    .leftJoin(teams, eq(articles.primaryTeamId, teams.id))
    .where(
      and(eq(articles.status, "published"), eq(articles.primaryTeamId, teamId))
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  return results;
}

export async function getArticlesForCompetition(
  competitionSlug: string,
  limit = 10
): Promise<ArticleWithRelations[]> {
  const results = await db
    .select({
      article: articles,
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
      primaryPlayer: {
        name: players.name,
        slug: players.slug,
      },
      primaryTeam: {
        name: teams.name,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
    })
    .from(articles)
    .innerJoin(
      competitionSeasons,
      eq(articles.competitionSeasonId, competitionSeasons.id)
    )
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .leftJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .leftJoin(players, eq(articles.primaryPlayerId, players.id))
    .leftJoin(teams, eq(articles.primaryTeamId, teams.id))
    .where(
      and(eq(articles.status, "published"), eq(competitions.slug, competitionSlug))
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  return results;
}

export async function getArticleCount(type?: string): Promise<number> {
  let whereClause = eq(articles.status, "published");

  if (type) {
    whereClause = and(whereClause, eq(articles.type, type))!;
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(whereClause);

  return Number(result?.count || 0);
}
