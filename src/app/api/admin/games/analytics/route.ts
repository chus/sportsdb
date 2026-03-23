import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  predictions,
  pickemPredictions,
  challengeAnswers,
  analyticsEvents,
  subscriptions,
} from "@/lib/db/schema";
import { sql, count, eq, and, gte } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !(user as any).isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Game engagement stats (last 30 days)
    const [prodeStats] = await db
      .select({
        total: count(),
        last7d: sql<number>`COUNT(*) FILTER (WHERE ${predictions.submittedAt} >= ${sevenDaysAgo})`,
      })
      .from(predictions)
      .where(gte(predictions.submittedAt, thirtyDaysAgo));

    const [pickemStats] = await db
      .select({
        total: count(),
        last7d: sql<number>`COUNT(*) FILTER (WHERE ${pickemPredictions.submittedAt} >= ${sevenDaysAgo})`,
      })
      .from(pickemPredictions)
      .where(gte(pickemPredictions.submittedAt, thirtyDaysAgo));

    const [challengeStats] = await db
      .select({
        total: count(),
        last7d: sql<number>`COUNT(*) FILTER (WHERE ${challengeAnswers.answeredAt} >= ${sevenDaysAgo})`,
      })
      .from(challengeAnswers)
      .where(gte(challengeAnswers.answeredAt, thirtyDaysAgo));

    // Daily engagement (last 14 days)
    const dailyEngagement = await db.execute(sql`
      SELECT
        d.day,
        COALESCE(p.cnt, 0) as prode_count,
        COALESCE(pk.cnt, 0) as pickem_count,
        COALESCE(ch.cnt, 0) as challenge_count
      FROM generate_series(
        CURRENT_DATE - INTERVAL '13 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS d(day)
      LEFT JOIN LATERAL (
        SELECT count(*) as cnt FROM ${predictions}
        WHERE submitted_at::date = d.day::date
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT count(*) as cnt FROM ${pickemPredictions}
        WHERE submitted_at::date = d.day::date
      ) pk ON true
      LEFT JOIN LATERAL (
        SELECT count(*) as cnt FROM ${challengeAnswers}
        WHERE answered_at::date = d.day::date
      ) ch ON true
      ORDER BY d.day
    `);

    // Conversion funnel from analytics events
    const funnelData = await db.execute(sql`
      SELECT
        metadata::json->>'feature' as game_type,
        event_type,
        count(*) as cnt
      FROM ${analyticsEvents}
      WHERE event_type IN ('upgrade_impression', 'upgrade_click', 'upgrade_dismiss')
        AND metadata IS NOT NULL
        AND metadata::json->>'feature' LIKE 'games_%'
        AND timestamp >= ${thirtyDaysAgo}
      GROUP BY metadata::json->>'feature', event_type
      ORDER BY game_type, event_type
    `);

    // Pick'em trial: free users who used their free pick
    const freePickUsage = await db.execute(sql`
      SELECT
        count(DISTINCT pp.user_id) as free_pickers,
        count(DISTINCT CASE WHEN s.tier = 'pro' THEN pp.user_id END) as converted
      FROM ${pickemPredictions} pp
      JOIN ${subscriptions} s ON s.user_id = pp.user_id
      WHERE pp.submitted_at >= ${thirtyDaysAgo}
    `);

    // Unique players per game (last 30 days)
    const [uniqueProde] = await db
      .select({ cnt: sql<number>`COUNT(DISTINCT user_id)` })
      .from(predictions)
      .where(gte(predictions.submittedAt, thirtyDaysAgo));

    const [uniquePickem] = await db
      .select({ cnt: sql<number>`COUNT(DISTINCT user_id)` })
      .from(pickemPredictions)
      .where(gte(pickemPredictions.submittedAt, thirtyDaysAgo));

    const [uniqueChallenge] = await db
      .select({ cnt: sql<number>`COUNT(DISTINCT user_id)` })
      .from(challengeAnswers)
      .where(gte(challengeAnswers.answeredAt, thirtyDaysAgo));

    // Build funnel map
    const funnel: Record<string, { shown: number; clicked: number; dismissed: number }> = {};
    for (const row of funnelData.rows as any[]) {
      if (!funnel[row.game_type]) {
        funnel[row.game_type] = { shown: 0, clicked: 0, dismissed: 0 };
      }
      if (row.event_type === "upgrade_impression") funnel[row.game_type].shown = Number(row.cnt);
      if (row.event_type === "upgrade_click") funnel[row.game_type].clicked = Number(row.cnt);
      if (row.event_type === "upgrade_dismiss") funnel[row.game_type].dismissed = Number(row.cnt);
    }

    return NextResponse.json({
      engagement: {
        prode: { total30d: Number(prodeStats?.total ?? 0), last7d: Number(prodeStats?.last7d ?? 0), uniquePlayers: Number(uniqueProde?.cnt ?? 0) },
        pickem: { total30d: Number(pickemStats?.total ?? 0), last7d: Number(pickemStats?.last7d ?? 0), uniquePlayers: Number(uniquePickem?.cnt ?? 0) },
        challenge: { total30d: Number(challengeStats?.total ?? 0), last7d: Number(challengeStats?.last7d ?? 0), uniquePlayers: Number(uniqueChallenge?.cnt ?? 0) },
      },
      dailyEngagement: (dailyEngagement.rows as any[]).map((r) => ({
        day: r.day,
        prode: Number(r.prode_count),
        pickem: Number(r.pickem_count),
        challenge: Number(r.challenge_count),
      })),
      conversionFunnel: funnel,
      pickemTrial: {
        freePickers: Number((freePickUsage.rows[0] as any)?.free_pickers ?? 0),
        converted: Number((freePickUsage.rows[0] as any)?.converted ?? 0),
      },
    });
  } catch (error) {
    console.error("Admin games analytics error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
