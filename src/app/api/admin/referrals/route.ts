import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { referralEvents, users } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET() {
  try {
    // Funnel counts
    const funnelCounts = await db
      .select({
        eventType: referralEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(referralEvents)
      .groupBy(referralEvents.eventType);

    const funnel: Record<string, number> = {
      link_clicked: 0,
      signup_completed: 0,
      subscription_activated: 0,
      reward_applied: 0,
    };
    for (const row of funnelCounts) {
      funnel[row.eventType] = row.count;
    }

    // Top referrers
    const topReferrers = await db
      .select({
        userId: referralEvents.referrerUserId,
        name: users.name,
        email: users.email,
        signups: sql<number>`count(*) FILTER (WHERE ${referralEvents.eventType} = 'signup_completed')::int`,
        subscriptions: sql<number>`count(*) FILTER (WHERE ${referralEvents.eventType} = 'subscription_activated')::int`,
        rewards: sql<number>`count(*) FILTER (WHERE ${referralEvents.eventType} = 'reward_applied')::int`,
      })
      .from(referralEvents)
      .innerJoin(users, eq(users.id, referralEvents.referrerUserId))
      .groupBy(referralEvents.referrerUserId, users.name, users.email)
      .orderBy(
        desc(
          sql`count(*) FILTER (WHERE ${referralEvents.eventType} = 'signup_completed')`
        )
      )
      .limit(20);

    // Recent events
    const recentEvents = await db
      .select({
        id: referralEvents.id,
        eventType: referralEvents.eventType,
        createdAt: referralEvents.createdAt,
        referrerName: sql<string>`r.name`,
        referrerEmail: sql<string>`r.email`,
        referredName: sql<string | null>`ref.name`,
        referredEmail: sql<string | null>`ref.email`,
      })
      .from(referralEvents)
      .innerJoin(sql`users r`, sql`r.id = ${referralEvents.referrerUserId}`)
      .leftJoin(sql`users ref`, sql`ref.id = ${referralEvents.referredUserId}`)
      .orderBy(desc(referralEvents.createdAt))
      .limit(50);

    return NextResponse.json({
      funnel,
      topReferrers,
      recentEvents,
    });
  } catch (error) {
    console.error("Admin referrals error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
