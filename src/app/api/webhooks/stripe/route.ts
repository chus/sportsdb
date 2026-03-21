import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions, users, referralEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

      // Handle referral reward for the referrer
      try {
        const [subscriber] = await db
          .select({ id: users.id, referredBy: users.referredBy })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (subscriber?.referredBy) {
          // Log subscription_activated event
          await db.insert(referralEvents).values({
            referrerUserId: subscriber.referredBy,
            referredUserId: subscriber.id,
            eventType: "subscription_activated",
          });

          // Find the referrer's Stripe subscription to apply reward
          const [referrerSub] = await db
            .select({
              stripeSubscriptionId: subscriptions.stripeSubscriptionId,
              stripeCustomerId: subscriptions.stripeCustomerId,
            })
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.userId, subscriber.referredBy),
                eq(subscriptions.status, "active")
              )
            )
            .limit(1);

          if (
            referrerSub?.stripeSubscriptionId &&
            referrerSub?.stripeCustomerId
          ) {
            // Create a coupon for 1 month free and apply to referrer
            const coupon = await stripe.coupons.create({
              duration: "once",
              percent_off: 100,
              name: `Referral reward - 1 month free`,
              max_redemptions: 1,
            });

            await stripe.subscriptions.update(
              referrerSub.stripeSubscriptionId,
              { discounts: [{ coupon: coupon.id }] }
            );

            // Log reward_applied event
            await db.insert(referralEvents).values({
              referrerUserId: subscriber.referredBy,
              referredUserId: subscriber.id,
              eventType: "reward_applied",
              metadata: { couponId: coupon.id, reward: "1_month_free" },
            });

            console.log(
              `Referral reward applied: referrer=${subscriber.referredBy} coupon=${coupon.id}`
            );
          } else {
            // Referrer doesn't have an active subscription — store pending credit
            await db.insert(referralEvents).values({
              referrerUserId: subscriber.referredBy,
              referredUserId: subscriber.id,
              eventType: "reward_applied",
              metadata: { status: "pending", reason: "referrer_not_subscribed" },
            });

            console.log(
              `Referral reward pending: referrer=${subscriber.referredBy} (no active subscription)`
            );
          }
        }
      } catch (refErr) {
        // Don't fail the webhook for referral errors
        console.error("Referral reward error:", refErr);
      }

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

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      console.log(
        `Payment failed: customer=${customerId} amount=${invoice.amount_due} attempt=${invoice.attempt_count}`
      );
      // Don't downgrade — Stripe retries automatically.
      // Status will update via customer.subscription.updated → past_due if retries exhaust.
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
