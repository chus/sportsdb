import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyConfirmToken } from "@/lib/email/confirm";

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
     <body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#0f172a;">
       <h1 style="font-size:22px;">${title}</h1>
       <p style="color:#475569;font-size:15px;">${body}</p>
       <p style="margin-top:24px;"><a href="https://datasports.co/studies" style="color:#2563eb;">Browse the latest data studies →</a></p>
     </body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const id = token ? verifyConfirmToken(token) : null;
    if (!id) return page("Invalid link", "This confirmation link is invalid or has expired.", 400);

    await db
      .update(newsletterSubscribers)
      .set({ confirmedAt: new Date(), unsubscribedAt: null })
      .where(eq(newsletterSubscribers.id, id));

    return page("You're in! 🎉", "Your subscription is confirmed — the weekly football data roundup lands every Sunday.");
  } catch (err) {
    console.error("[newsletter-confirm] error:", err);
    return page("Something went wrong", "Please try the link again in a moment.", 500);
  }
}
