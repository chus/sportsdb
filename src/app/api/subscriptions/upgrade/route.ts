import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getStripePriceId } from "@/lib/stripe/prices";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const upgradeSchema = z.object({
  tier: z.enum(["pro", "ultimate"]),
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tier } = upgradeSchema.parse(body);

    // Get or create Stripe customer
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);

    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      // Save customer ID
      if (sub) {
        await db
          .update(subscriptions)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(subscriptions.userId, user.id));
      } else {
        await db.insert(subscriptions).values({
          userId: user.id,
          tier: "free",
          status: "active",
          stripeCustomerId: customerId,
        });
      }
    }

    // If user already has an active Stripe subscription, update it
    if (sub?.stripeSubscriptionId) {
      const stripeSub = await stripe.subscriptions.retrieve(
        sub.stripeSubscriptionId
      );

      if (stripeSub.status === "active") {
        const priceId = await getStripePriceId(tier);
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          items: [
            {
              id: stripeSub.items.data[0].id,
              price: priceId,
            },
          ],
          proration_behavior: "create_prorations",
        });

        // Update tier in DB immediately
        await db
          .update(subscriptions)
          .set({ tier, updatedAt: new Date() })
          .where(eq(subscriptions.userId, user.id));

        return NextResponse.json({
          success: true,
          message: `Upgraded to ${tier}!`,
        });
      }
    }

    // Create Stripe Checkout session
    const priceId = await getStripePriceId(tier);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${BASE_URL}/account?upgraded=${tier}`,
      cancel_url: `${BASE_URL}/pricing`,
      metadata: {
        userId: user.id,
        tier,
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error upgrading subscription:", error);
    return NextResponse.json(
      { error: "Failed to upgrade subscription" },
      { status: 500 }
    );
  }
}
