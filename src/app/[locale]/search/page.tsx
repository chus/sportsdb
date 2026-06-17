import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { Users, Shield, Trophy, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { searchEntities, getEntitiesByType } from "@/lib/queries/search";
import { SearchBar } from "@/components/search/search-bar";
import { PopularSearches } from "@/components/search/popular-searches";
import { FeaturedEntities } from "@/components/search/featured-entities";
import type { SearchResult } from "@/types/entities";
import { PageTracker } from "@/components/analytics/page-tracker";
import { PlayerLink } from "@/components/player/player-link";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q || "";

  return {
    title: query ? `Search: ${query}` : "Search",
    description: query
      ? `Search results for "${query}" - Find players, teams, competitions, and venues`
      : "Search players, teams, competitions, and venues in DataSports",
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${BASE_URL}/search`,
    },
  };
}

const ENTITY_ROUTES: Record<string, string> = {
  player: "/players",
  team: "/teams",
  competition: "/competitions",
  venue: "/venues",
};

const TYPE_COLORS: Record<string, string> = {
  player: "bg-blue-100 text-blue-700",
  team: "bg-green-100 text-green-700",
  competition: "bg-purple-100 text-purple-700",
  venue: "bg-orange-100 text-orange-700",
};

const TYPE_LABELS: Record<string, string> = {
  player: "Player",
  team: "Team",
  competition: "Competition",
  venue: "Venue",
};

function SearchResultCard({ result }: { result: SearchResult }) {
  const href = `${ENTITY_ROUTES[result.entityType]}/${result.slug}`;
  const ICON_MAP: Record<string, typeof Users> = { player: Users, team: Shield, competition: Trophy, venue: MapPin };
  const Icon = ICON_MAP[result.entityType] || Users;

  const content = (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 bg-surface-2 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
        <Icon className="w-6 h-6 text-muted group-hover:text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-ink group-hover:text-blue-600 transition-colors truncate">
            {result.name}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${TYPE_COLORS[result.entityType]}`}
          >
            {TYPE_LABELS[result.entityType]}
          </span>
        </div>
        {result.subtitle && (
          <p className="text-sm text-muted truncate">{result.subtitle}</p>
        )}
        {result.meta && (
          <p className="text-xs text-muted mt-1">{result.meta}</p>
        )}
      </div>
    </div>
  );

  if (result.entityType === "player") {
    return (
      <PlayerLink
        slug={result.slug}
        isLinkWorthy={true}
        className="block p-4 bg-surface border border-line rounded-xl hover:shadow-lg hover:border-blue-200 transition-all group"
      >
        {content}
      </PlayerLink>
    );
  }

  return (
    <Link
      href={href}
      className="block p-4 bg-surface border border-line rounded-xl hover:shadow-lg hover:border-blue-200 transition-all group"
    >
      {content}
    </Link>
  );
}

async function SearchResults({
  query,
  type,
}: {
  query: string;
  type?: string;
}) {
  // No query and no type filter - show featured entities
  if (!query && !type) {
    return (
      <div className="space-y-8">
        <Suspense fallback={null}>
          <PopularSearches />
        </Suspense>
        <Suspense fallback={<div className="animate-pulse h-96 bg-surface-2 rounded-xl" />}>
          <FeaturedEntities />
        </Suspense>
      </div>
    );
  }

  // Type filter but no query - show all of that type
  let results: Awaited<ReturnType<typeof searchEntities>>;
  if (!query && type) {
    results = await getEntitiesByType(type, 50);
  } else {
    results = await searchEntities(query, type || undefined, 50);
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-faint" />
        </div>
        <h2 className="text-xl font-semibold text-ink mb-2">
          No results found
        </h2>
        <p className="text-muted">
          {query
            ? `No matches for "${query}"${type ? ` in ${TYPE_LABELS[type] || type}s` : ""}. Try adjusting your search.`
            : `No ${type ? (TYPE_LABELS[type] || type) : "result"}s found.`}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        {query
          ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"${type ? ` in ${TYPE_LABELS[type] || type}s` : ""}`
          : `${results.length} ${type ? (TYPE_LABELS[type] || type) : "result"}${results.length !== 1 ? "s" : ""}`}
      </p>
      <div className="grid gap-3">
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function SearchResultsSkeleton() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-4 bg-surface border border-line rounded-xl animate-pulse"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-surface-2 rounded-lg" />
            <div className="flex-1">
              <div className="h-5 bg-surface-2 rounded w-1/3 mb-2" />
              <div className="h-4 bg-surface-2 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const type = params.type || "";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageTracker />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-6">Search</h1>
        <SearchBar
          initialQuery={query}
          autoFocus={!query}
          size="large"
          placeholder="Search for players, teams, competitions..."
        />
      </div>

      {/* Results */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchResults query={query} type={type} />
      </Suspense>
    </div>
  );
}
