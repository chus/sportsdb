import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { referralEvents, users } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get funnel counts for this referrer
    const funnelCounts = await db
      .select({
        eventType: referralEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(referralEvents)
      .where(eq(referralEvents.referrerUserId, user.id))
      .groupBy(referralEvents.eventType);

    const counts: Record<string, number> = {};
    for (const row of funnelCounts) {
      counts[row.eventType] = row.count;
    }

    // Get referred users with their status
    const referredUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.referredBy, user.id))
      .orderBy(desc(users.createdAt))
      .limit(20);

    // Check subscription status for each referred user
    const referredWithStatus = await Promise.all(
      referredUsers.map(async (referred) => {
        const [subEvent] = await db
          .select({ id: referralEvents.id })
          .from(referralEvents)
          .where(
            and(
              eq(referralEvents.referredUserId, referred.id),
              eq(referralEvents.eventType, "subscription_activated")
            )
          )
          .limit(1);

        return {
          name: referred.name || referred.email?.split("@")[0] || "User",
          joinedAt: referred.createdAt,
          status: subEvent ? "subscribed" : "signed_up",
        };
      })
    );

    return NextResponse.json({
      signups: counts["signup_completed"] || 0,
      subscriptions: counts["subscription_activated"] || 0,
      rewardsEarned: counts["reward_applied"] || 0,
      referredUsers: referredWithStatus,
    });
  } catch (error) {
    console.error("Referral stats error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
