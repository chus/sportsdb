import { NextRequest, NextResponse } from "next/server";

// Detect legacy /matches/{uuid} URLs to 301 redirect to the slug-based URL.
const MATCH_UUID_PATH_RE =
  /^\/matches\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

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

  // Legacy match URL: /matches/{uuid} → 301 redirect to /matches/{slug}
  const matchUuidMatch = pathname.match(MATCH_UUID_PATH_RE);
  if (matchUuidMatch) {
    const matchId = matchUuidMatch[1];
    try {
      const lookup = await fetch(
        new URL(`/api/internal/match-slug?id=${matchId}`, request.url),
      );
      if (lookup.ok) {
        const { slug } = (await lookup.json()) as { slug: string | null };
        if (slug) {
          return NextResponse.redirect(
            new URL(`/matches/${slug}`, request.url),
            301,
          );
        }
      }
    } catch {
      // Fall through to normal handling on lookup failure
    }
    return NextResponse.next();
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
