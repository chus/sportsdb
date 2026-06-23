import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDigestRecipients } from "@/lib/queries/digest";
import { listStudies } from "@/lib/queries/studies";
import { sendEmail, emailConfigured } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly "data roundup" newsletter — the freshly-generated data studies as an
 * owned-audience channel (retention + distribution independent of Google).
 * Sent to the same opted-in audience as the digest. No-ops without email set up.
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

async function verifyCron() {
  const auth = (await headers()).get("authorization");
  const secret = process.env.CRON_SECRET;
  return !secret || auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCron())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  if (!emailConfigured() && !dryRun) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not set" });
  }

  const studies = (await listStudies()).slice(0, 5);
  if (studies.length === 0) {
    return NextResponse.json({ skipped: true, reason: "no studies yet" });
  }

  const cards = studies
    .map((s) => {
      const top3 = s.data.rows
        .slice(0, 3)
        .map((r, i) => `<tr><td style="padding:2px 8px 2px 0;font-size:13px;color:#64748b;">${i + 1}. ${r.player}</td><td style="padding:2px 0;font-size:13px;color:#0f172a;font-weight:600;text-align:right;">${Object.values(r.values)[0]}</td></tr>`)
        .join("");
      return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;">
        <a href="${BASE_URL}/studies/${s.slug}" style="font-size:15px;font-weight:700;color:#0f172a;text-decoration:none;">${s.title}</a>
        <p style="font-size:13px;color:#64748b;margin:4px 0 8px;">${s.dek}</p>
        <table style="border-collapse:collapse;">${top3}</table>
        <a href="${BASE_URL}/studies/${s.slug}" style="display:inline-block;margin-top:8px;font-size:12px;color:#2563eb;">Full study &rarr;</a>
      </div>`;
    })
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px;">This week in football data</h1>
    <p style="font-size:14px;color:#64748b;margin:0 0 16px;">Fresh data studies from DataSports — free to read and cite.</p>
    ${cards}
    <div style="margin-top:20px;"><a href="${BASE_URL}/studies" style="background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">All studies</a></div>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px;">You're getting this because you enabled email updates.
      <a href="${BASE_URL}/account" style="color:#94a3b8;">Manage preferences</a>.</p>
  </div>`;

  const recipients = await getDigestRecipients();
  let sent = 0;
  if (!dryRun) {
    for (const u of recipients) {
      if (!u.email) continue;
      if (await sendEmail({ to: u.email, subject: "📊 This week in football data", html })) sent++;
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    studies: studies.length,
    recipients: recipients.length,
    sent,
    timestamp: new Date().toISOString(),
  });
}
