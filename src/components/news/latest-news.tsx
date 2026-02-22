import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { getPublishedArticles } from "@/lib/queries/articles";
import { ArticleCard } from "./article-card";

interface LatestNewsProps {
  limit?: number;
}

export async function LatestNews({ limit = 4 }: LatestNewsProps) {
  const articles = await getPublishedArticles(limit);

  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Newspaper className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Latest News</h2>
          </div>
          <Link
            href="/news"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {articles.map((article) => (
            <ArticleCard key={article.article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
