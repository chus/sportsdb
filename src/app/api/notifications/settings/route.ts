import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/queries/notification-settings";

const updateSchema = z.object({
  goals: z.boolean().optional(),
  matchStart: z.boolean().optional(),
  matchResult: z.boolean().optional(),
  milestone: z.boolean().optional(),
  transfer: z.boolean().optional(),
  upcomingMatch: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  achievement: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const settings = await getNotificationSettings(user.id);
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get notification settings error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const updates = updateSchema.parse(body);

    const settings = await updateNotificationSettings(user.id, updates);
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Update notification settings error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
