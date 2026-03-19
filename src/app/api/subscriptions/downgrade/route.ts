import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    if (!sub) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    // Cancel Stripe subscription if it exists
    if (sub.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    }

    // Downgrade to free in DB
    await db
      .update(subscriptions)
      .set({
        tier: "free",
        status: "active",
        stripeSubscriptionId: null,
        endDate: null,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, user.id));

    return NextResponse.json({
      success: true,
      message: "Downgraded to Free tier",
    });
  } catch (error) {
    console.error("Error downgrading subscription:", error);
    return NextResponse.json(
      { error: "Failed to downgrade subscription" },
      { status: 500 }
    );
  }
}
