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
        <h1 className="text-2xl font-bold text-ink">Content</h1>
        <p className="mt-1 text-sm text-muted">
          Manage articles and publication status
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th className="px-6 py-3.5 font-medium text-muted">
                  Title
                </th>
                <th className="px-6 py-3.5 font-medium text-muted">
                  Type
                </th>
                <th className="px-6 py-3.5 font-medium text-muted">
                  Competition
                </th>
                <th className="px-6 py-3.5 font-medium text-muted">
                  Status
                </th>
                <th className="px-6 py-3.5 font-medium text-muted">
                  Created At
                </th>
                <th className="px-6 py-3.5 font-medium text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-faint"
                  >
                    Loading...
                  </td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-faint"
                  >
                    No articles found
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr
                    key={article.id}
                    className={cn(
                      "transition-colors hover:bg-surface-2",
                      updatingId === article.id && "opacity-50"
                    )}
                  >
                    <td
                      className="max-w-xs px-6 py-4 font-medium text-ink"
                      title={article.title}
                    >
                      {truncateTitle(article.title)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink">
                        {formatType(article.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted">
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
                    <td className="px-6 py-4 text-muted">
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
          <div className="flex items-center justify-between border-t border-line px-6 py-4">
            <p className="text-sm text-muted">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, total)} of {total} articles
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="px-2 text-sm text-muted">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
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
