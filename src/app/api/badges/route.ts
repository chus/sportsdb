import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserBadges } from "@/lib/queries/predictions";

export const BADGE_INFO = {
  first_blood: {
    name: "First Blood",
    description: "Made your first prediction",
    icon: "target",
  },
  hot_streak: {
    name: "Hot Streak",
    description: "5 correct predictions in a row",
    icon: "flame",
  },
  perfect_week: {
    name: "Perfect Week",
    description: "All predictions correct in one week",
    icon: "star",
  },
  master_predictor: {
    name: "Master Predictor",
    description: "100 correct predictions",
    icon: "trophy",
  },
  early_bird: {
    name: "Early Bird",
    description: "Predicted 24+ hours before kickoff",
    icon: "clock",
  },
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const userBadges = await getUserBadges(user.id);

    const badgesWithInfo = userBadges.map((badge) => ({
      ...badge,
      info: BADGE_INFO[badge.badgeType as keyof typeof BADGE_INFO] ?? {
        name: badge.badgeType,
        description: "",
        icon: "award",
      },
    }));

    // Also return all available badges for display
    const allBadges = Object.entries(BADGE_INFO).map(([type, info]) => ({
      type,
      ...info,
      earned: userBadges.some((b) => b.badgeType === type),
      earnedAt: userBadges.find((b) => b.badgeType === type)?.earnedAt ?? null,
    }));

    return NextResponse.json({
      earned: badgesWithInfo,
      all: allBadges,
    });
  } catch (error) {
    console.error("Get badges error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
