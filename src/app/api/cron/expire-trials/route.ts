import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Expire lapsed reverse trials: any subscription still 'trialing' whose
 * end date has passed drops to Free. getUserSubscription already treats an
 * expired trial as free defensively; this persists the flip so the DB and
 * admin views stay accurate. Runs daily.
 */
async function verifyCron() {
  const auth = (await headers()).get("authorization");
  const secret = process.env.CRON_SECRET;
  return !secret || auth === `Bearer ${secret}`;
}

export async function GET() {
  if (!(await verifyCron())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await db
    .update(subscriptions)
    .set({ tier: "free", status: "active", autoRenew: false, updatedAt: new Date() })
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        lt(subscriptions.endDate, sql`now()`),
      ),
    )
    .returning({ id: subscriptions.id });

  return NextResponse.json({
    success: true,
    expired: expired.length,
    timestamp: new Date().toISOString(),
  });
}
