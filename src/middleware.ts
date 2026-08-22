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

// ------------------------------------------------------------------
// Bot control (July 2026 cost scale-down). The June Vercel overage was
// ~23M invocations of near-pure crawler traffic, so bots are handled
// before any DB work below.
//
// Hard-blocked crawlers: SEO scrapers already disallowed in robots.ts
// (which they routinely ignore) plus generic scraping libraries. 403.
// Aug 2026 (Vercel Hobby fair-use limits): AI-assistant crawlers are now
// blocked too — they were the single largest non-search crawler group and
// the GEO channel they represented produced no measurable traffic.
const BLOCKED_BOT_RE =
  /AhrefsBot|SemrushBot|MJ12bot|DotBot|BLEXBot|DataForSeoBot|PetalBot|Bytespider|serpstatbot|ZoominfoBot|MegaIndex|SeekportBot|BacklinkCrawler|python-requests|Scrapy|HeadlessChrome|GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|anthropic-ai|PerplexityBot|CCBot|Amazonbot|meta-externalagent|FacebookBot|Applebot-Extended|YandexBot|Diffbot|ImagesiftBot|Timpibot|omgili|cohere-ai|GoogleOther|DuckAssistBot|Bravebot/i;

// Search engines that are never rate-limited — losing Google/Bing crawl
// would defeat the purpose of keeping the site up.
const SEARCH_BOT_RE = /Googlebot|Google-InspectionTool|bingbot|Applebot|DuckDuckBot/i;

// Anything else that self-identifies as automated gets rate-limited.
const GENERIC_BOT_RE = /bot|crawler|spider|crawling|scraper/i;

// Fixed-window in-memory limiter. Per-isolate, so the effective global
// limit is (30 × concurrent workers) — imprecise but sufficient to stop
// a single crawler hammering one region, at zero infra cost.
const RATE_LIMIT_PER_MIN = 30;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function botRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    if (rateBuckets.size > 5_000) rateBuckets.clear(); // cap memory
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_PER_MIN;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const host = request.headers.get("host") || "";

  const userAgent = request.headers.get("user-agent") || "";
  const isSearchBot = SEARCH_BOT_RE.test(userAgent);
  if (!isSearchBot && BLOCKED_BOT_RE.test(userAgent)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!isSearchBot && GENERIC_BOT_RE.test(userAgent)) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (botRateLimited(ip)) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }

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

  // Entity-existence checking used to live here (a Neon query per uncached
  // slug, 308-redirecting dead slugs to the section hub). Removed July 2026:
  // it kept the DB compute awake on every crawler hit. Missing entities are
  // now handled by the page components themselves via notFound().

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
