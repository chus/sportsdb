import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateNotificationSettings } from "@/lib/queries/notification-settings";

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const consent = !!body.consent;

    await db
      .update(users)
      .set({
        marketingEmailConsentAt: consent ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Consent is the legal record; email_enabled is the operational send-gate
    // the crons read. Keep them in sync so toggling consent actually starts/stops
    // the digest + reminder emails.
    await updateNotificationSettings(user.id, { emailEnabled: consent });

    return NextResponse.json({ success: true, marketingEmailConsent: consent });
  } catch (error) {
    console.error("Marketing consent update error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
