import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, emailConfigured } from "@/lib/email/send";
import { makeConfirmToken } from "@/lib/email/confirm";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

/**
 * Public logged-out newsletter capture — double opt-in.
 *
 * POST { email } → upsert subscriber + send a confirmation email; only
 * confirmed && !unsubscribed subscribers ever receive the weekly roundup.
 * Double opt-in is the legally safe pattern for an EU/German operator and
 * protects the domain's deliverability from typo'd/hostile signups.
 */
const schema = z.object({
  email: z.string().email().max(254),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase().trim();

    // Upsert: a re-subscribe clears a prior unsubscribe (renewed consent).
    const [existing] = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);

    let id: string;
    let alreadyConfirmed = false;
    if (existing) {
      id = existing.id;
      alreadyConfirmed = Boolean(existing.confirmedAt) && !existing.unsubscribedAt;
      await db
        .update(newsletterSubscribers)
        .set({ unsubscribedAt: null, consentedAt: new Date() })
        .where(eq(newsletterSubscribers.id, existing.id));
    } else {
      const [row] = await db
        .insert(newsletterSubscribers)
        .values({ email })
        .returning({ id: newsletterSubscribers.id });
      id = row.id;
    }

    if (!alreadyConfirmed && emailConfigured()) {
      const url = `${BASE_URL}/api/newsletter/confirm?token=${encodeURIComponent(makeConfirmToken(id))}`;
      await sendEmail({
        to: email,
        subject: "Confirm your DataSports subscription",
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h1 style="font-size:20px;color:#0f172a;margin:0 0 8px;">One click to confirm</h1>
          <p style="font-size:14px;color:#334155;">Confirm your email to get the weekly football data roundup — fresh studies, rankings and stats from DataSports. If you didn't request this, just ignore it.</p>
          <div style="margin-top:20px;"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Confirm subscription</a></div>
        </div>`,
      });
    }

    // Same response either way — don't leak whether an email is subscribed.
    return NextResponse.json({ success: true, message: "Check your inbox to confirm your subscription." });
  } catch (error) {
    console.error("Newsletter subscribe error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
