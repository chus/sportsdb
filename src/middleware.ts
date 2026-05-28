import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Detect legacy /matches/{uuid} URLs to 301 redirect to the slug-based URL.
const MATCH_UUID_PATH_RE =
  /^\/matches\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Legacy / external competition slugs → canonical slugs stored in the DB.
// Each entry 301-redirects /competitions/{alias}/... to /competitions/{canonical}/...
// preserving sub-paths and querystrings. Add entries here for historical slugs
// or common alternate names that have inbound links.
const COMPETITION_SLUG_ALIASES: Record<string, string> = {
  "primera-division": "la-liga",
  "champions-league": "uefa-champions-league",
  "world-cup": "fifa-world-cup",
};

const CANONICAL_HOST = "datasports.co";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // Redirect Vercel preview domains to canonical domain
  // Prevents duplicate content and "Site Behavior: Navigation" issues in AdSense
  if (host.includes("vercel.app") && !pathname.startsWith("/api/")) {
    const canonicalUrl = new URL(pathname, `https://${CANONICAL_HOST}`);
    canonicalUrl.search = searchParams.toString();
    return NextResponse.redirect(canonicalUrl, 301);
  }

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

  // Strip locale prefix for legacy-redirect detection so /es/competitions/...
  // and /competitions/... resolve via the same alias map. The matching
  // response preserves whatever locale prefix the request had.
  const localePrefix = pathname.match(/^\/(es)(\/|$)/)?.[1] ?? "";
  const stripped = localePrefix ? pathname.slice(`/${localePrefix}`.length) : pathname;

  // Legacy competition slug: /competitions/{alias}(/...) → 301 canonical slug
  if (stripped.startsWith("/competitions/")) {
    const rest = stripped.slice("/competitions/".length);
    const [firstSegment, ...tail] = rest.split("/");
    const canonical = COMPETITION_SLUG_ALIASES[firstSegment];
    if (canonical) {
      const url = request.nextUrl.clone();
      const prefix = localePrefix ? `/${localePrefix}` : "";
      url.pathname = [prefix, "competitions", canonical, ...tail].join("/").replace(/\/+/g, "/");
      return NextResponse.redirect(url, 301);
    }
  }

  // Legacy match URL: /matches/{uuid} → 301 redirect to /matches/{slug}
  const matchUuidMatch = stripped.match(MATCH_UUID_PATH_RE);
  if (matchUuidMatch) {
    const matchId = matchUuidMatch[1];
    try {
      const lookup = await fetch(
        new URL(`/api/internal/match-slug?id=${matchId}`, request.url),
      );
      if (lookup.ok) {
        const { slug } = (await lookup.json()) as { slug: string | null };
        if (slug) {
          const prefix = localePrefix ? `/${localePrefix}` : "";
          return NextResponse.redirect(
            new URL(`${prefix}/matches/${slug}`, request.url),
            301,
          );
        }
      }
    } catch {
      // Fall through to normal handling on lookup failure
    }
    return NextResponse.next();
  }

  // Non-admin routes pass through next-intl so locale prefixes (/es) are
  // rewritten to the matching [locale] segment. Admin routes are auth-gated
  // below and never localized.
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/es/admin");
  if (!isAdmin) {
    return intlMiddleware(request);
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
  // Match everything except Next internals, API routes, and any path with a
  // dot (catches /sitemap.xml, /robots.txt, /feed.xml, /favicon.svg, images).
  // Critical because next-intl middleware otherwise tries to locale-rewrite
  // /sitemap.xml into /en/sitemap.xml, which 404s.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
