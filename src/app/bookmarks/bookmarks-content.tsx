"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Bookmark, Trash2, Loader2, User, Users, Trophy } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface BookmarkEntity {
  name: string;
  slug: string;
  imageUrl?: string | null;
  logoUrl?: string | null;
  position?: string;
  country?: string;
}

interface BookmarkData {
  id: string;
  entityType: "player" | "team" | "competition" | "match";
  entityId: string;
  notes: string | null;
  createdAt: string;
  entity: BookmarkEntity | null;
}

export function BookmarksPageContent() {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "players" | "teams" | "competitions">("all");

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch("/api/bookmarks");
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeBookmark = async (entityType: string, entityId: string) => {
    try {
      await fetch(
        `/api/bookmarks?entityType=${entityType}&entityId=${entityId}`,
        { method: "DELETE" }
      );
      setBookmarks((prev) =>
        prev.filter(
          (b) => !(b.entityType === entityType && b.entityId === entityId)
        )
      );
    } catch (error) {
      console.error("Failed to remove bookmark:", error);
    }
  };

  const filteredBookmarks =
    activeTab === "all"
      ? bookmarks
      : bookmarks.filter((b) => b.entityType === activeTab.slice(0, -1));

  const playerBookmarks = bookmarks.filter((b) => b.entityType === "player");
  const teamBookmarks = bookmarks.filter((b) => b.entityType === "team");
  const competitionBookmarks = bookmarks.filter((b) => b.entityType === "competition");

  const getEntityLink = (bookmark: BookmarkData) => {
    const slug = bookmark.entity?.slug || bookmark.entityId;
    switch (bookmark.entityType) {
      case "player":
        return `/players/${slug}`;
      case "team":
        return `/teams/${slug}`;
      case "competition":
        return `/competitions/${slug}`;
      default:
        return "#";
    }
  };

  const getEntityImage = (bookmark: BookmarkData) => {
    return bookmark.entity?.imageUrl || bookmark.entity?.logoUrl || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-yellow-600" />
              <h1 className="font-bold text-lg">Bookmarks</h1>
            </div>
            <div className="w-20" />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-neutral-200 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {bookmarks.length}
            </div>
            <div className="text-sm text-neutral-600 mt-1">Total Saved</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200 text-center">
            <div className="text-2xl font-bold text-green-600">
              {playerBookmarks.length}
            </div>
            <div className="text-sm text-neutral-600 mt-1">Players</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {teamBookmarks.length}
            </div>
            <div className="text-sm text-neutral-600 mt-1">Teams</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-neutral-200 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {competitionBookmarks.length}
            </div>
            <div className="text-sm text-neutral-600 mt-1">Competitions</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-neutral-200">
          {(["all", "players", "teams", "competitions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-3 font-medium text-sm transition-colors relative capitalize",
                activeTab === tab
                  ? "text-blue-600"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              {tab === "all" ? "All Bookmarks" : tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {filteredBookmarks.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-neutral-200 text-center">
            <Bookmark className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
            <h3 className="text-xl font-bold text-neutral-900 mb-2">
              No bookmarks yet
            </h3>
            <p className="text-neutral-600 mb-6">
              Start bookmarking players, teams, and competitions to save them for
              later
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Explore SportsDB
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Players */}
            {(activeTab === "all" || activeTab === "players") &&
              playerBookmarks.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-green-600" />
                    Players ({playerBookmarks.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {playerBookmarks.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        link={getEntityLink(bookmark)}
                        image={getEntityImage(bookmark)}
                        onRemove={() =>
                          removeBookmark(bookmark.entityType, bookmark.entityId)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

            {/* Teams */}
            {(activeTab === "all" || activeTab === "teams") &&
              teamBookmarks.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-600" />
                    Teams ({teamBookmarks.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teamBookmarks.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        link={getEntityLink(bookmark)}
                        image={getEntityImage(bookmark)}
                        onRemove={() =>
                          removeBookmark(bookmark.entityType, bookmark.entityId)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

            {/* Competitions */}
            {(activeTab === "all" || activeTab === "competitions") &&
              competitionBookmarks.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-purple-600" />
                    Competitions ({competitionBookmarks.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {competitionBookmarks.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        link={getEntityLink(bookmark)}
                        image={getEntityImage(bookmark)}
                        onRemove={() =>
                          removeBookmark(bookmark.entityType, bookmark.entityId)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function BookmarkCard({
  bookmark,
  link,
  image,
  onRemove,
}: {
  bookmark: BookmarkData;
  link: string;
  image: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-neutral-200 hover:shadow-lg hover:border-blue-300 transition-all group relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="absolute top-3 right-3 p-1.5 bg-neutral-100 hover:bg-red-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-4 h-4 text-neutral-500 hover:text-red-600" />
      </button>

      <Link href={link} className="flex items-center gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0",
            bookmark.entityType === "player"
              ? "bg-gradient-to-br from-blue-600 to-indigo-600"
              : bookmark.entityType === "team"
              ? "bg-gradient-to-br from-green-600 to-emerald-600"
              : "bg-gradient-to-br from-purple-600 to-pink-600"
          )}
        >
          {image ? (
            <Image
              src={image}
              alt={bookmark.entity?.name || ""}
              width={48}
              height={48}
              className={cn(
                "w-full h-full",
                bookmark.entityType === "player"
                  ? "object-cover"
                  : "object-contain p-1"
              )}
            />
          ) : (
            <span className="text-white text-sm font-bold">
              {bookmark.entity?.name?.substring(0, 2).toUpperCase() || "?"}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-neutral-900 group-hover:text-blue-600 truncate">
            {bookmark.entity?.name || "Unknown"}
          </div>
          <div className="text-xs text-neutral-500">
            Saved {new Date(bookmark.createdAt).toLocaleDateString()}
          </div>
        </div>
      </Link>
    </div>
  );
}
