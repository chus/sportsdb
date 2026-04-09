import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import OpenAI from "openai";
import {
  buildEventPreviewPrompt,
  buildEventRecapPrompt,
  type EventPreviewContext,
  type EventRecapContext,
  type EventMatchSummary,
  type EventFinishedMatchSummary,
} from "./article-prompts";

export type EventContentType = "event_preview" | "event_recap";

export type EventGenerationResult =
  | { success: true; articleId: string; slug: string; type: EventContentType }
  | { success: false; reason: string };

export type SportsEventRow = {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string | null;
  importance: number;
  competition_id: string | null;
  competition_name: string | null;
  competition_slug: string | null;
  match_ids: unknown;
};

type FetchedMatch = {
  id: string;
  status: string;
  scheduled_at: string;
  home_team: string;
  home_team_slug: string;
  away_team: string;
  away_team_slug: string;
  competition: string;
  competition_slug: string;
  matchday: number | null;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
};

type GeneratedArticle = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
};

export function getEventContentSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return neon(url);
}

export function getOpenAiClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey: key });
}

export async function loadSportsEventById(
  sql: NeonQueryFunction<false, false>,
  eventId: string
): Promise<SportsEventRow | null> {
  const rows = (await sql`
    SELECT
      e.id,
      e.date::text AS date,
      e.type,
      e.title,
      e.description,
      e.importance,
      e.competition_id,
      c.name AS competition_name,
      c.slug AS competition_slug,
      e.match_ids
    FROM sports_events e
    LEFT JOIN competitions c ON e.competition_id = c.id
    WHERE e.id = ${eventId}
    LIMIT 1
  `) as SportsEventRow[];
  return rows[0] ?? null;
}

export async function generatePreviewForEvent(
  sql: NeonQueryFunction<false, false>,
  openai: OpenAI,
  event: SportsEventRow
): Promise<EventGenerationResult> {
  const matches = await fetchEventMatchSummaries(sql, event.match_ids);
  if (!matches.length) {
    return { success: false, reason: "No linked matches for this event" };
  }

  const ctx: EventPreviewContext = {
    event: toEventPromptEvent(event),
    matches: matches.map(toEventMatchSummary),
  };

  const prompt = buildEventPreviewPrompt(ctx);
  const article = await callOpenAi(openai, prompt);
  if (!article) {
    return { success: false, reason: "OpenAI returned no usable article" };
  }

  const inserted = await insertEventArticle(sql, {
    article,
    type: "event_preview",
    sportsEventId: event.id,
    teamSlugs: uniqueTeamSlugs(matches),
  });

  if (!inserted) {
    return { success: false, reason: "Database insert failed" };
  }

  return {
    success: true,
    articleId: inserted.id,
    slug: inserted.slug,
    type: "event_preview",
  };
}

export async function generateRecapForEvent(
  sql: NeonQueryFunction<false, false>,
  openai: OpenAI,
  event: SportsEventRow
): Promise<EventGenerationResult> {
  const matches = await fetchEventMatchSummaries(sql, event.match_ids);
  const finished = matches.filter(
    (m) =>
      m.status === "finished" &&
      m.home_score != null &&
      m.away_score != null
  );
  if (!finished.length) {
    return { success: false, reason: "No finished matches yet" };
  }

  const ctx: EventRecapContext = {
    event: toEventPromptEvent(event),
    finishedMatches: finished.map(toEventFinishedMatchSummary),
  };

  const prompt = buildEventRecapPrompt(ctx);
  const article = await callOpenAi(openai, prompt);
  if (!article) {
    return { success: false, reason: "OpenAI returned no usable article" };
  }

  const inserted = await insertEventArticle(sql, {
    article,
    type: "event_recap",
    sportsEventId: event.id,
    teamSlugs: uniqueTeamSlugs(finished),
  });

  if (!inserted) {
    return { success: false, reason: "Database insert failed" };
  }

  return {
    success: true,
    articleId: inserted.id,
    slug: inserted.slug,
    type: "event_recap",
  };
}

function toEventPromptEvent(event: SportsEventRow) {
  return {
    slug: eventSlug(event),
    title: event.title,
    description: event.description ?? undefined,
    type: event.type,
    date: event.date,
    importance: event.importance,
    competition:
      event.competition_name && event.competition_slug
        ? { name: event.competition_name, slug: event.competition_slug }
        : undefined,
  };
}

