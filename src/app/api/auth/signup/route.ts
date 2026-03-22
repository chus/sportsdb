import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createUser,
  getUserByEmail,
  createSession,
  setSessionCookie,
  createEmailVerificationToken,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { users, referralEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).optional(),
  referralCode: z.string().optional(),
  marketingEmailConsent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, referralCode: bodyRefCode, marketingEmailConsent } =
      signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Create user with consent timestamp
    const user = await createUser(email, password, name, true, marketingEmailConsent);

    // Resolve referral code: body param takes priority, then cookie fallback
    const refCode =
      bodyRefCode || request.cookies.get("ref_code")?.value || null;

    if (refCode) {
      const [referrer] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.referralCode, refCode))
        .limit(1);

      if (referrer) {
        await db
          .update(users)
          .set({ referredBy: referrer.id })
          .where(eq(users.id, user.id));

        // Log signup_completed referral event
        await db.insert(referralEvents).values({
          referrerUserId: referrer.id,
          referredUserId: user.id,
          eventType: "signup_completed",
        });
      }
    }

    // Create email verification token (for future email sending)
    await createEmailVerificationToken(user.id);

    // Create session
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] || undefined;
    const session = await createSession(user.id, userAgent, ipAddress);

    // Set session cookie
    await setSessionCookie(session.token);

    // Build response and clear ref_code cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
    });

    // Clear the referral cookie after use
    if (refCode) {
      response.cookies.set("ref_code", "", { maxAge: 0, path: "/" });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
