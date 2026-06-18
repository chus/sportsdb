import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStreakAtRiskUsers, getMatchdayReminderUsers } from "@/lib/queries/reminders";
import { sendEmail, emailConfigured } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily habit-loop reminders (email opt-in only):
 *   - Streak at risk: "🔥 keep your N-day streak alive" before it lapses.
 *   - Matchday picks: "make your picks before kickoff" when a league member
 *     has unpredicted fixtures in the next ~36h.
 * The recurring pull that brings users back. No-ops until email is set up.
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

async function verifyCron() {
  const auth = (await headers()).get("authorization");
  const secret = process.env.CRON_SECRET;
  return !secret || auth === `Bearer ${secret}`;
}

function shell(body: string, cta: string, href: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    ${body}
    <div style="margin-top:24px;">
      <a href="${href}" style="background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">${cta}</a>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
      <a href="${BASE_URL}/account" style="color:#94a3b8;">Manage email preferences</a>
    </p>
  </div>`;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCron())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  if (!emailConfigured() && !dryRun) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not set" });
  }

  const [streakUsers, matchdayUsers] = await Promise.all([
    getStreakAtRiskUsers(),
    getMatchdayReminderUsers(),
  ]);

  let streakSent = 0;
  let matchdaySent = 0;

  for (const u of streakUsers) {
    if (dryRun) { streakSent++; continue; }
    const ok = await sendEmail({
      to: u.email,
      subject: `🔥 Keep your ${u.streak}-day streak alive`,
      html: shell(
        `<h1 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Don't break your streak${u.name ? `, ${u.name}` : ""}!</h1>
         <p style="font-size:14px;color:#334155;">You're on a <b>${u.streak}-day</b> Daily Challenge streak. Answer today's 5 questions to keep it going.</p>`,
        "Play today's challenge",
        `${BASE_URL}/games/challenge`,
      ),
    });
    if (ok) streakSent++;
  }

  for (const u of matchdayUsers) {
    if (dryRun) { matchdaySent++; continue; }
    const ok = await sendEmail({
      to: u.email,
      subject: "Make your picks — matches kicking off soon",
      html: shell(
        `<h1 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Matchday's almost here${u.name ? `, ${u.name}` : ""}</h1>
         <p style="font-size:14px;color:#334155;">You have <b>${u.pending}</b> upcoming ${u.pending === 1 ? "match" : "matches"} to predict before kickoff. Lock in your picks and climb your league table.</p>`,
        "Make your picks",
        `${BASE_URL}/games/prode`,
      ),
    });
    if (ok) matchdaySent++;
  }

  return NextResponse.json({
    success: true,
    dryRun,
    streakAtRisk: streakUsers.length,
    streakSent,
    matchdayPending: matchdayUsers.length,
    matchdaySent,
    timestamp: new Date().toISOString(),
  });
}
