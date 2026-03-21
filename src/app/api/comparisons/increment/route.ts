import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  checkDailyUsage,
  incrementDailyUsage,
} from "@/lib/queries/subscriptions";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, used, limit } = await checkDailyUsage(
      user.id,
      "comparison"
    );

    if (!allowed) {
      return NextResponse.json(
        {
          error: "Daily comparison limit reached",
          used,
          limit,
        },
        { status: 429 }
      );
    }

    await incrementDailyUsage(user.id, "comparison");

    return NextResponse.json({
      success: true,
      used: used + 1,
      limit,
    });
  } catch (error) {
    console.error("Error incrementing comparison usage:", error);
    return NextResponse.json(
      { error: "Failed to record usage" },
      { status: 500 }
    );
  }
}
