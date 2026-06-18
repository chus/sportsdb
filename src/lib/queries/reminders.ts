import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Recurring re-engagement reminder targets, gated on email opt-in
 * (emailEnabled). These feed the daily-reminders cron — the habit-loop
 * pull (don't-lose-your-streak, make-your-picks) that brings users back.
 */

export interface StreakReminder {
  id: string;
  email: string;
  name: string | null;
  streak: number;
}

/**
 * Users whose challenge streak is at risk: they answered yesterday (and a
 * run of days before) but NOT today, so a nudge can save the streak. Uses
 * gaps-and-islands to measure the consecutive run ending yesterday.
 */
export async function getStreakAtRiskUsers(): Promise<StreakReminder[]> {
  const rows = await db.execute(sql`
    WITH days AS (
      SELECT DISTINCT ca.user_id, cq.active_date AS d
      FROM challenge_answers ca
      JOIN challenge_questions cq ON cq.id = ca.question_id
      WHERE cq.active_date IS NOT NULL
    ),
    ranked AS (
      SELECT user_id, d, (d - (row_number() OVER (PARTITION BY user_id ORDER BY d))::int) AS grp
      FROM days
    ),
    streaks AS (
      SELECT user_id, count(*)::int AS len, max(d) AS last_d
      FROM ranked GROUP BY user_id, grp
    )
    SELECT u.id, u.email, u.name, s.len AS streak
    FROM streaks s
    JOIN users u ON u.id = s.user_id
    JOIN notification_settings ns ON ns.user_id = u.id
    WHERE s.last_d = CURRENT_DATE - 1
      AND s.len >= 2
      AND ns.email_enabled = true
      AND u.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM days d2 WHERE d2.user_id = s.user_id AND d2.d = CURRENT_DATE
      )
  `);
  return (rows as unknown as { rows?: StreakReminder[] }).rows ?? (rows as unknown as StreakReminder[]);
}

export interface MatchdayReminder {
  id: string;
  email: string;
  name: string | null;
  pending: number;
}

/**
 * League members who have scheduled matches in the next ~36h they haven't
 * predicted yet — "make your picks before kickoff". Only fires when there
 * are imminent fixtures (quiet during breaks/off-season, by design).
 */
export async function getMatchdayReminderUsers(): Promise<MatchdayReminder[]> {
  const rows = await db.execute(sql`
    WITH upcoming AS (
      SELECT id FROM matches
      WHERE status = 'scheduled'
        AND scheduled_at BETWEEN now() AND now() + interval '36 hours'
    ),
    league_users AS (
      SELECT DISTINCT user_id FROM prediction_league_members
    )
    SELECT u.id, u.email, u.name,
      (SELECT count(*)::int FROM upcoming up
        WHERE NOT EXISTS (
          SELECT 1 FROM predictions p WHERE p.user_id = u.id AND p.match_id = up.id
        )) AS pending
    FROM league_users lu
    JOIN users u ON u.id = lu.user_id
    JOIN notification_settings ns ON ns.user_id = u.id
    WHERE ns.email_enabled = true AND u.email IS NOT NULL
      AND (SELECT count(*) FROM upcoming) > 0
  `);
  const list = (rows as unknown as { rows?: MatchdayReminder[] }).rows ?? (rows as unknown as MatchdayReminder[]);
  return list.filter((r) => r.pending > 0);
}
