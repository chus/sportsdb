import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { entityExists, type EntityType } from "@/lib/seo/entity-exists";

const intlMiddleware = createIntlMiddleware(routing);

// Entity routes where a missing slug should 308-redirect to the
// section index (instead of rendering the not-found template, which
// Next.js 16 serves as HTTP 200 + noindex,nofollow — Google then
// flags as Soft 404 or Excluded by noindex).
//
// Each entry: pattern → entity type. Pattern captures the slug.
const ENTITY_PATTERNS: Array<{
  re: RegExp;
  type: EntityType;
  index: string;
}> = [
  { re: /^(?:\/es)?\/news\/([^/]+)$/, type: "news", index: "/news" },
  { re: /^(?:\/es)?\/matches\/([^/]+)$/, type: "matches", index: "/matches" },
  { re: /^(?:\/es)?\/players\/([^/]+)$/, type: "players", index: "/players" },
  { re: /^(?:\/es)?\/teams\/([^/]+)$/, type: "teams", index: "/teams" },
  { re: /^(?:\/es)?\/venues\/([^/]+)$/, type: "venues", index: "/venues" },
  { re: /^(?:\/es)?\/competitions\/([^/]+)$/, type: "competitions", index: "/competitions" },
];

// Slugs that look like entity slugs but actually map to sub-routes,
// not detail pages. Skip the exists check for these.
const ENTITY_SUBROUTES: Record<EntityType, Set<string>> = {
  news: new Set(),
  matches: new Set(),
  players: new Set(["nationality", "position"]),
  teams: new Set(["country"]),
  venues: new Set(),
  competitions: new Set(),
};

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

// Deleted duplicate-club slugs → surviving canonical slug. These rows were
// merged (scripts/merge-known-duplicates.ts) after API-Football short names
// spawned a second team entity. 301-redirect the old slug so any indexed
// URL / inbound link passes its equity to the canonical page instead of
// 308-ing to the /teams hub (which loses the specific-page ranking).
const TEAM_SLUG_ALIASES: Record<string, string> = {
  "bayern-munchen": "fc-bayern-munich",
  "bayer-leverkusen": "bayer-04-leverkusen",
  "rennes": "stade-rennais-fc",
  "famalicao": "f-c-famalicao",
  "celta-vigo": "rc-celta-de-vigo",
  "alaves": "deportivo-alaves",
  "paris-saint-germain": "paris-saint-germain-fc",
  "club-leon": "leon",
  "club-atletico-huracan": "huracan",
};

const CANONICAL_HOST = "datasports.co";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // Redirect Vercel preview domains AND www. subdomain to the apex
  // (canonical) host. Both are configured as Vercel aliases for the
  // same app, so without this every page is duplicate content across
  // hostnames — Google flagged the www. variants as Soft 404.
  const isPreview = host.includes("vercel.app");
  const isWww = host === `www.${CANONICAL_HOST}`;
  if ((isPreview || isWww) && !pathname.startsWith("/api/")) {
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

  // Legacy team slug: /teams/{alias}(/...) → 301 canonical slug. Runs
  // before the entity-existence 308 so merged-duplicate URLs land on the
  // surviving team page rather than the section index.
  if (stripped.startsWith("/teams/")) {
    const rest = stripped.slice("/teams/".length);
    const [firstSegment, ...tail] = rest.split("/");
    const canonical = TEAM_SLUG_ALIASES[firstSegment];
    if (canonical) {
      const url = request.nextUrl.clone();
      const prefix = localePrefix ? `/${localePrefix}` : "";
      url.pathname = [prefix, "teams", canonical, ...tail].join("/").replace(/\/+/g, "/");
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

  // Entity-existence redirect — if /news/{slug}, /matches/{slug}, etc.
  // points to a slug that's no longer in DB, 308-redirect to the section
  // index so Google drops the dead URL and we pass PageRank to the
  // working hub page. Necessary because Next.js 16's server-component
  // permanentRedirect doesn't actually return 308 on ISR-eligible routes.
  for (const { re, type, index } of ENTITY_PATTERNS) {
    const m = pathname.match(re);
    if (!m) continue;
    const slug = decodeURIComponent(m[1]);
    if (ENTITY_SUBROUTES[type].has(slug)) break; // skip /players/nationality, /teams/country, etc.
    const exists = await entityExists(type, slug);
    if (!exists) {
      const prefix = localePrefix ? `/${localePrefix}` : "";
      return NextResponse.redirect(new URL(`${prefix}${index}`, request.url), 308);
    }
    break;
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
