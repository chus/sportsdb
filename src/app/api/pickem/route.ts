import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getUserSubscription } from "@/lib/queries/subscriptions";
import { canAccessFeature, getFeatureLimit } from "@/lib/subscriptions/tiers";
import {
  submitPickem,
  getUserPickems,
  getUserPickemCountForMatchday,
} from "@/lib/queries/pickem";
import { db } from "@/lib/db";
import { matches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const submitSchema = z.object({
  matchId: z.string().uuid(),
  outcome: z.enum(["home", "draw", "away"]),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const pickems = await getUserPickems(user.id, limit, offset);
    return NextResponse.json({ pickems });
  } catch (error) {
    console.error("Get pickems error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
    }

    const sub = await getUserSubscription(user.id);
    const hasGames = canAccessFeature(sub.tier, "games");

    const body = await request.json();
    const { matchId, outcome } = submitSchema.parse(body);

    // If free user, enforce one-free-per-matchday limit
    if (!hasGames) {
      const [match] = await db
        .select({
          competitionSeasonId: matches.competitionSeasonId,
          matchday: matches.matchday,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

      if (!match) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
      }

      if (match.matchday) {
        const pickemCount = await getUserPickemCountForMatchday(
          user.id,
          match.competitionSeasonId,
          match.matchday
        );

        const freeLimit = getFeatureLimit(sub.tier, "pickemFreePerMatchday" as any);
        if (pickemCount >= freeLimit) {
          return NextResponse.json(
            { error: "Pro feature", freePickUsed: true, upgradeUrl: "/pricing" },
            { status: 403 }
          );
        }
      }
    }

    const pickem = await submitPickem(user.id, matchId, outcome);
    return NextResponse.json(pickem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Submit pickem error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
