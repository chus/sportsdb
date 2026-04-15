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
import { eq, and, ne } from "drizzle-orm";
import { scorePredictionsForMatch } from "@/lib/queries/predictions";
import { scorePickemsForMatch } from "@/lib/queries/pickem";
import { buildMatchSlugWithFallback } from "@/lib/utils/match-slug";

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
): Promise<{ id: string; slug: string } | null> {
  const slug = slugify(team.name);

  const existing = await db
    .select({ id: teams.id, slug: teams.slug })
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, slug: existing[0].slug };
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
    .returning({ id: teams.id, slug: teams.slug });

  if (!result[0]) return null;
  return { id: result[0].id, slug: result[0].slug };
}

/**
 * Pick a slug variant that doesn't collide with another match's slug
 * (other than the row being upserted via externalId).
 */
async function resolveMatchSlug(
  variants: { primary: string; withMatchday: string | null; withUuid: string },
  externalId: string
): Promise<string> {
  const candidates = [variants.primary];
  if (variants.withMatchday) candidates.push(variants.withMatchday);
  candidates.push(variants.withUuid);

  for (const candidate of candidates) {
    const conflict = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.slug, candidate), ne(matches.externalId, externalId)))
      .limit(1);

    if (conflict.length === 0) return candidate;
  }
  return `${variants.primary}-${Date.now().toString(36)}`;
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
  const nextYear = seasonYear + 1;
  return `${seasonYear}/${String(nextYear).slice(-2)}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns a date range: 3 days back + 7 days ahead.
 * This ensures the cron catches recently finished matches (for scoring,
 * article generation) and keeps upcoming fixtures populated for the homepage.
 */
function getDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 3);
  const to = new Date(now);
  to.setDate(to.getDate() + 7);
  return { from: formatDate(from), to: formatDate(to) };
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

  const { from, to } = getDateRange();
  let matchesUpdated = 0;
  const errors: string[] = [];

  for (const [code, league] of Object.entries(LEAGUE_MAPPING)) {
    try {
      const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`;
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
          const homeTeam = await getOrCreateTeam(match.homeTeam, league.country);
          const awayTeam = await getOrCreateTeam(match.awayTeam, league.country);
          if (!homeTeam || !awayTeam) continue;

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

          const slugVariants = buildMatchSlugWithFallback(
            homeTeam.slug,
            awayTeam.slug,
            new Date(match.utcDate),
            match.matchday,
            externalId
          );
          const matchSlug = await resolveMatchSlug(slugVariants, externalId);

          const [upserted] = await db
            .insert(matches)
            .values({
              externalId,
              slug: matchSlug,
              competitionSeasonId,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
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
            })
            .returning({ id: matches.id });

          // Score predictions & pickems when match finishes
          if (status === "finished" && upserted?.id) {
            try {
              await Promise.all([
                scorePredictionsForMatch(upserted.id),
                scorePickemsForMatch(upserted.id),
              ]);
            } catch (scoreErr) {
              console.error(`Scoring error for match ${upserted.id}:`, scoreErr);
            }
          }

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
