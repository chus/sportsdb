import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { generateAllStudies } from "@/lib/studies/generators";
import { draftPitch } from "@/lib/studies/pitch";
import { draftNarrative } from "@/lib/studies/narrative";
import { upsertStudy } from "@/lib/queries/studies";
import { sendEmail, emailConfigured } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Weekly data-study generator (digital-PR engine).
 *   - Refreshes every study page from current-season data (each stays a
 *     stable, freshening SEO asset — original rankings, not thin pages).
 *   - Features one study on rotation, drafts an outreach pitch for it, and
 *     emails the operator the link + editable pitch to send to reporters.
 * The agent generates + drafts; the human edits the insight and sends.
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

async function verifyCron() {
  const auth = (await headers()).get("authorization");
  const secret = process.env.CRON_SECRET;
  return !secret || auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCron())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  const generatedAt = new Date().toISOString();
  const all = await generateAllStudies(generatedAt);
  if (all.length === 0) {
    return NextResponse.json({ success: true, generated: 0, reason: "no current-season data yet" });
  }

  // Feature one study on rotation (≈ every all.length weeks).
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const featured = all[Math.floor(dayOfYear / 7) % all.length];

  const pitch = dryRun ? null : await draftPitch(featured);

  if (!dryRun) {
    for (const study of all) {
      // Grounded analyst intro for each study (cheap; null without an API key).
      study.data.narrative = (await draftNarrative(study)) ?? undefined;
      await upsertStudy(study, study.slug === featured.slug ? pitch : null);
    }
  }

  // Email the operator the featured study + its draft pitch.
  const to = process.env.OPERATOR_EMAIL;
  let emailed = false;
  if (!dryRun && to && emailConfigured()) {
    const url = `${BASE_URL}/studies/${featured.slug}`;
    const top5 = featured.data.rows
      .slice(0, 5)
      .map((r) => `<tr><td style="padding:3px 8px 3px 0;font-size:13px;">${r.rank}. ${r.player}</td><td style="padding:3px 0;font-size:13px;color:#0f172a;font-weight:600;">${Object.values(r.values)[0]}</td></tr>`)
      .join("");
    emailed = await sendEmail({
      to,
      subject: `📊 New data study to pitch: ${featured.title}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h1 style="font-size:19px;color:#0f172a;margin:0 0 4px;">${featured.title}</h1>
        <p style="font-size:14px;color:#64748b;margin:0 0 12px;">${featured.dek}</p>
        <table style="border-collapse:collapse;margin-bottom:16px;">${top5}</table>
        <p style="font-size:13px;margin:0 0 16px;"><a href="${url}" style="color:#2563eb;">${url}</a></p>
        ${pitch ? `<h2 style="font-size:15px;color:#0f172a;margin:16px 0 6px;">Draft pitch (edit before sending)</h2>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">${pitch.replace(/</g, "&lt;")}</pre>` : `<p style="font-size:12px;color:#94a3b8;">No pitch draft (OPENAI_API_KEY not set).</p>`}
        <p style="font-size:12px;color:#94a3b8;margin-top:20px;">Send to a reporter query (HARO/Qwoted) or a football writer. Edit in a real insight first — don't send verbatim.</p>
      </div>`,
    });
  }

  return NextResponse.json({
    success: true,
    dryRun,
    generated: all.length,
    studies: all.map((s) => ({ slug: s.slug, rows: s.data.rows.length })),
    featured: featured.slug,
    pitchDrafted: Boolean(pitch),
    emailed,
    timestamp: generatedAt,
  });
}
