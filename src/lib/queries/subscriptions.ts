import { db } from "@/lib/db";
import { subscriptions, usageLimits, follows } from "@/lib/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import {
  SubscriptionTier,
  getFeatureLimit,
  isUnlimited,
} from "@/lib/subscriptions/tiers";

export interface UserSubscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: "active" | "cancelled" | "past_due";
  startDate: Date;
  endDate: Date | null;
  autoRenew: boolean;
}

// Get user's subscription (creates free tier if none exists)
export async function getUserSubscription(
  userId: string
): Promise<UserSubscription> {
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId,
      tier: existing.tier as SubscriptionTier,
      status: existing.status as "active" | "cancelled" | "past_due",
      startDate: existing.startDate!,
      endDate: existing.endDate,
      autoRenew: existing.autoRenew,
    };
  }

  // Create free tier for new users
  const [newSub] = await db
    .insert(subscriptions)
    .values({
      userId,
      tier: "free",
      status: "active",
    })
    .returning();

  return {
    id: newSub.id,
    userId: newSub.userId,
    tier: "free",
    status: "active",
    startDate: newSub.startDate!,
    endDate: null,
    autoRenew: true,
  };
}

// Upgrade subscription tier
export async function upgradeSubscription(
  userId: string,
  newTier: SubscriptionTier
): Promise<UserSubscription> {
  const [updated] = await db
    .update(subscriptions)
    .set({
      tier: newTier,
      status: "active",
      startDate: new Date(),
      endDate:
        newTier === "free"
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      autoRenew: true,
      cancelledAt: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, userId))
    .returning();

  if (!updated) {
    // Create subscription if doesn't exist
    const [newSub] = await db
      .insert(subscriptions)
      .values({
        userId,
        tier: newTier,
        status: "active",
        endDate:
          newTier === "free"
            ? null
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning();

    return {
      id: newSub.id,
      userId: newSub.userId,
      tier: newTier,
      status: "active",
      startDate: newSub.startDate!,
      endDate: newSub.endDate,
      autoRenew: true,
    };
  }

  return {
    id: updated.id,
    userId: updated.userId,
    tier: updated.tier as SubscriptionTier,
    status: "active",
    startDate: updated.startDate!,
    endDate: updated.endDate,
    autoRenew: updated.autoRenew,
  };
}

// Downgrade to free tier
export async function downgradeSubscription(
  userId: string
): Promise<UserSubscription> {
  return upgradeSubscription(userId, "free");
}

// Cancel auto-renewal (keeps access until end date)
export async function cancelSubscription(userId: string): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      autoRenew: false,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, userId));
}

// Check if user can follow more entities
export async function canUserFollow(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await getUserSubscription(userId);
  const limit = getFeatureLimit(subscription.tier, "maxFollows");

  if (isUnlimited(limit)) {
    return { allowed: true };
  }

  const [result] = await db
    .select({ count: count() })
    .from(follows)
    .where(eq(follows.userId, userId));

  if (result.count >= limit) {
    return {
      allowed: false,
      reason: `Free tier is limited to ${limit} follows. Upgrade to Pro for unlimited follows.`,
    };
  }

  return { allowed: true };
}

// Get user's follow count
export async function getUserFollowCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(follows)
    .where(eq(follows.userId, userId));

  return result.count;
}

// Get remaining follows for user
export async function getRemainingFollows(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId);
  const limit = getFeatureLimit(subscription.tier, "maxFollows");

  if (isUnlimited(limit)) {
    return Infinity;
  }

  const currentCount = await getUserFollowCount(userId);
  return Math.max(0, limit - currentCount);
}

// Check and increment daily usage
export async function checkDailyUsage(
  userId: string,
  featureType: "comparison" | "api_call"
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const subscription = await getUserSubscription(userId);
  const limitKey =
    featureType === "comparison" ? "comparisonsPerDay" : "apiCallsPerDay";
  const limit = getFeatureLimit(subscription.tier, limitKey);

  if (isUnlimited(limit)) {
    return { allowed: true, used: 0, limit: Infinity };
  }

  const today = new Date().toISOString().split("T")[0];

  const [existing] = await db
    .select()
    .from(usageLimits)
    .where(
      and(
        eq(usageLimits.userId, userId),
        eq(usageLimits.featureType, featureType),
        eq(usageLimits.usageDate, today)
      )
    )
    .limit(1);

  const used = existing?.count ?? 0;

  return {
    allowed: used < limit,
    used,
    limit,
  };
}

// Increment daily usage
export async function incrementDailyUsage(
  userId: string,
  featureType: "comparison" | "api_call"
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await db
    .insert(usageLimits)
    .values({
      userId,
      featureType,
      usageDate: today,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [usageLimits.userId, usageLimits.featureType, usageLimits.usageDate],
      set: {
        count: sql`${usageLimits.count} + 1`,
      },
    });
}
