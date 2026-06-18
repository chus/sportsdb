import { db } from "@/lib/db";
import { users, follows, notificationSettings, matches, teams, players, injuries, competitionSeasons, seasons } from "@/lib/db/schema";
import { and, eq, gte, lte, or, inArray, desc, asc, isNotNull } from "drizzle-orm";

/**
 * Recipients for the weekly digest: users who opted in (weeklyDigest +
 * emailEnabled) and have an email. The defaults are weeklyDigest=true,
 * emailEnabled=false — so users must explicitly enable email.
 */
export async function getDigestRecipients() {
  return db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .innerJoin(notificationSettings, eq(notificationSettings.userId, users.id))
    .where(
      and(
        eq(notificationSettings.weeklyDigest, true),
        eq(notificationSettings.emailEnabled, true),
        isNotNull(users.email),
      ),
    );
}

interface DigestMatch {
  slug: string;
  scheduledAt: Date;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Personalized digest content for a user: their followed teams' recent
 * results (last 7d) and upcoming fixtures (next 14d). The recurring hook —
 * "your teams played / play next" — that gives a reason to return.
 */
export interface DigestInjury {
  playerName: string;
  reason: string | null;
  type: string | null;
}

/** Current injuries among a user's followed players — a follow alert. */
async function getFollowedPlayerInjuries(userId: string): Promise<DigestInjury[]> {
  const followed = await db
    .select({ playerId: follows.entityId })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.entityType, "player")));
  const playerIds = followed.map((f) => f.playerId);
  if (playerIds.length === 0) return [];
  return db
    .select({ playerName: players.name, reason: injuries.reason, type: injuries.type })
    .from(injuries)
    .innerJoin(players, eq(players.id, injuries.playerId))
    .innerJoin(competitionSeasons, eq(competitionSeasons.id, injuries.competitionSeasonId))
    .innerJoin(seasons, and(eq(seasons.id, competitionSeasons.seasonId), eq(seasons.isCurrent, true)))
    .where(inArray(injuries.playerId, playerIds));
}

export async function getUserDigestContent(userId: string): Promise<{
  results: DigestMatch[];
  fixtures: DigestMatch[];
  injuries: DigestInjury[];
}> {
  const playerInjuries = await getFollowedPlayerInjuries(userId);
  const followed = await db
    .select({ teamId: follows.entityId })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.entityType, "team")));
  const teamIds = followed.map((f) => f.teamId);
  if (teamIds.length === 0) return { results: [], fixtures: [], injuries: playerInjuries };

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeks = new Date(now.getTime() + 14 * 86400000);
  const involves = or(inArray(matches.homeTeamId, teamIds), inArray(matches.awayTeamId, teamIds));

  const [resultRows, fixtureRows] = await Promise.all([
    db
      .select({
        slug: matches.slug,
        scheduledAt: matches.scheduledAt,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .where(and(involves, eq(matches.status, "finished"), gte(matches.scheduledAt, weekAgo)))
      .orderBy(desc(matches.scheduledAt))
      .limit(8),
    db
      .select({
        slug: matches.slug,
        scheduledAt: matches.scheduledAt,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .where(and(involves, eq(matches.status, "scheduled"), gte(matches.scheduledAt, now), lte(matches.scheduledAt, twoWeeks)))
      .orderBy(asc(matches.scheduledAt))
      .limit(8),
  ]);

  // Resolve team names once.
  const ids = new Set<string>();
  for (const r of [...resultRows, ...fixtureRows]) {
    ids.add(r.homeTeamId);
    ids.add(r.awayTeamId);
  }
  const nameRows = ids.size
    ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, [...ids]))
    : [];
  const nameById = new Map(nameRows.map((t) => [t.id, t.name]));
  const enrich = (r: (typeof resultRows)[number]): DigestMatch => ({
    slug: r.slug,
    scheduledAt: r.scheduledAt,
    homeName: nameById.get(r.homeTeamId) ?? "?",
    awayName: nameById.get(r.awayTeamId) ?? "?",
    homeScore: r.homeScore,
    awayScore: r.awayScore,
  });

  return { results: resultRows.map(enrich), fixtures: fixtureRows.map(enrich), injuries: playerInjuries };
}
