import { NextRequest, NextResponse } from "next/server";
import { type NeonQueryFunction } from "@neondatabase/serverless";
import OpenAI from "openai";
import {
  generatePreviewForEvent,
  generateRecapForEvent,
  getEventContentSql,
  getOpenAiClient,
  type SportsEventRow,
} from "@/lib/content/event-generation";

export const maxDuration = 300;

const MAX_EVENTS_PER_RUN = 10;
const IMPORTANCE_THRESHOLD = 4;

// Preview window: event is 36–60h in the future
const PREVIEW_MIN_HOURS = 36;
const PREVIEW_MAX_HOURS = 60;

// Recap window: event is 18–30h in the past
const RECAP_MIN_HOURS = 18;
const RECAP_MAX_HOURS = 30;

type CandidateKind = "preview" | "recap";
type Candidate = { kind: CandidateKind; event: SportsEventRow };

/**
 * Event content cron.
 *
 * Every 6h, scans `sports_events` with importance >= 4 and generates:
 *  - event previews for events 36–60h in the future (without an existing preview)
 *  - event recaps for events 18–30h in the past (without an existing recap)
 *
 * Hard cap of 10 events per run. `?dryRun=1` lists candidates without calling OpenAI.
 */
export async function GET(request: NextRequest) {
  const DATABASE_URL = process.env.DATABASE_URL;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  if (!dryRun && !OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const sql = getEventContentSql();
  const openai: OpenAI | null = dryRun ? null : getOpenAiClient();

  try {
    const candidates = await findCandidates(sql);
    const capped = candidates.slice(0, MAX_EVENTS_PER_RUN);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        candidatesFound: candidates.length,
        candidatesReturned: capped.length,
        candidates: capped.map((c) => ({
          kind: c.kind,
          eventId: c.event.id,
          date: c.event.date,
          title: c.event.title,
          importance: c.event.importance,
          competitionSlug: c.event.competition_slug,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    const results = {
      previewsGenerated: 0,
      recapsGenerated: 0,
      errors: [] as string[],
    };

    for (const candidate of capped) {
      try {
        const outcome =
          candidate.kind === "preview"
            ? await generatePreviewForEvent(sql, openai!, candidate.event)
            : await generateRecapForEvent(sql, openai!, candidate.event);

        if (outcome.success) {
          if (candidate.kind === "preview") results.previewsGenerated++;
          else results.recapsGenerated++;
        } else {
          results.errors.push(
            `${candidate.kind} ${candidate.event.id}: ${outcome.reason}`
          );
        }
      } catch (err) {
        results.errors.push(
          `${candidate.kind} ${candidate.event.id}: ${(err as Error).message}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      candidatesFound: candidates.length,
      candidatesProcessed: capped.length,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("generate-event-content cron failed:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

async function findCandidates(
  sql: NeonQueryFunction<false, false>
): Promise<Candidate[]> {
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
      e.match_ids,
      EXISTS (
        SELECT 1 FROM articles a
        WHERE a.sports_event_id = e.id AND a.type = 'event_preview'
      ) AS has_preview,
      EXISTS (
        SELECT 1 FROM articles a
        WHERE a.sports_event_id = e.id AND a.type = 'event_recap'
      ) AS has_recap
    FROM sports_events e
    LEFT JOIN competitions c ON e.competition_id = c.id
    WHERE e.importance >= ${IMPORTANCE_THRESHOLD}
      AND e.date BETWEEN CURRENT_DATE - INTERVAL '3 days'
                     AND CURRENT_DATE + INTERVAL '3 days'
    ORDER BY e.importance DESC, e.date ASC
  `) as Array<
    SportsEventRow & { has_preview: boolean; has_recap: boolean }
  >;

  const now = Date.now();
  const candidates: Candidate[] = [];

  for (const row of rows) {
    // Anchor events at noon UTC so the "hours until" math is stable regardless
    // of timezone edge cases around the DATE column.
    const eventInstant = new Date(`${row.date}T12:00:00Z`).getTime();
    const hoursDelta = (eventInstant - now) / (1000 * 60 * 60);

    const { has_preview: hasPreview, has_recap: hasRecap, ...event } = row;

    if (
      !hasPreview &&
      hoursDelta >= PREVIEW_MIN_HOURS &&
      hoursDelta <= PREVIEW_MAX_HOURS
    ) {
      candidates.push({ kind: "preview", event });
      continue;
    }

    if (
      !hasRecap &&
      hoursDelta <= -RECAP_MIN_HOURS &&
      hoursDelta >= -RECAP_MAX_HOURS
    ) {
      candidates.push({ kind: "recap", event });
    }
  }

  candidates.sort((a, b) => b.event.importance - a.event.importance);
  return candidates;
}
