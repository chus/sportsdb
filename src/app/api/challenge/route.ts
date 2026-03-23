import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getUserSubscription } from "@/lib/queries/subscriptions";
import { canAccessFeature } from "@/lib/subscriptions/tiers";
import {
  getDailyQuestions,
  submitChallengeAnswer,
  getUserDailyProgress,
} from "@/lib/queries/challenge";

const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0).max(3),
});

export async function GET(request: NextRequest) {
  try {
    const questions = await getDailyQuestions();

    // Strip correct answers for public response
    const safeQuestions = questions.map(({ correctIndex, ...q }) => q);

    // If user is logged in, include their progress
    const user = await getCurrentUser();
    let progress = null;
    if (user) {
      progress = await getUserDailyProgress(user.id);
    }

    return NextResponse.json({ questions: safeQuestions, progress });
  } catch (error) {
    console.error("Get challenge error:", error);
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
    if (!canAccessFeature(sub.tier, "games")) {
      return NextResponse.json(
        { error: "Pro feature", upgradeUrl: "/pricing" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { questionId, selectedIndex } = answerSchema.parse(body);

    const answer = await submitChallengeAnswer(user.id, questionId, selectedIndex);
    return NextResponse.json(answer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Submit challenge answer error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
