import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Capture referral code from ?ref= param on any page
  const refCode = searchParams.get("ref");
  let response: NextResponse | null = null;

  if (refCode) {
    // Strip ?ref= from URL to keep URLs clean, then set cookie
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete("ref");
    response = NextResponse.redirect(cleanUrl);
    response.cookies.set("ref_code", refCode, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
    return response;
  }

  // Only protect /admin routes
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionToken = request.cookies.get("session_token")?.value;
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verify admin role via API
  const res = await fetch(new URL("/api/auth/me", request.url), {
    headers: { cookie: `session_token=${sessionToken}` },
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const data = await res.json();
  if (!data.user || data.user.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
