import { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 3600; // ISR: revalidate every hour
import Link from "next/link";
import { format } from "date-fns";
import {
  getArticleBySlug,
  getRelatedArticles,
  getArticleMatchData,
  getArticleRelatedEntities,
  getArticleMatchContext,
} from "@/lib/queries/articles";
import { ArticleCard } from "@/components/news/article-card";
import {
  Calendar,
  Clock,
  Trophy,
  User,
  ChevronRight,
  Shield,
  MapPin,
  Users,
  TrendingUp,
  Target,
} from "lucide-react";
import { InArticleAd } from "@/components/ads/in-article-ad";
import { SidebarUpgradeOrAd } from "@/components/subscription/sidebar-upgrade-or-ad";
import { UpgradeBanner } from "@/components/subscription/upgrade-banner";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { MatchTimeline } from "@/components/match/match-timeline";
import { MatchStatBars } from "@/components/match/match-stat-bars";
import { ShareButtons } from "@/components/news/share-buttons";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getTeamStats } from "@/lib/queries/teams";
import { getPlayerStats } from "@/lib/queries/players";
import { marked } from "marked";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);

  if (!result) {
    return { title: "Article Not Found" };
  }

  const { article, competition, season } = result;

  // Enhanced title for match reports
  let title = article.metaTitle || article.title;
  if (article.type === "match_report" && article.matchId) {
    const matchData = await getArticleMatchData(article.matchId);
    if (matchData && matchData.match.homeScore !== null && matchData.match.awayScore !== null) {
      const compName = competition?.name || "";
      const seasonLabel = season?.label || "";
      title = `${matchData.homeTeam.name} ${matchData.match.homeScore}-${matchData.match.awayScore} ${matchData.awayTeam.name} | ${compName} ${seasonLabel} Match Report`.trim();

      // Enhanced description with scorers
      const matchContext = await getArticleMatchContext(article.matchId, article.competitionSeasonId);
      const goals = matchContext.events.filter((e) => e.type === "goal" || e.type === "own_goal");
      if (goals.length > 0) {
        const scorerNames = goals
          .map((g) => g.player?.name || "Unknown")
          .slice(0, 3)
          .join(", ");
        const desc = `${matchData.homeTeam.name} ${matchData.match.homeScore}-${matchData.match.awayScore} ${matchData.awayTeam.name}. Goals: ${scorerNames}. Full match report and analysis.`;
        return {
          title,
          description: desc,
          alternates: { canonical: `${BASE_URL}/news/${slug}` },
          robots: {
            index: true,
            follow: true,
            "max-image-preview": "large" as const,
            "max-snippet": -1,
          },
          openGraph: {
            title,
            description: desc,
            type: "article",
            publishedTime: article.publishedAt?.toISOString(),
            modifiedTime: (article.updatedAt || article.publishedAt)?.toISOString(),
            section: competition?.name || "Football",
            authors: ["DataSports Editorial"],
            images: [
              {
                url: `${BASE_URL}/news/${slug}/opengraph-image`,
                width: 1200,
                height: 630,
                alt: title,
              },
            ],
          },
          twitter: {
            card: "summary_large_image",
            title,
            description: desc,
          },
        };
      }
    }
  }

  return {
    title,
    description: article.metaDescription || article.excerpt,
    alternates: { canonical: `${BASE_URL}/news/${slug}` },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: (article.updatedAt || article.publishedAt)?.toISOString(),
      section: competition?.name || "Football",
      authors: ["DataSports Editorial"],
      images: [
        {
          url: `${BASE_URL}/news/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
    },
  };
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  match_report: { label: "Match Report", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  match_preview: { label: "Match Preview", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  round_recap: { label: "Matchday Recap", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  player_spotlight: { label: "Player Spotlight", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  season_review: { label: "Season Review", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  transfer_news: { label: "Transfer News", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Replace known entity names in HTML with links to their pages.
 * Operates on the rendered HTML — replaces plain-text occurrences outside of existing tags.
 */
function linkifyEntities(
  html: string,
  entities: Array<{ name: string; slug: string; type: "player" | "team" | "competition" }>
): string {
  // Sort by name length descending to match longer names first
  const sorted = [...entities].sort((a, b) => b.name.length - a.name.length);
  let result = html;

  for (const entity of sorted) {
    const prefix =
      entity.type === "player" ? "/players" : entity.type === "team" ? "/teams" : "/competitions";
    // Only replace text that is NOT inside an HTML tag or already inside an <a>
    // Match the entity name when it appears as a standalone word (not inside tags)
    const escapedName = entity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `(?<![\\w/"-])(?!<)\\b(${escapedName})\\b(?![^<]*>)(?![^<]*</a>)`,
      "g"
    );
    // Only replace the first 3 occurrences to avoid over-linking
    let count = 0;
    result = result.replace(regex, (match) => {
      count++;
      if (count > 3) return match;
      return `<a href="${prefix}/${entity.slug}" class="text-blue-600 font-medium hover:underline">${match}</a>`;
    });
  }
  return result;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getRatingColor(rating: number): string {
  if (rating >= 7.0) return "text-green-600 bg-green-50";
  if (rating >= 6.0) return "text-yellow-600 bg-yellow-50";
  return "text-red-600 bg-red-50";
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);

  if (!result) {
    notFound();
  }

  const { article, competition, season, primaryPlayer, primaryTeam } = result;
  const typeInfo = TYPE_LABELS[article.type] || {
    label: article.type,
    color: "text-neutral-700",
    bg: "bg-neutral-50 border-neutral-200",
  };

  // Fetch match data, related entities, related articles, and match context in parallel
  const [relatedArticles, matchData, { relatedPlayers, relatedTeams }, matchContext] =
    await Promise.all([
      getRelatedArticles(
        article.id,
        article.competitionSeasonId,
        article.primaryPlayerId,
        article.primaryTeamId
      ),
      article.matchId ? getArticleMatchData(article.matchId) : Promise.resolve(null),
      getArticleRelatedEntities(article.id),
      article.matchId
        ? getArticleMatchContext(article.matchId, article.competitionSeasonId)
        : Promise.resolve(null),
    ]);

  // Fetch team standings/form context
  let homeStanding: Awaited<ReturnType<typeof getTeamStats>>[number] | null = null;
  let awayStanding: Awaited<ReturnType<typeof getTeamStats>>[number] | null = null;
  let primaryStanding: Awaited<ReturnType<typeof getTeamStats>>[number] | null = null;
  let primaryPlayerStats: Awaited<ReturnType<typeof getPlayerStats>> | null = null;

  if (matchData) {
    const [hStats, aStats] = await Promise.all([
      getTeamStats(matchData.match.homeTeamId),
      getTeamStats(matchData.match.awayTeamId),
    ]);
    homeStanding = hStats[0] ?? null;
    awayStanding = aStats[0] ?? null;
  } else if (article.primaryTeamId || (article.primaryPlayerId && article.type === "player_spotlight")) {
    const [tStats, pStats] = await Promise.all([
      article.primaryTeamId ? getTeamStats(article.primaryTeamId) : Promise.resolve(null),
      article.primaryPlayerId && article.type === "player_spotlight"
        ? getPlayerStats(article.primaryPlayerId) : Promise.resolve(null),
    ]);
    primaryStanding = tStats?.[0] ?? null;
    primaryPlayerStats = pStats;
  }

  // Parse markdown content
  let htmlContent = marked.parse(article.content, { async: false }) as string;

  // Build entity list for linkification
  const linkableEntities: Array<{ name: string; slug: string; type: "player" | "team" | "competition" }> = [];
  if (primaryPlayer) linkableEntities.push({ ...primaryPlayer, type: "player" });
  if (primaryTeam) linkableEntities.push({ name: primaryTeam.name, slug: primaryTeam.slug, type: "team" });
  if (competition) linkableEntities.push({ ...competition, type: "competition" });
  for (const p of relatedPlayers) linkableEntities.push({ name: p.name, slug: p.slug, type: "player" });
  for (const t of relatedTeams) linkableEntities.push({ name: t.name, slug: t.slug, type: "team" });
  if (matchData) {
    linkableEntities.push({ name: matchData.homeTeam.name, slug: matchData.homeTeam.slug, type: "team" });
    linkableEntities.push({ name: matchData.awayTeam.name, slug: matchData.awayTeam.slug, type: "team" });
  }

  // Deduplicate by slug
  const seen = new Set<string>();
  const uniqueEntities = linkableEntities.filter((e) => {
    if (seen.has(e.slug)) return false;
    seen.add(e.slug);
    return true;
  });

  htmlContent = linkifyEntities(htmlContent, uniqueEntities);

  const readingTime = estimateReadingTime(article.content);
  const articleUrl = `${BASE_URL}/news/${slug}`;

  // Prepare lineups data for player ratings section
  const homeLineups = matchData && matchContext?.lineups
    ? matchContext.lineups.get(matchData.match.homeTeamId)
    : null;
  const awayLineups = matchData && matchContext?.lineups
    ? matchContext.lineups.get(matchData.match.awayTeamId)
    : null;
  const hasRatings = !!(
    homeLineups?.starters.some((l) => l.lineup.rating !== null) ||
    awayLineups?.starters.some((l) => l.lineup.rating !== null)
  );

  // Standings data
  const standingsData =
    matchContext?.standings && matchContext.standings.length > 0
      ? matchContext.standings.slice(0, 8)
      : null;

  // NewsArticle JSON-LD — enhanced for Google Discover
  const ogImageUrl = `${BASE_URL}/news/${slug}/opengraph-image`;
  const newsJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: (article.updatedAt || article.publishedAt)?.toISOString(),
    author: {
      "@type": "Person",
      name: "DataSports Editorial",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "DataSports",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/favicon.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    image: [ogImageUrl, ...(article.imageUrl ? [article.imageUrl] : [])],
    isAccessibleForFree: true,
    ...(competition && {
      about: {
        "@type": "SportsOrganization",
        name: competition.name,
        url: `${BASE_URL}/competitions/${competition.slug}`,
      },
    }),
  };

  // SportsEvent JSON-LD for match reports
  const sportsEventJsonLd =
    matchData && article.type === "match_report"
      ? (() => {
          const scoreStr =
            matchData.match.homeScore !== null && matchData.match.awayScore !== null
              ? `${matchData.homeTeam.name} ${matchData.match.homeScore} - ${matchData.match.awayScore} ${matchData.awayTeam.name}`
              : null;
          const desc = scoreStr
            ? `${scoreStr}. ${matchData.competition ? matchData.competition.name + " match" : "Football match"} report.`
            : `${matchData.competition ? matchData.competition.name + " match" : "Football match"}: ${matchData.homeTeam.name} vs ${matchData.awayTeam.name}.`;
          return {
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `${matchData.homeTeam.name} vs ${matchData.awayTeam.name}`,
            description: desc,
            startDate: matchData.match.scheduledAt.toISOString(),
            sport: "Football",
            competitor: [
              {
                "@type": "SportsTeam",
                name: matchData.homeTeam.name,
                url: `${BASE_URL}/teams/${matchData.homeTeam.slug}`,
              },
              {
                "@type": "SportsTeam",
                name: matchData.awayTeam.name,
                url: `${BASE_URL}/teams/${matchData.awayTeam.slug}`,
              },
            ],
            location: matchData.venue?.name
              ? {
                  "@type": "StadiumOrArena",
                  name: matchData.venue.name,
                  address: {
                    "@type": "PostalAddress",
                    ...(matchData.venue.city && { addressLocality: matchData.venue.city }),
                    ...(matchData.venue.country && { addressCountry: matchData.venue.country }),
                    ...(!matchData.venue.city && !matchData.venue.country && { name: matchData.venue.name }),
                  },
                }
              : { "@type": "Place", name: "TBD", address: { "@type": "PostalAddress", name: "TBD" } },
            ...(matchData.competition && {
              organizer: {
                "@type": "SportsOrganization",
                name: matchData.competition.name,
                url: `${BASE_URL}/competitions/${matchData.competition.slug}`,
              },
            }),
            ...(matchData.competition && {
              superEvent: {
                "@type": "SportsEvent",
                name: matchData.competition.name,
              },
            }),
            ...(scoreStr && { result: scoreStr }),
          };
        })()
      : null;

  // Auto-generate FAQ items from article data
  const faqItems: { question: string; answer: string }[] = [];

  if (article.type === "match_report" && matchData) {
    const home = matchData.homeTeam.name;
    const away = matchData.awayTeam.name;

    if (matchData.match.homeScore !== null && matchData.match.awayScore !== null) {
      faqItems.push({
        question: `What was the final score of ${home} vs ${away}?`,
        answer: `The final score was ${home} ${matchData.match.homeScore}-${matchData.match.awayScore} ${away}.`,
      });
    }

    if (matchContext) {
      const goals = matchContext.events.filter(
        (e) => e.type === "goal" || e.type === "own_goal" || e.type === "penalty"
      );
      if (goals.length > 0) {
        const scorerList = goals
          .sort((a, b) => a.minute - b.minute)
          .map((g) => `${g.player?.name ?? "Unknown"} (${g.minute}')`)
          .join(", ");
        faqItems.push({
          question: `Who scored in ${home} vs ${away}?`,
          answer: `The goal scorers were: ${scorerList}.`,
        });
      }
    }

    if (matchData.venue?.name) {
      const location = [matchData.venue.name, matchData.venue.city].filter(Boolean).join(", ");
      faqItems.push({
        question: `Where was ${home} vs ${away} played?`,
        answer: `The match was played at ${location}.`,
      });
    }

    if (competition && season) {
      faqItems.push({
        question: `What competition was ${home} vs ${away} in?`,
        answer: `This match was part of the ${competition.name} ${season.label}.`,
      });
    }
  } else if (article.type === "player_spotlight" && primaryPlayer) {
    if (primaryTeam) {
      faqItems.push({
        question: `What team does ${primaryPlayer.name} play for?`,
        answer: `${primaryPlayer.name} currently plays for ${primaryTeam.name}.`,
      });
    }
    if (primaryPlayerStats && primaryPlayerStats.length > 0) {
      const s = primaryPlayerStats[0];
      faqItems.push({
        question: `How many goals has ${primaryPlayer.name} scored this season?`,
        answer: `${primaryPlayer.name} has scored ${s.stat.goals ?? 0} goals in ${s.stat.appearances ?? 0} appearances this ${s.seasonLabel} season.`,
      });
    }
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: BASE_URL },
    { name: "News", url: `${BASE_URL}/news` },
    ...(competition
      ? [{ name: competition.name, url: `${BASE_URL}/competitions/${competition.slug}` }]
      : []),
    { name: article.title, url: articleUrl },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsJsonLd) }}
      />
      {sportsEventJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }}
        />
      )}
      <BreadcrumbJsonLd items={breadcrumbItems} />
      {faqItems.length > 0 && <FAQJsonLd items={faqItems} />}
      <PageTracker />

      <div className="min-h-screen bg-white">
        {/* Compact Hero Header */}
        <div className="bg-gradient-to-br from-neutral-900 via-blue-950 to-indigo-950 text-white">
          <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href="/news" className="hover:text-white transition-colors">
                News
              </Link>
              {competition && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <Link
                    href={`/competitions/${competition.slug}`}
                    className="hover:text-white transition-colors"
                  >
                    {competition.name}
                  </Link>
                </>
              )}
            </nav>

            {/* Badges + meta on one row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeInfo.bg} ${typeInfo.color}`}
              >
                {typeInfo.label}
              </span>
              {article.publishedAt && (
                <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(article.publishedAt), "MMM d, yyyy")}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                <User className="w-3.5 h-3.5" />
                DataSports Editorial
              </span>
              <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="w-3.5 h-3.5" />
                {readingTime} min read
              </span>
              {competition && (
                <Link
                  href={`/competitions/${competition.slug}`}
                  className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  {competition.name}{season ? ` · ${season.label}` : ""}
                </Link>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
              {article.title}
            </h1>
          </div>
        </div>

        {/* Scoreboard Card (for match reports) */}
        {matchData && matchData.match.homeScore !== null && matchData.match.awayScore !== null && (
          <div className="max-w-3xl mx-auto px-4 -mt-6">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-md p-6">
              <div className="flex items-center justify-center gap-4 sm:gap-8">
                {/* Home team */}
                <Link
                  href={`/teams/${matchData.homeTeam.slug}`}
                  className="flex flex-col items-center gap-2 group flex-1 min-w-0"
                >
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    {matchData.homeTeam.logoUrl ? (
                      <ImageWithFallback
                        src={matchData.homeTeam.logoUrl}
                        alt={matchData.homeTeam.name}
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    ) : (
                      <Shield className="w-10 h-10 text-neutral-300" />
                    )}
                  </div>
                  <span className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors text-center text-sm sm:text-base truncate max-w-full">
                    {matchData.homeTeam.name}
                  </span>
                </Link>

                {/* Score */}
                <div className="flex flex-col items-center">
                  <div className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">
                    {matchData.match.homeScore} – {matchData.match.awayScore}
                  </div>
                  <span className="text-xs text-neutral-500 mt-1 uppercase tracking-wide">
                    Full Time
                  </span>
                </div>

                {/* Away team */}
                <Link
                  href={`/teams/${matchData.awayTeam.slug}`}
                  className="flex flex-col items-center gap-2 group flex-1 min-w-0"
                >
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    {matchData.awayTeam.logoUrl ? (
                      <ImageWithFallback
                        src={matchData.awayTeam.logoUrl}
                        alt={matchData.awayTeam.name}
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    ) : (
                      <Shield className="w-10 h-10 text-neutral-300" />
                    )}
                  </div>
                  <span className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors text-center text-sm sm:text-base truncate max-w-full">
                    {matchData.awayTeam.name}
                  </span>
                </Link>
              </div>

              {/* Venue / Referee / Attendance */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 pt-4 border-t border-neutral-100 text-sm text-neutral-500">
                {matchData.venue?.name && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <Link
                      href={`/venues/${matchData.venue.slug}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {matchData.venue.name}
                    </Link>
                    {matchData.venue.city && <span>· {matchData.venue.city}</span>}
                  </span>
                )}
                {matchData.match.referee && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {matchData.match.referee}
                  </span>
                )}
                {matchData.match.attendance && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {matchData.match.attendance.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Data Dashboard — 4 cards for match reports */}
        {matchData && matchContext && matchContext.events.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 pt-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Goal Scorers */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">⚽</span>
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Goals</h3>
                </div>
                {(() => {
                  const goals = matchContext.events.filter((e) => e.type === "goal" || e.type === "own_goal" || e.type === "penalty");
                  return goals.length > 0 ? (
                    <div className="space-y-1">
                      {goals.sort((a, b) => a.minute - b.minute).slice(0, 4).map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-neutral-900 truncate">
                            {e.player?.name ?? "Unknown"}
                            {e.type === "own_goal" && " (OG)"}
                            {e.type === "penalty" && " (P)"}
                          </span>
                          <span className="text-neutral-500 flex-shrink-0 ml-1">{e.minute}&apos;</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400">No goals</p>
                  );
                })()}
              </div>

              {/* Cards */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">🟨</span>
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Cards</h3>
                </div>
                {(() => {
                  const homeEvts = matchContext.events.filter((e) => e.teamId === matchData.match.homeTeamId);
                  const awayEvts = matchContext.events.filter((e) => e.teamId === matchData.match.awayTeamId);
                  const hY = homeEvts.filter((e) => e.type === "yellow_card").length;
                  const hR = homeEvts.filter((e) => e.type === "red_card").length;
                  const aY = awayEvts.filter((e) => e.type === "yellow_card").length;
                  const aR = awayEvts.filter((e) => e.type === "red_card").length;
                  return (hY + hR + aY + aR) > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-700 font-medium">{matchData.homeTeam.name}</span>
                        <span className="text-neutral-500">{hY > 0 ? `🟨${hY}` : ""} {hR > 0 ? `🟥${hR}` : ""}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-700 font-medium">{matchData.awayTeam.name}</span>
                        <span className="text-neutral-500">{aY > 0 ? `🟨${aY}` : ""} {aR > 0 ? `🟥${aR}` : ""}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400">No cards</p>
                  );
                })()}
              </div>

              {/* Competition */}
              {competition ? (
                <Link
                  href={`/competitions/${competition.slug}`}
                  className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Competition</h3>
                  </div>
                  <div className="text-sm font-bold text-neutral-900 truncate">{competition.name}</div>
                  <p className="text-xs text-neutral-500">
                    {season ? season.label : ""}
                  </p>
                </Link>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-neutral-400" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Competition</h3>
                  </div>
                  <p className="text-sm text-neutral-400">Unknown</p>
                </div>
              )}

              {/* Venue */}
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Venue</h3>
                </div>
                {matchData.venue?.name ? (
                  <>
                    <div className="text-sm font-bold text-neutral-900 truncate">{matchData.venue.name}</div>
                    <p className="text-xs text-neutral-500">
                      {[matchData.venue.city, matchData.match.attendance ? `${matchData.match.attendance.toLocaleString()} att.` : null].filter(Boolean).join(" · ")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">Not available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Match Timeline & Stats */}
        {matchContext && matchContext.events.length > 0 && matchData && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            <MatchStatBars
              homeTeamName={matchData.homeTeam.name}
              awayTeamName={matchData.awayTeam.name}
              homeTeamLogo={matchData.homeTeam.logoUrl}
              awayTeamLogo={matchData.awayTeam.logoUrl}
              events={matchContext.events}
              homeTeamId={matchData.match.homeTeamId}
              awayTeamId={matchData.match.awayTeamId}
            />
            <MatchTimeline
              events={matchContext.events}
              homeTeamId={matchData.match.homeTeamId}
              awayTeamId={matchData.match.awayTeamId}
              homeTeamName={matchData.homeTeam.name}
              awayTeamName={matchData.awayTeam.name}
            />
          </div>
        )}

        {/* Form & Standings Context — for match reports */}
        {matchData && (homeStanding || awayStanding) && (
          <div className="max-w-3xl mx-auto px-4 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* League Position */}
              {(homeStanding || awayStanding) && (
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">League Position</h3>
                  </div>
                  <div className="space-y-3">
                    {homeStanding && (
                      <Link href={`/competitions/${homeStanding.competitionSlug}`} className="flex items-center gap-3 group">
                        {matchData.homeTeam.logoUrl && (
                          <ImageWithFallback src={matchData.homeTeam.logoUrl} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                        )}
                        <span className="text-sm font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                          {ordinal(homeStanding.standing.position)}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {homeStanding.standing.points} pts · {homeStanding.standing.won}W {homeStanding.standing.drawn}D {homeStanding.standing.lost}L
                        </span>
                      </Link>
                    )}
                    {awayStanding && (
                      <Link href={`/competitions/${awayStanding.competitionSlug}`} className="flex items-center gap-3 group">
                        {matchData.awayTeam.logoUrl && (
                          <ImageWithFallback src={matchData.awayTeam.logoUrl} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                        )}
                        <span className="text-sm font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                          {ordinal(awayStanding.standing.position)}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {awayStanding.standing.points} pts · {awayStanding.standing.won}W {awayStanding.standing.drawn}D {awayStanding.standing.lost}L
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Form */}
              {(homeStanding?.standing.form || awayStanding?.standing.form) && (
                <div className="bg-white rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Target className="w-3.5 h-3.5 text-green-500" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Recent Form</h3>
                  </div>
                  <div className="space-y-3">
                    {homeStanding?.standing.form && (
                      <div className="flex items-center gap-3">
                        {matchData.homeTeam.logoUrl && (
                          <ImageWithFallback src={matchData.homeTeam.logoUrl} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                        )}
                        <div className="flex gap-1">
                          {homeStanding.standing.form.split(",").slice(-5).map((r, i) => (
                            <span
                              key={i}
                              className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                                r === "W" ? "bg-green-100 text-green-700" :
                                r === "D" ? "bg-neutral-100 text-neutral-600" :
                                "bg-red-100 text-red-700"
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {awayStanding?.standing.form && (
                      <div className="flex items-center gap-3">
                        {matchData.awayTeam.logoUrl && (
                          <ImageWithFallback src={matchData.awayTeam.logoUrl} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                        )}
                        <div className="flex gap-1">
                          {awayStanding.standing.form.split(",").slice(-5).map((r, i) => (
                            <span
                              key={i}
                              className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                                r === "W" ? "bg-green-100 text-green-700" :
                                r === "D" ? "bg-neutral-100 text-neutral-600" :
                                "bg-red-100 text-red-700"
                              }`}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team & Player Context — for non-match articles */}
        {!matchData && (primaryStanding || primaryPlayerStats) && (
          <div className="max-w-3xl mx-auto px-4 pt-6">
            <div className={`grid gap-3 ${primaryStanding && primaryPlayerStats ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {/* Primary team standings */}
              {primaryStanding && primaryTeam && (
                <Link
                  href={`/competitions/${primaryStanding.competitionSlug}`}
                  className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">League Standing</h3>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    {primaryTeam.logoUrl && (
                      <ImageWithFallback src={primaryTeam.logoUrl} alt="" width={28} height={28} className="w-7 h-7 object-contain" />
                    )}
                    <div>
                      <span className="text-lg font-bold text-neutral-900">{ordinal(primaryStanding.standing.position)}</span>
                      <span className="text-xs text-neutral-500 ml-2">{primaryStanding.competitionName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>{primaryStanding.standing.points} pts</span>
                    <span>{primaryStanding.standing.won}W {primaryStanding.standing.drawn}D {primaryStanding.standing.lost}L</span>
                    {primaryStanding.standing.form && (
                      <div className="flex gap-0.5 ml-auto">
                        {primaryStanding.standing.form.split(",").slice(-5).map((r, i) => (
                          <span
                            key={i}
                            className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
                              r === "W" ? "bg-green-100 text-green-700" :
                              r === "D" ? "bg-neutral-100 text-neutral-600" :
                              "bg-red-100 text-red-700"
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              )}

              {/* Player current season stats */}
              {primaryPlayerStats && primaryPlayerStats.length > 0 && primaryPlayer && (
                <Link
                  href={`/players/${primaryPlayer.slug}`}
                  className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-3">
                    <User className="w-3.5 h-3.5 text-amber-500" />
                    <h3 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Season Stats</h3>
                  </div>
                  <div className="text-sm font-bold text-neutral-900 mb-2">{primaryPlayer.name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {primaryPlayerStats.slice(0, 1).map((s) => (
                      <div key={s.seasonLabel} className="contents">
                        <div className="text-center">
                          <div className="text-lg font-bold text-neutral-900">{s.stat.appearances ?? 0}</div>
                          <div className="text-[10px] text-neutral-500 uppercase">Apps</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-neutral-900">{s.stat.goals ?? 0}</div>
                          <div className="text-[10px] text-neutral-500 uppercase">Goals</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-neutral-900">{s.stat.assists ?? 0}</div>
                          <div className="text-[10px] text-neutral-500 uppercase">Assists</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Quick context bar for non-match articles */}
          {primaryTeam && !matchData && (
            <div className="flex items-center gap-3 mb-6">
              {primaryTeam.logoUrl && (
                <ImageWithFallback
                  src={primaryTeam.logoUrl}
                  alt={primaryTeam.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain"
                />
              )}
              <Link
                href={`/teams/${primaryTeam.slug}`}
                className="text-sm font-medium text-neutral-700 hover:text-blue-600 transition-colors"
              >
                {primaryTeam.name}
              </Link>
              <span className="text-neutral-300">·</span>
              <ShareButtons title={article.title} url={articleUrl} />
            </div>
          )}
          {(matchData || !primaryTeam) && (
            <div className="mb-6">
              <ShareButtons title={article.title} url={articleUrl} />
            </div>
          )}

          {/* Lead paragraph */}
          <p className="text-lg text-neutral-700 leading-relaxed mb-8 font-medium">
            {article.excerpt}
          </p>

          {/* Article body */}
          <article
            className="max-w-none
              [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-neutral-200
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_h3]:mt-8 [&_h3]:mb-3
              [&_p]:text-base [&_p]:text-neutral-800 [&_p]:leading-relaxed [&_p]:mb-6
              [&_a]:text-blue-600 [&_a]:font-medium [&_a]:no-underline hover:[&_a]:underline
              [&_strong]:text-neutral-900 [&_strong]:font-semibold
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-6
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-6
              [&_li]:text-neutral-800 [&_li]:leading-relaxed [&_li]:mb-2
              [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:bg-blue-50 [&_blockquote]:py-4 [&_blockquote]:px-6 [&_blockquote]:rounded-r-lg [&_blockquote]:not-italic [&_blockquote]:text-neutral-700
              [&>p:first-of-type]:text-lg [&>p:first-of-type]:text-neutral-700 [&>p:first-of-type]:leading-relaxed [&>p:first-of-type]:font-normal"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          <InArticleAd />

          <UpgradeBanner variant="inline" context="article" className="my-8" />

          {/* Player Ratings Section */}
          {article.type === "match_report" && matchData && hasRatings && homeLineups && awayLineups && (
            <div className="mt-12 pt-8 border-t border-neutral-200">
              <h3 className="text-xl font-bold text-neutral-900 mb-6">Player Ratings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Home team */}
                <div>
                  <h4 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    {matchData.homeTeam.logoUrl && (
                      <ImageWithFallback src={matchData.homeTeam.logoUrl} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                    )}
                    {matchData.homeTeam.name}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="text-left py-2 font-medium">Player</th>
                          <th className="text-center py-2 font-medium w-12">Pos</th>
                          <th className="text-center py-2 font-medium w-14">Rating</th>
                          <th className="text-center py-2 font-medium w-12">Mins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {homeLineups.starters.map((l) => (
                          <tr key={l.lineup.id} className="border-b border-neutral-100">
                            <td className="py-2">
                              <Link
                                href={`/players/${l.player.slug}`}
                                className="text-neutral-900 hover:text-blue-600 transition-colors"
                              >
                                {l.player.name}
                              </Link>
                            </td>
                            <td className="text-center text-neutral-500 text-xs">
                              {l.lineup.position?.slice(0, 3).toUpperCase() || "—"}
                            </td>
                            <td className="text-center">
                              {l.lineup.rating ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getRatingColor(
                                    parseFloat(l.lineup.rating)
                                  )}`}
                                >
                                  {parseFloat(l.lineup.rating).toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </td>
                            <td className="text-center text-neutral-500 text-xs">
                              {l.lineup.minutesPlayed ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Away team */}
                <div>
                  <h4 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                    {matchData.awayTeam.logoUrl && (
                      <ImageWithFallback src={matchData.awayTeam.logoUrl} alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                    )}
                    {matchData.awayTeam.name}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="text-left py-2 font-medium">Player</th>
                          <th className="text-center py-2 font-medium w-12">Pos</th>
                          <th className="text-center py-2 font-medium w-14">Rating</th>
                          <th className="text-center py-2 font-medium w-12">Mins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {awayLineups.starters.map((l) => (
                          <tr key={l.lineup.id} className="border-b border-neutral-100">
                            <td className="py-2">
                              <Link
                                href={`/players/${l.player.slug}`}
                                className="text-neutral-900 hover:text-blue-600 transition-colors"
                              >
                                {l.player.name}
                              </Link>
                            </td>
                            <td className="text-center text-neutral-500 text-xs">
                              {l.lineup.position?.slice(0, 3).toUpperCase() || "—"}
                            </td>
                            <td className="text-center">
                              {l.lineup.rating ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getRatingColor(
                                    parseFloat(l.lineup.rating)
                                  )}`}
                                >
                                  {parseFloat(l.lineup.rating).toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </td>
                            <td className="text-center text-neutral-500 text-xs">
                              {l.lineup.minutesPlayed ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Standings Impact Section */}
          {article.type === "match_report" && matchData && standingsData && (
            <div className="mt-12 pt-8 border-t border-neutral-200">
              <h3 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-blue-600" />
                Standings
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-neutral-200 text-neutral-500">
                      <th className="text-left py-2 font-medium w-8">#</th>
                      <th className="text-left py-2 font-medium">Team</th>
                      <th className="text-center py-2 font-medium w-8">P</th>
                      <th className="text-center py-2 font-medium w-8">W</th>
                      <th className="text-center py-2 font-medium w-8 hidden sm:table-cell">D</th>
                      <th className="text-center py-2 font-medium w-8">L</th>
                      <th className="text-center py-2 font-medium w-10 hidden sm:table-cell">GD</th>
                      <th className="text-center py-2 font-medium w-10">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standingsData.map((row) => {
                      const isMatchTeam =
                        row.team.id === matchData.match.homeTeamId ||
                        row.team.id === matchData.match.awayTeamId;
                      return (
                        <tr
                          key={row.standing.id}
                          className={`border-b border-neutral-100 ${
                            isMatchTeam ? "bg-blue-50 font-medium" : ""
                          }`}
                        >
                          <td className="py-2 text-neutral-500">{row.standing.position}</td>
                          <td className="py-2">
                            <Link
                              href={`/teams/${row.team.slug}`}
                              className="text-neutral-900 hover:text-blue-600 transition-colors flex items-center gap-2"
                            >
                              {row.team.logoUrl && (
                                <ImageWithFallback src={row.team.logoUrl} alt="" width={16} height={16} className="w-4 h-4 object-contain" />
                              )}
                              {row.team.name}
                            </Link>
                          </td>
                          <td className="text-center text-neutral-600">{row.standing.played}</td>
                          <td className="text-center text-neutral-600">{row.standing.won}</td>
                          <td className="text-center text-neutral-600 hidden sm:table-cell">{row.standing.drawn}</td>
                          <td className="text-center text-neutral-600">{row.standing.lost}</td>
                          <td className="text-center text-neutral-600 hidden sm:table-cell">
                            {row.standing.goalDifference > 0 ? "+" : ""}
                            {row.standing.goalDifference}
                          </td>
                          <td className="text-center font-bold text-neutral-900">
                            {row.standing.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Related Topics — entity cards */}
          <div className="mt-12 pt-8 border-t border-neutral-200">
            <h3 className="text-xl font-semibold text-neutral-900 mb-4">
              Related Topics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Match teams */}
              {matchData && (
                <>
                  <Link
                  href={`/teams/${matchData.homeTeam.slug}`}
                  className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="relative w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                    {matchData.homeTeam.logoUrl ? (
                        <ImageWithFallback src={matchData.homeTeam.logoUrl} alt="" fill sizes="48px" className="object-contain" />
                      ) : (
                        <Shield className="w-6 h-6 text-neutral-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Team</span>
                      <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {matchData.homeTeam.name}
                      </div>
                    </div>
                  </Link>
                  <Link
                  href={`/teams/${matchData.awayTeam.slug}`}
                  className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="relative w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                    {matchData.awayTeam.logoUrl ? (
                        <ImageWithFallback src={matchData.awayTeam.logoUrl} alt="" fill sizes="48px" className="object-contain" />
                      ) : (
                        <Shield className="w-6 h-6 text-neutral-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Team</span>
                      <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {matchData.awayTeam.name}
                      </div>
                    </div>
                  </Link>
                </>
              )}

              {/* Primary team (if no match data) */}
              {!matchData && primaryTeam && (
                <Link
                  href={`/teams/${primaryTeam.slug}`}
                  className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="relative w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                    {primaryTeam.logoUrl ? (
                      <ImageWithFallback src={primaryTeam.logoUrl} alt="" fill sizes="48px" className="object-contain" />
                    ) : (
                      <Shield className="w-6 h-6 text-neutral-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Team</span>
                    <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {primaryTeam.name}
                    </div>
                  </div>
                </Link>
              )}

              {/* Competition */}
              {competition && (
                <Link
                  href={`/competitions/${competition.slug}`}
                  className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Competition</span>
                    <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {competition.name}
                    </div>
                  </div>
                </Link>
              )}

              {/* Primary player */}
              {primaryPlayer && (
                <Link
                  href={`/players/${primaryPlayer.slug}`}
                  className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                  <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Player</span>
                    <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {primaryPlayer.name}
                    </div>
                  </div>
                </Link>
              )}

              {/* Related players from junction table */}
              {relatedPlayers
                .filter((p) => p.slug !== primaryPlayer?.slug)
                .map((player) => (
                  <Link
                    key={player.slug}
                    href={`/players/${player.slug}`}
                    className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
                  >
                    <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-neutral-400" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Player</span>
                      <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {player.name}
                      </div>
                    </div>
                  </Link>
                ))}

              {/* Related teams from junction table */}
              {relatedTeams
                .filter(
                  (t) =>
                    t.slug !== primaryTeam?.slug &&
                    t.slug !== matchData?.homeTeam.slug &&
                    t.slug !== matchData?.awayTeam.slug
                )
                .map((team) => (
                  <Link
                    key={team.slug}
                  href={`/teams/${team.slug}`}
                  className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md hover:border-blue-200 transition-all group"
                >
                    <div className="relative w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                      {team.logoUrl ? (
                        <ImageWithFallback src={team.logoUrl} alt="" fill sizes="48px" className="object-contain" />
                      ) : (
                        <Shield className="w-6 h-6 text-neutral-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Team</span>
                      <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {team.name}
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* Upgrade CTA */}
        <div className="bg-neutral-50 border-t border-neutral-200">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <SidebarUpgradeOrAd context="article" />
          </div>
        </div>

        {/* More Articles Section */}
        {relatedArticles.length > 0 && (
          <div className="bg-white border-t border-neutral-200">
            <div className="max-w-6xl mx-auto px-4 py-12">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-neutral-900">
                  More Stories
                </h2>
                <Link
                  href="/news"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View All News
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedArticles.slice(0, 3).map((related) => (
                  <ArticleCard key={related.article.id} article={related} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
