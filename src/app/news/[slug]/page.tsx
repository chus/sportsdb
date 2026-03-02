import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getArticleBySlug, getRelatedArticles, getArticleMatchData, getArticleRelatedEntities } from "@/lib/queries/articles";
import { ArticleCard } from "@/components/news/article-card";
import { Calendar, Clock, Trophy, User, ChevronRight, Shield, MapPin } from "lucide-react";
import { SidebarAd } from "@/components/ads/sidebar-ad";
import { InArticleAd } from "@/components/ads/in-article-ad";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { marked } from "marked";

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

  const { article } = result;

  return {
    title: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      ...(article.imageUrl && { images: [article.imageUrl] }),
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

  // Fetch match data, related entities, and related articles in parallel
  const [relatedArticles, matchData, { relatedPlayers, relatedTeams }] = await Promise.all([
    getRelatedArticles(
      article.id,
      article.competitionSeasonId,
      article.primaryPlayerId,
      article.primaryTeamId
    ),
    article.matchId ? getArticleMatchData(article.matchId) : Promise.resolve(null),
    getArticleRelatedEntities(article.id),
  ]);

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

  // NewsArticle JSON-LD
  const newsJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt?.toISOString(),
    author: { "@type": "Organization", name: "SportsDB" },
    publisher: { "@type": "Organization", name: "SportsDB" },
    ...(article.imageUrl && { image: article.imageUrl }),
  };

  // SportsEvent JSON-LD for match reports
  const sportsEventJsonLd =
    matchData && article.type === "match_report"
      ? {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${matchData.homeTeam.name} vs ${matchData.awayTeam.name}`,
          startDate: matchData.match.scheduledAt.toISOString(),
          homeTeam: {
            "@type": "SportsTeam",
            name: matchData.homeTeam.name,
            url: `${BASE_URL}/teams/${matchData.homeTeam.slug}`,
          },
          awayTeam: {
            "@type": "SportsTeam",
            name: matchData.awayTeam.name,
            url: `${BASE_URL}/teams/${matchData.awayTeam.slug}`,
          },
          ...(matchData.venue?.name && {
            location: {
              "@type": "Place",
              name: matchData.venue.name,
              ...(matchData.venue.city && {
                address: { "@type": "PostalAddress", addressLocality: matchData.venue.city },
              }),
            },
          }),
          ...(matchData.competition && {
            superEvent: {
              "@type": "SportsEvent",
              name: matchData.competition.name,
            },
          }),
          ...(matchData.match.homeScore !== null &&
            matchData.match.awayScore !== null && {
              result: `${matchData.homeTeam.name} ${matchData.match.homeScore} - ${matchData.match.awayScore} ${matchData.awayTeam.name}`,
            }),
        }
      : null;

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
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "News", url: `${BASE_URL}/news` },
          { name: article.title, url: `${BASE_URL}/news/${slug}` },
        ]}
      />

      <div className="min-h-screen bg-white">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white">
          <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-neutral-400 mb-6">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link href="/news" className="hover:text-white transition-colors">
                News
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-neutral-300 truncate max-w-[200px]">
                {article.title}
              </span>
            </nav>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span
                className={`text-sm font-semibold px-3 py-1.5 rounded-full border ${typeInfo.bg} ${typeInfo.color}`}
              >
                {typeInfo.label}
              </span>
              {competition && (
                <Link
                  href={`/competitions/${competition.slug}`}
                  className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white transition-colors"
                >
                  <Trophy className="w-4 h-4" />
                  {competition.name}
                </Link>
              )}
              {season && (
                <span className="text-sm text-neutral-500">{season.label}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-6">
              {article.title}
            </h1>

            {/* Excerpt */}
            <p className="text-lg md:text-xl text-neutral-300 leading-relaxed mb-8 max-w-3xl">
              {article.excerpt}
            </p>

            {/* Article meta */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-400">
              {article.publishedAt && (
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(article.publishedAt), "MMMM d, yyyy")}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {readingTime} min read
              </span>
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                SportsDB Editorial
              </span>
            </div>
          </div>
        </div>

        {/* Match Scoreline (for match reports) */}
        {matchData && matchData.match.homeScore !== null && matchData.match.awayScore !== null && (
          <div className="bg-neutral-50 border-b border-neutral-200">
            <div className="max-w-3xl mx-auto px-4 py-6">
              <div className="flex items-center justify-center gap-6">
                <Link href={`/teams/${matchData.homeTeam.slug}`} className="flex items-center gap-3 group">
                  {matchData.homeTeam.logoUrl && (
                    <img src={matchData.homeTeam.logoUrl} alt={matchData.homeTeam.name} className="w-10 h-10 object-contain" />
                  )}
                  <span className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                    {matchData.homeTeam.name}
                  </span>
                </Link>
                <div className="text-3xl font-bold text-neutral-900 px-4">
                  {matchData.match.homeScore} – {matchData.match.awayScore}
                </div>
                <Link href={`/teams/${matchData.awayTeam.slug}`} className="flex items-center gap-3 group">
                  <span className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                    {matchData.awayTeam.name}
                  </span>
                  {matchData.awayTeam.logoUrl && (
                    <img src={matchData.awayTeam.logoUrl} alt={matchData.awayTeam.name} className="w-10 h-10 object-contain" />
                  )}
                </Link>
              </div>
              {matchData.venue?.name && (
                <div className="text-center text-sm text-neutral-500 mt-3 flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <Link href={`/venues/${matchData.venue.slug}`} className="hover:text-blue-600 transition-colors">
                    {matchData.venue.name}
                  </Link>
                  {matchData.venue.city && <span>· {matchData.venue.city}</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* Team badge for match reports */}
          {primaryTeam && !matchData && (
            <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200 mb-8">
              {primaryTeam.logoUrl && (
                <img
                  src={primaryTeam.logoUrl}
                  alt={primaryTeam.name}
                  className="w-12 h-12 object-contain"
                />
              )}
              <div>
                <div className="text-xs text-neutral-500 uppercase tracking-wide">Featured Team</div>
                <Link
                  href={`/teams/${primaryTeam.slug}`}
                  className="font-semibold text-neutral-900 hover:text-blue-600 transition-colors"
                >
                  {primaryTeam.name}
                </Link>
              </div>
            </div>
          )}

          {/* Article body */}
          <article
            className="prose prose-lg max-w-none
              prose-headings:font-semibold prose-headings:text-neutral-900 prose-headings:tracking-tight
              prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-neutral-200
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-neutral-800 prose-p:leading-[1.8] prose-p:mb-6
              prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
              prose-strong:text-neutral-900 prose-strong:font-semibold
              prose-li:text-neutral-800 prose-li:leading-relaxed
              prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-neutral-700
              [&>p:first-of-type]:text-lg [&>p:first-of-type]:text-neutral-700 [&>p:first-of-type]:leading-relaxed [&>p:first-of-type]:font-normal
              [&>p:first-of-type]:first-letter:text-5xl [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:text-blue-600 [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:mt-1"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          <InArticleAd />

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
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                      {matchData.homeTeam.logoUrl ? (
                        <img src={matchData.homeTeam.logoUrl} alt="" className="w-full h-full object-contain" />
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
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                      {matchData.awayTeam.logoUrl ? (
                        <img src={matchData.awayTeam.logoUrl} alt="" className="w-full h-full object-contain" />
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
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                    {primaryTeam.logoUrl ? (
                      <img src={primaryTeam.logoUrl} alt="" className="w-full h-full object-contain" />
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
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1">
                      {team.logoUrl ? (
                        <img src={team.logoUrl} alt="" className="w-full h-full object-contain" />
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

        {/* Sidebar content moved to bottom for single-column layout */}
        <div className="bg-neutral-50 border-t border-neutral-200">
          <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Competition card */}
              {competition && (
                <Link
                  href={`/competitions/${competition.slug}`}
                  className="block bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white hover:shadow-lg transition-shadow"
                >
                  <Trophy className="w-8 h-8 mb-3 opacity-80" />
                  <div className="text-sm opacity-80">Competition</div>
                  <div className="font-semibold text-lg">{competition.name}</div>
                  {season && (
                    <div className="text-sm opacity-80 mt-1">{season.label}</div>
                  )}
                </Link>
              )}

              <SidebarAd />
            </div>
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
