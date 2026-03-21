import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkDailyUsage } from "@/lib/queries/subscriptions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await checkDailyUsage(user.id, "comparison");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking comparison usage:", error);
    return NextResponse.json(
      { error: "Failed to check usage" },
      { status: 500 }
    );
  }
}
