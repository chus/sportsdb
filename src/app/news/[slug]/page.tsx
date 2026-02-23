import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getArticleBySlug, getRelatedArticles } from "@/lib/queries/articles";
import { ArticleCard } from "@/components/news/article-card";
import { ArrowLeft, Calendar, Clock, Trophy, User, ChevronRight } from "lucide-react";
import { marked } from "marked";

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

  const relatedArticles = await getRelatedArticles(
    article.id,
    article.competitionSeasonId,
    article.primaryPlayerId,
    article.primaryTeamId
  );

  // Parse markdown content
  const htmlContent = marked.parse(article.content, { async: false });
  const readingTime = estimateReadingTime(article.content);

  // JSON-LD structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt?.toISOString(),
    author: {
      "@type": "Organization",
      name: "SportsDB",
    },
    publisher: {
      "@type": "Organization",
      name: "SportsDB",
    },
    ...(article.imageUrl && {
      image: article.imageUrl,
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-neutral-50">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
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

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Article Content */}
            <article className="lg:col-span-8">
              {/* Team badges for match reports */}
              {primaryTeam && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-neutral-200 mb-8">
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
              <div
                className="prose prose-lg max-w-none
                  prose-headings:font-bold prose-headings:text-neutral-900 prose-headings:tracking-tight
                  prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-neutral-200
                  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                  prose-p:text-neutral-700 prose-p:leading-[1.8] prose-p:mb-6
                  prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-neutral-900 prose-strong:font-semibold
                  prose-li:text-neutral-700 prose-li:leading-relaxed
                  prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-neutral-700
                  [&>p:first-of-type]:text-xl [&>p:first-of-type]:text-neutral-600 [&>p:first-of-type]:leading-relaxed [&>p:first-of-type]:font-normal
                  [&>p:first-of-type]:first-letter:text-5xl [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:text-blue-600 [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:mt-1"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />

              {/* Tags section */}
              <div className="mt-12 pt-8 border-t border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-4">
                  Related Topics
                </h3>
                <div className="flex flex-wrap gap-2">
                  {primaryPlayer && (
                    <Link
                      href={`/players/${primaryPlayer.slug}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-blue-100 rounded-full text-sm font-medium text-neutral-700 hover:text-blue-700 transition-colors"
                    >
                      {primaryPlayer.name}
                    </Link>
                  )}
                  {primaryTeam && (
                    <Link
                      href={`/teams/${primaryTeam.slug}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-blue-100 rounded-full text-sm font-medium text-neutral-700 hover:text-blue-700 transition-colors"
                    >
                      {primaryTeam.name}
                    </Link>
                  )}
                  {competition && (
                    <Link
                      href={`/competitions/${competition.slug}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-blue-100 rounded-full text-sm font-medium text-neutral-700 hover:text-blue-700 transition-colors"
                    >
                      {competition.name}
                    </Link>
                  )}
                </div>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="sticky top-24 space-y-6">
                {/* Back to news */}
                <Link
                  href="/news"
                  className="flex items-center gap-2 text-sm text-neutral-500 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to News
                </Link>

                {/* Related Articles */}
                {relatedArticles.length > 0 && (
                  <div className="bg-white rounded-xl border border-neutral-200 p-5">
                    <h3 className="font-semibold text-neutral-900 mb-4">
                      Related Articles
                    </h3>
                    <div className="space-y-4">
                      {relatedArticles.slice(0, 4).map((related) => (
                        <Link
                          key={related.article.id}
                          href={`/news/${related.article.slug}`}
                          className="block group"
                        >
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                            {TYPE_LABELS[related.article.type]?.label || related.article.type}
                          </span>
                          <h4 className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 transition-colors line-clamp-2 mt-1">
                            {related.article.title}
                          </h4>
                          {related.article.publishedAt && (
                            <span className="text-xs text-neutral-500 mt-1 block">
                              {format(new Date(related.article.publishedAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Competition info */}
                {competition && (
                  <Link
                    href={`/competitions/${competition.slug}`}
                    className="block bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white hover:shadow-lg transition-shadow"
                  >
                    <Trophy className="w-8 h-8 mb-3 opacity-80" />
                    <div className="text-sm opacity-80">Competition</div>
                    <div className="font-semibold text-lg">{competition.name}</div>
                    {season && (
                      <div className="text-sm opacity-80 mt-1">{season.label}</div>
                    )}
                  </Link>
                )}
              </div>
            </aside>
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
