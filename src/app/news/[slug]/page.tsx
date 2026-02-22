import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { getArticleBySlug, getRelatedArticles } from "@/lib/queries/articles";
import { ArticleCard } from "@/components/news/article-card";
import { ArrowLeft, Calendar, Tag, Share2 } from "lucide-react";
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

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  match_report: { label: "Match Report", color: "bg-blue-100 text-blue-700" },
  match_preview: { label: "Match Preview", color: "bg-indigo-100 text-indigo-700" },
  round_recap: { label: "Matchday Recap", color: "bg-purple-100 text-purple-700" },
  player_spotlight: { label: "Player Spotlight", color: "bg-amber-100 text-amber-700" },
  season_review: { label: "Season Review", color: "bg-green-100 text-green-700" },
  transfer_news: { label: "Transfer News", color: "bg-red-100 text-red-700" },
};

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);

  if (!result) {
    notFound();
  }

  const { article, competition, season, primaryPlayer, primaryTeam } = result;
  const typeInfo = TYPE_LABELS[article.type] || {
    label: article.type,
    color: "bg-neutral-100 text-neutral-700",
  };

  const relatedArticles = await getRelatedArticles(
    article.id,
    article.competitionSeasonId,
    article.primaryPlayerId,
    article.primaryTeamId
  );

  // Parse markdown content
  const htmlContent = marked.parse(article.content, { async: false });

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

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to News
          </Link>
        </nav>

        {/* Article Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${typeInfo.color}`}
            >
              {typeInfo.label}
            </span>
            {competition && (
              <Link
                href={`/competitions/${competition.slug}`}
                className="text-sm text-neutral-500 hover:text-blue-600 transition-colors"
              >
                {competition.name}
              </Link>
            )}
            {season && (
              <span className="text-sm text-neutral-400">{season.label}</span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
            {article.title}
          </h1>

          <p className="text-lg text-neutral-600 mb-6">{article.excerpt}</p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 pb-6 border-b border-neutral-200">
            {article.publishedAt && (
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {format(new Date(article.publishedAt), "MMMM d, yyyy")}
              </span>
            )}
            {primaryTeam && (
              <Link
                href={`/teams/${primaryTeam.slug}`}
                className="flex items-center gap-2 hover:text-blue-600 transition-colors"
              >
                {primaryTeam.logoUrl && (
                  <img
                    src={primaryTeam.logoUrl}
                    alt={primaryTeam.name}
                    className="w-5 h-5 object-contain"
                  />
                )}
                {primaryTeam.name}
              </Link>
            )}
            {primaryPlayer && (
              <Link
                href={`/players/${primaryPlayer.slug}`}
                className="hover:text-blue-600 transition-colors"
              >
                {primaryPlayer.name}
              </Link>
            )}
          </div>
        </header>

        {/* Article Content */}
        <article
          className="prose prose-neutral prose-lg max-w-none mb-12
            prose-headings:font-bold prose-headings:text-neutral-900
            prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-neutral-700 prose-p:leading-relaxed
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-neutral-900"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Related Links */}
        <div className="flex flex-wrap gap-3 py-6 border-t border-b border-neutral-200 mb-12">
          {primaryPlayer && (
            <Link
              href={`/players/${primaryPlayer.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full text-sm text-neutral-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            >
              <Tag className="w-4 h-4" />
              {primaryPlayer.name}
            </Link>
          )}
          {primaryTeam && (
            <Link
              href={`/teams/${primaryTeam.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full text-sm text-neutral-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            >
              <Tag className="w-4 h-4" />
              {primaryTeam.name}
            </Link>
          )}
          {competition && (
            <Link
              href={`/competitions/${competition.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full text-sm text-neutral-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
            >
              <Tag className="w-4 h-4" />
              {competition.name}
            </Link>
          )}
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedArticles.map((related) => (
                <ArticleCard key={related.article.id} article={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
