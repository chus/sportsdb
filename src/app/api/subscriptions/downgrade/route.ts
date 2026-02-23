import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { downgradeSubscription } from "@/lib/queries/subscriptions";
import { getTierConfig } from "@/lib/subscriptions/tiers";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await downgradeSubscription(user.id);
    const tierConfig = getTierConfig(subscription.tier);

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        tierConfig,
      },
      message: "Downgraded to Free tier",
    });
  } catch (error) {
    console.error("Error downgrading subscription:", error);
    return NextResponse.json(
      { error: "Failed to downgrade subscription" },
      { status: 500 }
    );
  }
}
