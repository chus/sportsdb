import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getUserSubscription } from "@/lib/queries/subscriptions";
import { canAccessFeature } from "@/lib/subscriptions/tiers";
import { joinLeague } from "@/lib/queries/leagues";

const joinSchema = z.object({
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
    }

    const sub = await getUserSubscription(user.id);
    if (!canAccessFeature(sub.tier, "games")) {
      return NextResponse.json(
        { error: "Pro feature", upgradeUrl: "/pricing" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { code } = joinSchema.parse(body);

    const league = await joinLeague(user.id, code);
    return NextResponse.json(league);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Join league error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
