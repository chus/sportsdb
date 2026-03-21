import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { referralEvents, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const trackSchema = z.object({
  referralCode: z.string(),
  eventType: z.enum([
    "link_clicked",
    "signup_completed",
    "subscription_activated",
    "reward_applied",
  ]),
  referredUserId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode, eventType, referredUserId, metadata } =
      trackSchema.parse(body);

    // Look up referrer by code
    const [referrer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, referralCode))
      .limit(1);

    if (!referrer) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 400 }
      );
    }

    await db.insert(referralEvents).values({
      referrerUserId: referrer.id,
      referredUserId: referredUserId || null,
      eventType,
      metadata: metadata || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Referral track error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
