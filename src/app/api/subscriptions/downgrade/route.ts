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

    if (sub.stripeSubscriptionId) {
      // Paid subscription: cancel at period end so the user keeps what they
      // paid for (this is also what the pricing FAQ promises). The Stripe
      // customer.subscription.deleted webhook flips the tier to free when the
      // period actually ends; customer.subscription.updated records
      // autoRenew=false immediately.
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await db
        .update(subscriptions)
        .set({
          autoRenew: false,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, user.id));

      return NextResponse.json({
        success: true,
        message: "Your plan will end at the close of the current billing period — you keep Pro until then.",
      });
    }

    // No paid Stripe subscription (e.g. ending a reverse trial early):
    // nothing paid to honor, downgrade immediately.
    await db
      .update(subscriptions)
      .set({
        tier: "free",
        status: "active",
        stripeSubscriptionId: null,
        endDate: null,
        autoRenew: false,
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
