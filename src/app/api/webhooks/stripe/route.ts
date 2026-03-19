import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;

      if (!userId || !tier) break;

      const stripeSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      await db
        .update(subscriptions)
        .set({
          tier,
          status: "active",
          stripeSubscriptionId: stripeSubscriptionId || null,
          stripeCustomerId: session.customer as string,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: true,
          cancelledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId));

      console.log(`Subscription activated: user=${userId} tier=${tier}`);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeCustomerId, customerId))
        .limit(1);

      if (!existing) break;

      const status =
        sub.status === "active"
          ? "active"
          : sub.status === "past_due"
            ? "past_due"
            : "cancelled";

      // Get period end from the first subscription item
      const periodEnd = sub.items?.data?.[0]?.current_period_end;

      await db
        .update(subscriptions)
        .set({
          status,
          autoRenew: !sub.cancel_at_period_end,
          endDate: periodEnd ? new Date(periodEnd * 1000) : null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));

      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      await db
        .update(subscriptions)
        .set({
          tier: "free",
          status: "active",
          stripeSubscriptionId: null,
          endDate: null,
          autoRenew: true,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeCustomerId, customerId));

      console.log(`Subscription cancelled: customer=${customerId}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
