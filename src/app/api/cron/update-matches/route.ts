import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  matches,
  teams,
  competitions,
  competitionSeasons,
  seasons,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LEAGUE_MAPPING: Record<
  string,
  { slug: string; country: string }
> = {
  PL: { slug: "premier-league", country: "England" },
  PD: { slug: "la-liga", country: "Spain" },
  BL1: { slug: "bundesliga", country: "Germany" },
  SA: { slug: "serie-a", country: "Italy" },
  FL1: { slug: "ligue-1", country: "France" },
};

const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "half_time",
  FINISHED: "finished",
  SUSPENDED: "suspended",
  POSTPONED: "postponed",
  CANCELLED: "cancelled",
  AWARDED: "finished",
};

interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  minute: number | null;
  homeTeam: { id: number; name: string; shortName: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; crest: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  venue: string | null;
  referees: { name: string }[];
}

async function verifyCronSecret() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("CRON_SECRET not set - skipping auth check in development");
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getOrCreateTeam(
  team: ApiMatch["homeTeam"],
  country: string
): Promise<string | null> {
  const slug = slugify(team.name);

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const result = await db
    .insert(teams)
    .values({
      name: team.name,
      shortName: team.shortName,
      slug,
      country,
      logoUrl: team.crest,
    })
    .returning({ id: teams.id });

  return result[0]?.id ?? null;
}

async function getCompetitionSeasonId(
  competitionSlug: string,
  seasonLabel: string
): Promise<string | null> {
  const result = await db
    .select({ id: competitionSeasons.id })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .innerJoin(seasons, eq(seasons.id, competitionSeasons.seasonId))
    .where(
      and(
        eq(competitions.slug, competitionSlug),
        eq(seasons.label, seasonLabel)
      )
    )
    .limit(1);

  return result[0]?.id ?? null;
}

function getSeasonLabel(utcDate: string): string {
  const date = new Date(utcDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const seasonYear = month >= 7 ? year : year - 1;
  return `${seasonYear}/${seasonYear + 1}`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const isAuthorized = await verifyCronSecret();
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FOOTBALL_DATA_API_KEY not configured" },
      { status: 500 }
    );
  }

  const today = getToday();
  let matchesUpdated = 0;
  const errors: string[] = [];

  for (const [code, league] of Object.entries(LEAGUE_MAPPING)) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${today}&dateTo=${today}`;
      const response = await fetch(url, {
        headers: { "X-Auth-Token": apiKey },
      });

      if (!response.ok) {
        errors.push(`${code}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const apiMatches: ApiMatch[] = data.matches ?? [];

      for (const match of apiMatches) {
        try {
          const homeTeamId = await getOrCreateTeam(match.homeTeam, league.country);
          const awayTeamId = await getOrCreateTeam(match.awayTeam, league.country);
          if (!homeTeamId || !awayTeamId) continue;

          const seasonLabel = getSeasonLabel(match.utcDate);
          const competitionSeasonId = await getCompetitionSeasonId(league.slug, seasonLabel);
          if (!competitionSeasonId) continue;

          const status = STATUS_MAP[match.status] || "scheduled";
          const externalId = `fd-${match.id}`;

          // Use live score if available, otherwise full-time score
          const homeScore =
            match.score.fullTime.home ?? match.score.halfTime.home ?? null;
          const awayScore =
            match.score.fullTime.away ?? match.score.halfTime.away ?? null;

          await db
            .insert(matches)
            .values({
              externalId,
              competitionSeasonId,
              homeTeamId,
              awayTeamId,
              scheduledAt: new Date(match.utcDate),
              status,
              homeScore,
              awayScore,
              matchday: match.matchday,
              referee: match.referees?.[0]?.name ?? null,
              minute: match.minute,
            })
            .onConflictDoUpdate({
              target: matches.externalId,
              set: {
                status,
                homeScore,
                awayScore,
                minute: match.minute,
                updatedAt: new Date(),
              },
            });

          matchesUpdated++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`Match fd-${match.id}: ${msg}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${code}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    matchesUpdated,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}
