import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { upgradeSubscription } from "@/lib/queries/subscriptions";
import { getTierConfig, SubscriptionTier } from "@/lib/subscriptions/tiers";

const upgradeSchema = z.object({
  tier: z.enum(["pro", "ultimate"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tier } = upgradeSchema.parse(body);

    // In production, this would initiate Stripe checkout
    // For now, we just upgrade directly (mock)
    const subscription = await upgradeSubscription(user.id, tier as SubscriptionTier);
    const tierConfig = getTierConfig(subscription.tier);

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        tierConfig,
      },
      message: `Successfully upgraded to ${tierConfig.name}!`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error upgrading subscription:", error);
    return NextResponse.json(
      { error: "Failed to upgrade subscription" },
      { status: 500 }
    );
  }
}
