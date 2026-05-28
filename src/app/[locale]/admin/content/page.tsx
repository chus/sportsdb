"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AdminArticle {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  competitionName: string | null;
}

export default function AdminContentPage() {
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const limit = 20;

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/admin/articles?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setArticles(data.articles);
      setTotal(data.total);
    } catch (err) {
      console.error("Error fetching articles:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  async function handleStatusToggle(articleId: string, currentStatus: string) {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    setUpdatingId(articleId);
    try {
      const res = await fetch("/api/admin/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId ? { ...a, status: newStatus } : a
        )
      );
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  function truncateTitle(title: string, maxLen: number = 60): string {
    if (title.length <= maxLen) return title;
    return title.slice(0, maxLen) + "...";
  }

  function formatType(type: string): string {
    return type
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Content</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage articles and publication status
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Title
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Type
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Competition
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Status
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Created At
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-neutral-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-neutral-400"
                  >
                    No articles found
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr
                    key={article.id}
                    className={cn(
                      "transition-colors hover:bg-neutral-50",
                      updatingId === article.id && "opacity-50"
                    )}
                  >
                    <td
                      className="max-w-xs px-6 py-4 font-medium text-neutral-900"
                      title={article.title}
                    >
                      {truncateTitle(article.title)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                        {formatType(article.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {article.competitionName || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          article.status === "published"
                            ? "bg-green-50 text-green-700"
                            : "bg-yellow-50 text-yellow-700"
                        )}
                      >
                        {article.status.charAt(0).toUpperCase() +
                          article.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {article.createdAt
                        ? new Date(article.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() =>
                          handleStatusToggle(article.id, article.status)
                        }
                        disabled={updatingId === article.id}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          article.status === "published"
                            ? "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                            : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        )}
                      >
                        {article.status === "published"
                          ? "Unpublish"
                          : "Publish"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
            <p className="text-sm text-neutral-500">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, total)} of {total} articles
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="px-2 text-sm text-neutral-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
