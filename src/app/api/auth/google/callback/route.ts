import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getUserByGoogleId,
  getUserByEmail,
  createUserFromGoogle,
  linkGoogleAccount,
  createSession,
  setSessionCookie,
} from "@/lib/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/google/callback`;

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  verified_email: boolean;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_invalid`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_state`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(`${baseUrl}/login?error=google_token`);
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(`${baseUrl}/login?error=google_userinfo`);
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    // Find or create user
    let user = await getUserByGoogleId(googleUser.id);

    if (!user) {
      // Check if user exists with same email
      const existingUser = await getUserByEmail(googleUser.email);

      if (existingUser) {
        // Link Google account to existing user
        await linkGoogleAccount(
          existingUser.id,
          googleUser.id,
          googleUser.picture
        );
        user = existingUser;
      } else {
        // Create new user from Google
        user = await createUserFromGoogle(
          googleUser.email,
          googleUser.name || null,
          googleUser.picture || null,
          googleUser.id
        );
      }
    }

    // Create session
    const userAgent = request.headers.get("user-agent") || undefined;
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      undefined;
    const session = await createSession(user.id, userAgent, ip);
    await setSessionCookie(session.token);

    return NextResponse.redirect(`${baseUrl}/dashboard`);
  } catch {
    return NextResponse.redirect(`${baseUrl}/login?error=google_error`);
  }
}
