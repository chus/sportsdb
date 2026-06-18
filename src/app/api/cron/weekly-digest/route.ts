import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDigestRecipients, getUserDigestContent } from "@/lib/queries/digest";
import { sendEmail, emailConfigured } from "@/lib/email/send";
import { format } from "date-fns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly digest: emails opted-in users their followed teams' recent results
 * and upcoming fixtures — the outbound re-engagement channel that pulls
 * users back (the retention loop existed but had no way to reach anyone).
 * No-ops cleanly until RESEND_API_KEY is set.
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

async function verifyCron() {
  const auth = (await headers()).get("authorization");
  const secret = process.env.CRON_SECRET;
  return !secret || auth === `Bearer ${secret}`;
}

interface DM {
  slug: string;
  scheduledAt: Date;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
}

function row(m: DM, withScore: boolean): string {
  const score = withScore ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}` : format(new Date(m.scheduledAt), "EEE d MMM");
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:#0f172a;">${m.homeName} <span style="color:#64748b">vs</span> ${m.awayName}</td>
    <td style="padding:8px 0;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">
      <a href="${BASE_URL}/matches/${m.slug}" style="color:#2563eb;text-decoration:none;">${score}</a>
    </td>
  </tr>`;
}

function buildHtml(name: string | null, results: DM[], fixtures: DM[]): string {
  const section = (title: string, rows: DM[], withScore: boolean) =>
    rows.length === 0
      ? ""
      : `<h2 style="font-size:16px;color:#0f172a;margin:24px 0 8px;">${title}</h2>
         <table style="width:100%;border-collapse:collapse;">${rows.map((m) => row(m, withScore)).join("")}</table>`;
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px;">Your football week${name ? `, ${name}` : ""}</h1>
    <p style="font-size:14px;color:#64748b;margin:0 0 8px;">Results and fixtures for the teams you follow.</p>
    ${section("Recent results", results, true)}
    ${section("Upcoming fixtures", fixtures, false)}
    <div style="margin-top:28px;">
      <a href="${BASE_URL}" style="background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Open DataSports</a>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
      You're getting this because you enabled the weekly digest.
      <a href="${BASE_URL}/account" style="color:#94a3b8;">Manage email preferences</a>.
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

  const recipients = await getDigestRecipients();
  let sent = 0;
  let skippedEmpty = 0;

  for (const u of recipients) {
    if (!u.email) continue;
    const { results, fixtures } = await getUserDigestContent(u.id);
    if (results.length === 0 && fixtures.length === 0) {
      skippedEmpty++;
      continue; // nothing to say — don't send an empty email
    }
    if (dryRun) {
      sent++;
      continue;
    }
    const ok = await sendEmail({
      to: u.email,
      subject: "Your football week — results & fixtures",
      html: buildHtml(u.name, results, fixtures),
    });
    if (ok) sent++;
  }

  return NextResponse.json({
    success: true,
    dryRun,
    recipients: recipients.length,
    sent,
    skippedEmpty,
    timestamp: new Date().toISOString(),
  });
}
