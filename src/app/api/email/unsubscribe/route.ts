import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * Tokenized one-click unsubscribe — no login required.
 *   GET  — human clicking the footer link; flips the flag and shows a page.
 *   POST — RFC 8058 List-Unsubscribe-Post one-click from mail clients.
 * Registered users: notification_settings.email_enabled=false + consent
 * withdrawn. Anonymous newsletter subscribers: unsubscribed_at stamped.
 */
async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  const subject = verifyUnsubscribeToken(token);
  if (!subject) return false;

  if (subject.kind === "user") {
    await db.execute(sql`
      UPDATE notification_settings SET email_enabled = false, updated_at = now()
      WHERE user_id = ${subject.id}::uuid
    `);
    await db.execute(sql`
      UPDATE users SET marketing_email_consent_at = NULL, updated_at = now()
      WHERE id = ${subject.id}::uuid
    `);
  } else {
    await db.execute(sql`
      UPDATE newsletter_subscribers SET unsubscribed_at = now()
      WHERE id = ${subject.id}::uuid AND unsubscribed_at IS NULL
    `);
  }
  return true;
}

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
     <body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#0f172a;">
       <h1 style="font-size:22px;">${title}</h1>
       <p style="color:#475569;font-size:15px;">${body}</p>
       <p style="margin-top:24px;"><a href="https://datasports.co" style="color:#2563eb;">← Back to DataSports</a></p>
     </body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const ok = await unsubscribe(request.nextUrl.searchParams.get("token"));
    return ok
      ? page("You're unsubscribed", "You won't receive further emails from DataSports. You can re-enable them anytime from your account settings.")
      : page("Invalid link", "This unsubscribe link is invalid or has expired.", 400);
  } catch (err) {
    console.error("[unsubscribe] error:", err);
    return page("Something went wrong", "Please try again, or manage your preferences from your account.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ok = await unsubscribe(request.nextUrl.searchParams.get("token"));
    return NextResponse.json({ success: ok }, { status: ok ? 200 : 400 });
  } catch (err) {
    console.error("[unsubscribe] error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
