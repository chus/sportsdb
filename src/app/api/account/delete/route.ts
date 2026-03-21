import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getCurrentUser,
  verifyPassword,
  deleteSessionCookie,
} from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const deleteAccountSchema = z.object({
  password: z.string().optional(),
  email: z.string().email().optional(),
  confirmation: z.string().refine((val) => val === "DELETE", {
    message: "Please type DELETE to confirm",
  }),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { password, email } = deleteAccountSchema.parse(body);

    // Verify identity
    if (user.passwordHash) {
      // Password-based user: verify password
      if (!password) {
        return NextResponse.json({ error: "Password is required" }, { status: 400 });
      }
      const validPassword = await verifyPassword(password, user.passwordHash);
      if (!validPassword) {
        return NextResponse.json({ error: "Password is incorrect" }, { status: 400 });
      }
    } else {
      // Google-only user: verify email
      if (!email || email.toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json({ error: "Please enter your email address to confirm deletion" }, { status: 400 });
      }
    }

    // Cancel active Stripe subscription if exists
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (sub?.stripeSubscriptionId && sub.status === "active") {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      }
    } catch (stripeError) {
      console.error("Failed to cancel Stripe subscription:", stripeError);
      // Continue with deletion even if Stripe cancel fails
    }

    // Delete user (sessions and related data will cascade)
    await db.delete(users).where(eq(users.id, user.id));

    // Clear session cookie
    await deleteSessionCookie();

    return NextResponse.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
