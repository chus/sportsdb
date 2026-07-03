import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { neon } from "@neondatabase/serverless";
import { sendEmail, emailConfigured } from "@/lib/email/send";
import { unsubscribeHeaders, unsubscribeFooter } from "@/lib/email/unsubscribe";
import { SUBSCRIPTION_TIERS } from "@/lib/subscriptions/tiers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Trial lifecycle emails — the conversion engine of the reverse-trial model.
 * Before this, trials expired in total silence (expire-trials just flips the
 * tier) and the only prompt was a banner the user had to happen to see.
 *
 *   day 0  trial_welcome — "here's what Pro unlocked" (transactional)
 *   day 6  trial_ending  — "your Pro access ends tomorrow" (transactional;
 *                          loss-aversion, the highest-converting send)
 *   day 9  trial_winback — annual offer, GATED on marketing consent
 *
 * email_log's (user_id, type) unique key makes the daily run idempotent —
 * safe to re-run, never double-sends.
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

async function verifyCron() {
  const auth = (await headers()).get("authorization");
  const secret = process.env.CRON_SECRET;
  return !secret || auth === `Bearer ${secret}`;
}

interface Target {
  user_id: string;
  email: string;
  name: string | null;
  end_date: string | null;
}

function shell(userId: string, body: string, cta: string, href: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    ${body}
    <div style="margin-top:24px;">
      <a href="${href}" style="background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">${cta}</a>
    </div>
    ${unsubscribeFooter({ kind: "user", id: userId })}
  </div>`;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCron())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  if (!emailConfigured() && !dryRun) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not set" });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const pro = SUBSCRIPTION_TIERS.pro;
  const counts = { welcome: 0, ending: 0, winback: 0 };

  const send = async (t: Target, type: string, subject: string, html: string) => {
    if (dryRun) return true;
    const ok = await sendEmail({
      to: t.email,
      subject,
      html,
      headers: unsubscribeHeaders({ kind: "user", id: t.user_id }),
    });
    if (ok) {
      await sql`INSERT INTO email_log (user_id, type) VALUES (${t.user_id}, ${type}) ON CONFLICT DO NOTHING`;
    }
    return ok;
  };

  // --- day 0: welcome (trial started within the last 2 days) ---
  const welcome = (await sql`
    SELECT s.user_id, u.email, u.name, s.end_date
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.status = 'trialing'
      AND s.start_date >= NOW() - INTERVAL '2 days'
      AND u.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM email_log e WHERE e.user_id = s.user_id AND e.type = 'trial_welcome')
  `) as Target[];
  for (const t of welcome) {
    const until = t.end_date ? new Date(t.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "7 days from signup";
    const ok = await send(
      t, "trial_welcome",
      "Your 7 days of DataSports Pro just started 🎉",
      shell(
        t.user_id,
        `<h1 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Welcome${t.name ? `, ${t.name}` : ""} — Pro is unlocked</h1>
         <p style="font-size:14px;color:#334155;">Until <b>${until}</b> you have full Pro access, free: unlimited player &amp; team comparisons, prediction leagues and the Daily Challenge, multi-season history, ad-free. No card, no strings — explore freely.</p>`,
        "Start exploring",
        `${BASE_URL}/dashboard`,
      ),
    );
    if (ok) counts.welcome++;
  }

  // --- day 6: ends tomorrow (loss aversion) ---
  const ending = (await sql`
    SELECT s.user_id, u.email, u.name, s.end_date
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.status = 'trialing'
      AND s.end_date BETWEEN NOW() AND NOW() + INTERVAL '36 hours'
      AND u.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM email_log e WHERE e.user_id = s.user_id AND e.type = 'trial_ending')
  `) as Target[];
  for (const t of ending) {
    const ok = await send(
      t, "trial_ending",
      "Your Pro access ends tomorrow",
      shell(
        t.user_id,
        `<h1 style="font-size:20px;color:#0f172a;margin:0 0 8px;">Don't lose Pro${t.name ? `, ${t.name}` : ""}</h1>
         <p style="font-size:14px;color:#334155;">Your free trial ends tomorrow. After that, comparisons are capped, the games lock, and history shrinks to this season. Keep everything for <b>€${pro.price}/month</b> — cancel anytime, and you keep access to the end of any period you've paid for.</p>`,
        `Keep Pro — €${pro.price}/mo`,
        `${BASE_URL}/pricing`,
      ),
    );
    if (ok) counts.ending++;
  }

  // --- day 9: win-back (consent-gated — this one is marketing) ---
  const winback = (await sql`
    SELECT s.user_id, u.email, u.name, s.end_date
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.tier = 'free'
      AND s.status = 'active'
      AND s.auto_renew = false
      AND s.stripe_subscription_id IS NULL
      AND s.end_date BETWEEN NOW() - INTERVAL '3 days' AND NOW() - INTERVAL '12 hours'
      AND u.email IS NOT NULL
      AND u.marketing_email_consent_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM email_log e WHERE e.user_id = s.user_id AND e.type = 'trial_winback')
  `) as Target[];
  for (const t of winback) {
    const ok = await send(
      t, "trial_winback",
      `Come back to Pro — €${pro.annualPrice}/year`,
      shell(
        t.user_id,
        `<h1 style="font-size:20px;color:#0f172a;margin:0 0 8px;">The stats missed you${t.name ? `, ${t.name}` : ""}</h1>
         <p style="font-size:14px;color:#334155;">Your trial ended a few days ago. If Pro was useful, the annual plan is the cheapest way back: <b>€${pro.annualPrice}/year</b> (€${(Number(pro.annualPrice) / 12).toFixed(2)}/month) — unlimited comparisons, games, full history, no ads.</p>`,
        `Get the annual deal`,
        `${BASE_URL}/pricing`,
      ),
    );
    if (ok) counts.winback++;
  }

  return NextResponse.json({
    success: true,
    dryRun,
    candidates: { welcome: welcome.length, ending: ending.length, winback: winback.length },
    sent: counts,
    timestamp: new Date().toISOString(),
  });
}