export async function fetchEventMatchSummaries(
  sql: NeonQueryFunction<false, false>,
  matchIdsRaw: unknown
): Promise<FetchedMatch[]> {
  const matchIds = Array.isArray(matchIdsRaw)
    ? (matchIdsRaw as unknown[]).filter(
        (v): v is string => typeof v === "string" && v.length > 0
      )
    : [];
  if (!matchIds.length) return [];

  const rows = (await sql`
    SELECT
      m.id,
      m.status,
      m.scheduled_at,
      m.home_score,
      m.away_score,
      m.matchday,
      ht.name AS home_team,
      ht.slug AS home_team_slug,
      at2.name AS away_team,
      at2.slug AS away_team_slug,
      c.name AS competition,
      c.slug AS competition_slug,
      v.name AS venue
    FROM matches m
    INNER JOIN teams ht ON m.home_team_id = ht.id
    INNER JOIN teams at2 ON m.away_team_id = at2.id
    INNER JOIN competition_seasons cs ON m.competition_season_id = cs.id
    INNER JOIN competitions c ON cs.competition_id = c.id
    LEFT JOIN venues v ON m.venue_id = v.id
    WHERE m.id = ANY(${matchIds}::uuid[])
    ORDER BY m.scheduled_at ASC
  `) as FetchedMatch[];

  return rows;
}

function toEventMatchSummary(m: FetchedMatch): EventMatchSummary {
  return {
    homeTeam: m.home_team,
    homeTeamSlug: m.home_team_slug,
    awayTeam: m.away_team,
    awayTeamSlug: m.away_team_slug,
    competition: m.competition,
    competitionSlug: m.competition_slug,
    date: m.scheduled_at,
    venue: m.venue ?? undefined,
    matchday: m.matchday ?? undefined,
  };
}

function toEventFinishedMatchSummary(m: FetchedMatch): EventFinishedMatchSummary {
  return {
    ...toEventMatchSummary(m),
    homeScore: m.home_score ?? 0,
    awayScore: m.away_score ?? 0,
  };
}

function uniqueTeamSlugs(matches: FetchedMatch[]): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m.home_team_slug);
    set.add(m.away_team_slug);
  }
  return [...set];
}

export function eventSlug(event: SportsEventRow): string {
  const base = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `event-${event.id.slice(0, 8)}`;
}

async function callOpenAi(
  openai: OpenAI,
  prompt: string
): Promise<GeneratedArticle | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert sports journalist writing for a professional football database website. Write engaging, detailed articles with vivid language, clear structure, and excellent readability. Use short paragraphs (3-4 sentences max), varied sentence lengths, active voice, and strong transition words. Articles should be comprehensive and informative — never thin or generic. Always return valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 6000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as GeneratedArticle;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}

function countWords(content: string | null | undefined): number {
  if (!content) return 0;
  return content.split(/\s+/).filter(Boolean).length;
}

async function insertEventArticle(
  sql: NeonQueryFunction<false, false>,
  params: {
    article: GeneratedArticle;
    type: EventContentType;
    sportsEventId: string;
    teamSlugs: string[];
  }
): Promise<{ id: string; slug: string } | null> {
  const { article, type, sportsEventId, teamSlugs } = params;

  const existing = await sql`
    SELECT id FROM articles WHERE slug = ${article.slug}
  `;
  const finalSlug =
    existing.length > 0 ? `${article.slug}-${Date.now()}` : article.slug;

  const inserted = (await sql`
    INSERT INTO articles (
      slug, type, title, excerpt, content, meta_title, meta_description,
      sports_event_id, status, published_at, model_version, word_count
    ) VALUES (
      ${finalSlug}, ${type}, ${article.title}, ${article.excerpt}, ${article.content},
      ${article.metaTitle}, ${article.metaDescription},
      ${sportsEventId}, 'published', NOW(), 'gpt-4o-mini', ${countWords(article.content)}
    )
    RETURNING id
  `) as Array<{ id: string }>;

  const articleId = inserted[0]?.id;
  if (!articleId) return null;

  for (const slug of teamSlugs) {
    const teamRows = (await sql`SELECT id FROM teams WHERE slug = ${slug}`) as Array<{
      id: string;
    }>;
    const teamId = teamRows[0]?.id;
    if (teamId) {
      await sql`
        INSERT INTO article_teams (article_id, team_id, role)
        VALUES (${articleId}, ${teamId}, 'featured')
        ON CONFLICT DO NOTHING
      `;
    }
  }

  return { id: articleId, slug: finalSlug };
}
