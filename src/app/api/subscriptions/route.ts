import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserSubscription } from "@/lib/queries/subscriptions";
import { getTierConfig } from "@/lib/subscriptions/tiers";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);
    const tierConfig = getTierConfig(subscription.tier);

    return NextResponse.json({
      subscription: {
        ...subscription,
        tierConfig,
      },
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
