import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getWeekOverWeek, type WeekOverWeek } from "@/lib/seo/gsc";
import { checkCitations } from "@/lib/seo/geo-citations";
import { sendEmail, emailConfigured } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Read-only SEO + GEO monitoring agent (weekly).
 *   - Search Console week-over-week: clicks / impressions / CTR / position,
 *     top queries & pages, and the queries that lost the most clicks.
 *   - AI-citation tracking: whether AI answer engines cite datasports.co.
 * Emails the operator a digest and flags significant drops in the subject.
 *
 * Monitoring only — it can't get the site penalized or banned. Degrades
 * cleanly: no GSC service-account access → reports a setup reminder; no
 * Perplexity key → skips the GEO section.
 */
async function verifyCron() {
  const auth = (await headers()).get("authorization");
  const secret = process.env.CRON_SECRET;
  return !secret || auth === `Bearer ${secret}`;
}

const pct = (cur: number, prior: number): number =>
  prior === 0 ? (cur > 0 ? 100 : 0) : ((cur - prior) / prior) * 100;

function delta(cur: number, prior: number, opts: { invert?: boolean; digits?: number } = {}): string {
  const d = pct(cur, prior);
  const good = opts.invert ? d < 0 : d > 0;
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "→";
  const color = d === 0 ? "#64748b" : good ? "#16a34a" : "#dc2626";
  return `<span style="color:${color};font-size:12px;">${arrow} ${Math.abs(d).toFixed(0)}%</span>`;
}

function metricRow(label: string, cur: number, prior: number, fmt: (n: number) => string, invert = false): string {
  return `<tr>
    <td style="padding:6px 0;font-size:14px;color:#334155;">${label}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">${fmt(cur)}</td>
    <td style="padding:6px 0 6px 12px;text-align:right;">${delta(cur, prior, { invert })}</td>
  </tr>`;
}

function buildEmail(wow: WeekOverWeek, geo: Awaited<ReturnType<typeof checkCitations>>): string {
  const f0 = (n: number) => Math.round(n).toLocaleString();
  const fPct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const fPos = (n: number) => n.toFixed(1);

  const gscSection =
    wow.status === "ok"
      ? `<table style="width:100%;border-collapse:collapse;">
           ${metricRow("Clicks", wow.current.clicks, wow.prior.clicks, f0)}
           ${metricRow("Impressions", wow.current.impressions, wow.prior.impressions, f0)}
           ${metricRow("CTR", wow.current.ctr, wow.prior.ctr, fPct)}
           ${metricRow("Avg position", wow.current.position, wow.prior.position, fPos, true)}
         </table>
         <h3 style="font-size:14px;color:#0f172a;margin:20px 0 6px;">Top queries</h3>
         <table style="width:100%;border-collapse:collapse;">${
           wow.topQueries.slice(0, 10).map((r) =>
             `<tr><td style="padding:4px 0;font-size:13px;color:#334155;">${r.keys[0]}</td>
              <td style="padding:4px 0;font-size:13px;color:#0f172a;text-align:right;">${r.clicks} clk · ${r.impressions} imp · #${r.position.toFixed(0)}</td></tr>`
           ).join("") || `<tr><td style="font-size:13px;color:#94a3b8;">No query data yet.</td></tr>`
         }</table>
         ${wow.decliningQueries.length ? `<h3 style="font-size:14px;color:#0f172a;margin:20px 0 6px;">Biggest click drops</h3>
         <table style="width:100%;border-collapse:collapse;">${
           wow.decliningQueries.map((d) =>
             `<tr><td style="padding:4px 0;font-size:13px;color:#334155;">${d.query}</td>
              <td style="padding:4px 0;font-size:13px;color:#dc2626;text-align:right;">${d.prior} → ${d.current} (${d.delta})</td></tr>`
           ).join("")
         }</table>` : ""}`
      : wow.status === "not_authorized"
        ? `<p style="font-size:14px;color:#b45309;">⚠️ Search Console not connected. Add the service account email as a user on the datasports.co property (Settings → Users and permissions) to enable GSC monitoring.</p>`
        : wow.status === "no_credentials"
          ? `<p style="font-size:14px;color:#b45309;">GOOGLE_SERVICE_ACCOUNT_JSON not set — GSC monitoring skipped.</p>`
          : `<p style="font-size:14px;color:#b45309;">GSC query error — see logs.</p>`;

  const geoSection =
    geo.status === "ok"
      ? `<p style="font-size:14px;color:#334155;">Cited by AI in <b>${geo.citedCount}/${geo.results.length}</b> sample queries.</p>
         <table style="width:100%;border-collapse:collapse;">${
           geo.results.map((r) =>
             `<tr><td style="padding:4px 0;font-size:13px;color:#334155;">${r.cited ? "✅" : "—"} ${r.query}</td>
              <td style="padding:4px 0;font-size:12px;color:#94a3b8;text-align:right;">${r.citedDomains.slice(0, 4).join(", ")}</td></tr>`
           ).join("")
         }</table>`
      : geo.status === "no_credentials"
        ? `<p style="font-size:13px;color:#94a3b8;">PERPLEXITY_API_KEY not set — AI-citation tracking skipped.</p>`
        : `<p style="font-size:13px;color:#94a3b8;">GEO check error — see logs.</p>`;

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px;">DataSports — weekly SEO & GEO report</h1>
    <p style="font-size:13px;color:#64748b;margin:0 0 16px;">Search Console week-over-week${
      wow.status === "ok" ? ` (${wow.window.current[0]} → ${wow.window.current[1]})` : ""
    }</p>
    ${gscSection}
    <h2 style="font-size:16px;color:#0f172a;margin:24px 0 6px;">AI answer-engine citations</h2>
    ${geoSection}
    <p style="font-size:12px;color:#94a3b8;margin-top:24px;">Automated monitoring. Reply-to-self only.</p>
  </div>`;
}

export async function GET() {
  if (!(await verifyCron())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [wow, geo] = await Promise.all([getWeekOverWeek(), checkCitations()]);

  // Alert if clicks dropped >30% on a non-trivial base, or avg position
  // worsened by 3+ places.
  const clicksDrop = wow.status === "ok" && wow.prior.clicks >= 20 && pct(wow.current.clicks, wow.prior.clicks) <= -30;
  const posDrop = wow.status === "ok" && wow.current.position - wow.prior.position >= 3 && wow.prior.position > 0;
  const alert = clicksDrop || posDrop;

  const to = process.env.OPERATOR_EMAIL;
  let emailed = false;
  if (to && emailConfigured()) {
    emailed = await sendEmail({
      to,
      subject: `${alert ? "⚠️ " : ""}DataSports weekly SEO/GEO report`,
      html: buildEmail(wow, geo),
    });
  }

  return NextResponse.json({
    success: true,
    alert,
    emailed,
    operatorEmailSet: Boolean(to),
    gscStatus: wow.status,
    geoStatus: geo.status,
    current: wow.status === "ok" ? wow.current : null,
    prior: wow.status === "ok" ? wow.prior : null,
    geoCited: geo.status === "ok" ? `${geo.citedCount}/${geo.results.length}` : null,
    timestamp: new Date().toISOString(),
  });
}
